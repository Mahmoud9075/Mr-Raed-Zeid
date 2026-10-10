import re
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import current_user
from ..models import ChatKnowledge, QuizAttempt, User
from ..schemas import AssistantMessageIn
from ..config import get_settings

router = APIRouter(prefix="/assistant", tags=["assistant"])

ALLOWED_HINTS = ["english","انجليزي","إنجليزي","grammar","جرامر","قواعد","كلمة","معنى","ترجمة","درس","امتحان","اختبار","درجة","نتيجة","ميعاد","موعد","سنتر","حجز","سعر","اشتراك","مستر","رائد"]


def tokens(text: str):
    return set(re.findall(r"[\w\u0600-\u06FF]+", text.lower()))


def match_knowledge(message: str, rows):
    mt = tokens(message); best=None; best_score=0
    for row in rows:
        kt = tokens(row.keywords + " " + row.question)
        score = len(mt & kt)
        if score > best_score:
            best=row; best_score=score
    return best if best_score >= 1 else None


@router.post("/chat")
async def chat(data: AssistantMessageIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    msg = data.message.strip()
    low = msg.lower()
    if any(x in low for x in ["درجتي", "درجاتي", "نتيجتي", "نتائجي"]):
        attempts = db.scalars(select(QuizAttempt).where(QuizAttempt.user_id == user.id, QuizAttempt.submitted_at.is_not(None)).order_by(QuizAttempt.submitted_at.desc()).limit(5)).all()
        if attempts:
            latest = attempts[0]
            return {"source":"student-data","answer":f"يا {user.first_name}، آخر نتيجة مسجلة عندك هي {latest.score}%"}
        return {"source":"student-data","answer":f"يا {user.first_name}، مفيش نتيجة اختبار مسجلة على حسابك لحد دلوقتي."}
    rows = db.scalars(select(ChatKnowledge).where(ChatKnowledge.is_active.is_(True))).all()
    hit = match_knowledge(msg, rows)
    if hit:
        return {"source":"teacher-knowledge","answer":hit.answer}
    if not any(h in low for h in ALLOWED_HINTS):
        return {"source":"restricted","answer":"أنا مخصص لأسئلة التعليم والإنجليزي والقواعد وبيانات مستر رائد. لو محتاج حاجة خاصة بالمستر ومش لاقيها، تقدر تتواصل معاه على واتساب."}
    settings = get_settings()
    if not settings.gemini_api_key:
        return {"source":"fallback","answer":"السؤال ده محتاج المساعد الذكي الخارجي. الربط جاهز في السيرفر، ولما يتم إضافة مفتاح Gemini هيشتغل تلقائيًا. ولو السؤال خاص بالمستر تقدر تتواصل معاه على واتساب."}
    prompt = f"""أنت مساعد مستر رائد الآلي. رد باختصار وبعامية مصرية بسيطة على أسئلة التعليم واللغة الإنجليزية فقط. لو السؤال خارج التعليم ارفض بلطف. اسم الطالب: {user.first_name}. السؤال: {msg}"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(url, json={"contents":[{"parts":[{"text":prompt}]}]})
            res.raise_for_status(); body=res.json()
            answer=body["candidates"][0]["content"]["parts"][0]["text"]
            return {"source":"gemini","answer":answer}
    except Exception:
        return {"source":"fallback","answer":"مش قادر أوصل للمساعد الذكي دلوقتي. جرّب بعد شوية، ولو السؤال خاص بالمستر استخدم زر واتساب."}
