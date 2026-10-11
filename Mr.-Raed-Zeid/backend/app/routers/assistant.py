import re
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import optional_current_user
from ..models import ChatKnowledge, QuizAttempt, User
from ..schemas import AssistantMessageIn
from ..config import get_settings

router = APIRouter(prefix="/assistant", tags=["assistant"])

ALLOWED_HINTS = [
    "english", "انجليزي", "إنجليزي", "grammar", "جرامر", "قواعد", "كلمة", "معنى", "ترجمة",
    "درس", "منهج", "امتحان", "اختبار", "درجة", "نتيجة", "ميعاد", "موعد", "سنتر", "حجز",
    "سعر", "اشتراك", "مستر", "رائد", "واجب", "مراجعة", "شرح", "ثانوي", "اعدادي", "إعدادي"
]

HANDOFF = "السؤال ده محتاج مستر رائد بشكل مباشر. تقدر تتواصل معاه من زر واتساب."


def tokens(text: str) -> set[str]:
    return set(re.findall(r"[\w\u0600-\u06FF]+", text.lower()))


def match_knowledge(message: str, rows):
    message_tokens = tokens(message)
    best = None
    best_score = 0
    for row in rows:
        knowledge_tokens = tokens(f"{row.keywords} {row.question}")
        score = len(message_tokens & knowledge_tokens)
        if score > best_score:
            best = row
            best_score = score
    return best if best_score >= 1 else None


def looks_educational(text: str) -> bool:
    low = text.lower()
    if any(hint in low for hint in ALLOWED_HINTS):
        return True
    latin = sum(1 for char in text if "a" <= char.lower() <= "z")
    return latin >= 2


def build_prompt(message: str, first_name: str | None) -> str:
    name_line = f"Student first name: {first_name}." if first_name else "The visitor is not signed in."
    return f"""
You are the educational assistant for Mr. Raed Zeid, an English teacher in Egypt.
{name_line}

Rules:
- Answer only questions about English learning, school curriculum, grammar, vocabulary, translation, exercises, studying, or Mr. Raed's educational services.
- If the question is outside education, reply briefly that you are specialized in education and English and suggest contacting Mr. Raed when appropriate.
- If the user asks in Arabic, answer in simple Egyptian Arabic. If the user asks in English, answer in English.
- Never invent dates, prices, schedules, addresses, grades, or private student data. Those must come from the platform database.
- For a vocabulary question: give the Arabic meaning, part of speech when useful, and one short example.
- For grammar: start with a one-line summary, then the rule, then 1-2 examples.
- For differences between words: explain the difference clearly and give an example for each.
- Correct obvious spelling mistakes politely without making the reply feel like an error message.
- Keep the answer structured, clear, and not unnecessarily long.

Student question:
{message}
""".strip()


@router.post("/chat")
async def chat(
    data: AssistantMessageIn,
    db: Session = Depends(get_db),
    user: User | None = Depends(optional_current_user),
):
    message = data.message.strip()
    low = message.lower()

    if any(keyword in low for keyword in ["درجتي", "درجاتي", "نتيجتي", "نتائجي", "my grade", "my result"]):
        if not user:
            return {"source": "auth-required", "answer": "علشان أقولك درجاتك ونتايجك لازم تسجل دخول بحساب الطالب الأول."}
        attempts = db.scalars(
            select(QuizAttempt)
            .where(QuizAttempt.user_id == user.id, QuizAttempt.submitted_at.is_not(None))
            .order_by(QuizAttempt.submitted_at.desc())
            .limit(5)
        ).all()
        if attempts:
            latest = attempts[0]
            if latest.needs_manual_review:
                return {"source": "student-data", "answer": f"يا {user.first_name}، آخر اختبار عندك اتسلم وبيستنى مراجعة الجزء المقالي. النتيجة النهائية هتظهر بعد اعتماد المستر."}
            return {"source": "student-data", "answer": f"يا {user.first_name}، آخر نتيجة مسجلة عندك هي {latest.score}%."}
        return {"source": "student-data", "answer": f"يا {user.first_name}، مفيش نتيجة اختبار مسجلة على حسابك لحد دلوقتي."}

    knowledge_rows = db.scalars(select(ChatKnowledge).where(ChatKnowledge.is_active.is_(True))).all()
    hit = match_knowledge(message, knowledge_rows)
    if hit:
        return {"source": "teacher-knowledge", "answer": hit.answer}

    if not looks_educational(message):
        return {
            "source": "restricted",
            "answer": "أنا متخصص في التعليم والإنجليزي وبيانات مستر رائد. لو سؤالك محتاج المستر شخصيًا تقدر تتواصل معاه من زر واتساب."
        }

    settings = get_settings()
    if not settings.gemini_api_key:
        return {"source": "handoff", "answer": HANDOFF}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    payload = {
        "contents": [{"parts": [{"text": build_prompt(message, user.first_name if user else None)}]}],
        "generationConfig": {"temperature": 0.25, "topP": 0.9, "maxOutputTokens": 900}
    }
    try:
        async with httpx.AsyncClient(timeout=18) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            body = response.json()
            answer = body["candidates"][0]["content"]["parts"][0]["text"].strip()
            if not answer:
                answer = HANDOFF
            return {"source": "gemini", "answer": answer}
    except Exception:
        return {"source": "handoff", "answer": HANDOFF}
