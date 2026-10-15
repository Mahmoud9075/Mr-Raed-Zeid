import logging
from datetime import datetime, timezone
import re
import time
import unicodedata

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..db import get_db
from ..deps import current_user
from ..models import ChatKnowledge, Quiz, QuizAttempt, SiteSetting, User
from ..schemas import AssistantHistoryItem, AssistantMessageIn

router = APIRouter(prefix="/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)

WORD_PROMPT = "اكتبلي الكلمة اللي عايز تعرف معناها."
GRAMMAR_PROMPT = "اكتبلي اسم القاعدة أو السؤال اللي محتاج شرحه."
GEMINI_UNAVAILABLE = "مش قادر أوصل للمساعد الذكي دلوقتي، جرّب كمان شوية."

LOCAL_TERMS = {
    "hours": ("مواعيد", "ميعاد السنتر", "center hours", "opening hours", "opening time"),
    "location": ("عنوان السنتر", "مكان السنتر", "السنتر فين", "موقع السنتر", "center address", "center location", "where is the center"),
    "booking": ("حجز", "احجز", "booking", "how to book", "how can i book", "book a lesson", "book a class", "book an appointment"),
    "pricing": ("سعر", "اسعار", "الاشتراك", "اشتراك", "رسوم", "جنيه", "خصم", "خصومات", "price", "prices", "fee", "fees", "tuition", "subscription", "discount"),
    "contact": ("واتساب", "رقم", "تواصل", "البريد", "ايميل", "contact", "whatsapp", "phone", "email"),
    "quiz": ("كويز", "اختبار", "امتحان", "quiz", "exam", "placement test"),
    "teacher": ("مستر رائد", "بيانات مستر", "معلومات مستر", "عن المستر", "اسم المستر", "المستر بيدرس"),
    "account": ("حسابي", "حساب الطالب", "حسابك", "الحسابات", "تسجيل الدخول", "درجتي", "نتيجتي", "my account", "my score", "my result", "login"),
    "site": ("الموقع", "اعدادات الموقع", "معلومات الموقع", "وضع الصيانة", "الصيانة", "site settings", "website settings", "maintenance"),
}

KNOWLEDGE_CATEGORIES = {
    "hours": {"المواعيد"},
    "location": {"المكان"},
    "booking": {"الحجز"},
    "pricing": {"الأسعار", "الخصومات"},
    "contact": {"التواصل"},
    "quiz": {"الكويزات", "الامتحانات"},
    "teacher": {"المراحل"},
}


def _quick_prompt_kind(message: str) -> str | None:
    normalized = _normalize(message)
    if normalized in {
        _normalize("إيه معنى الكلمة دي؟"),
        _normalize("إيه معنى كلمة بالإنجليزي؟"),
        _normalize("معنى كلمة"),
        _normalize("what does this word mean"),
        _normalize("meaning of this word"),
    }:
        return "word"
    if normalized in {
        _normalize("اشرحلي قاعدة في الجرامر"),
        _normalize("اشرحلي قاعدة جرامر"),
        _normalize("explain a grammar rule"),
    }:
        return "grammar"
    return None


def _follow_up_kind(history: list) -> str | None:
    if not history or history[-1].role != "assistant":
        return None
    prompt = _normalize(history[-1].text)
    if prompt == _normalize(WORD_PROMPT):
        return "word"
    if prompt == _normalize(GRAMMAR_PROMPT):
        return "grammar"
    return None


def _local_topic(message: str) -> str | None:
    normalized = _normalize(message)
    for topic, terms in LOCAL_TERMS.items():
        if any(_normalize(term) in normalized for term in terms):
            return topic

    tokens = _tokens(message)
    if "السنتر" in tokens or "سنتر" in tokens or "مستر" in tokens:
        return "site"
    return None


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower().strip()
    text = re.sub(r"[إأآا]", "ا", text)
    text = text.replace("ى", "ي").replace("ة", "ه")
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())


def _tokens(text: str) -> set[str]:
    return {x for x in _normalize(text).split() if len(x) > 1}


def _best_knowledge(message: str, rows: list[ChatKnowledge]) -> ChatKnowledge | None:
    needle = _normalize(message)
    needle_tokens = _tokens(message)
    best: tuple[int, ChatKnowledge] | None = None
    for item in rows:
        question = _normalize(item.question)
        hay_tokens = _tokens(f"{item.question} {item.keywords} {item.category}")
        score = 0
        if needle == question:
            score += 100
        if question and question in needle:
            score += 35
        score += len(needle_tokens & hay_tokens) * 8
        if score and (best is None or score > best[0]):
            best = (score, item)
    return best[1] if best and best[0] >= 16 else None


def _latest_result(db: Session, user: User | None) -> str | None:
    if not user:
        return None
    attempt = db.scalar(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user.id, QuizAttempt.submitted_at.is_not(None))
        .options(selectinload(QuizAttempt.quiz))
        .order_by(QuizAttempt.submitted_at.desc())
    )
    if not attempt:
        return "لسه مفيش نتيجة اختبار مسجلة على حسابك. ادخل صفحة الكويزات وابدأ أول اختبار."
    extra = f"، ومستواك المبدئي {attempt.level_result}" if attempt.level_result else ""
    return f"آخر نتيجة مسجلة عندك في «{attempt.quiz.title_ar}» هي {attempt.score:g}%{extra}."


def _local_data_answer(message: str, topic: str, db: Session, user: User | None) -> str:
    if topic == "account":
        if not user:
            return "سجّل الدخول بحساب الطالب عشان تقدر تشوف بيانات حسابك ونتائجك."
        return f"حسابك مسجل باسم {user.first_name} {user.last_name} وبريد {user.email}."

    if topic == "quiz":
        if not user:
            return "سجّل الدخول بحساب الطالب عشان تشوف الاختبارات المتاحة لمرحلتك وصفك."
        quizzes = db.scalars(
            select(Quiz)
            .where(Quiz.is_published.is_(True), Quiz.is_archived.is_(False))
            .order_by(Quiz.id)
        ).all()
        now = datetime.now(timezone.utc)

        def is_available(quiz: Quiz) -> bool:
            starts_at = quiz.starts_at if not quiz.starts_at or quiz.starts_at.tzinfo else quiz.starts_at.replace(tzinfo=timezone.utc)
            ends_at = quiz.ends_at if not quiz.ends_at or quiz.ends_at.tzinfo else quiz.ends_at.replace(tzinfo=timezone.utc)
            return (
                (not starts_at or starts_at <= now)
                and (not ends_at or ends_at >= now)
                and (not quiz.stage or quiz.stage == user.stage)
                and (not quiz.education_type or quiz.education_type == user.education_type)
                and (not quiz.grade or quiz.grade == user.grade)
            )

        available = [quiz.title_ar for quiz in quizzes if is_available(quiz)]
        if not available:
            return "مفيش اختبارات منشورة متاحة لحسابك حاليًا."
        return "الاختبارات المتاحة لحسابك: " + "، ".join(available) + "."

    settings = {item.key: item.value for item in db.scalars(select(SiteSetting)).all()}

    # Core operational facts must always come from current site settings so
    # admin changes are reflected in the assistant immediately.
    setting_keys = {
        "hours": ("center_hours",),
        "location": ("center_address", "center_landmark"),
        "contact": ("primary_phone", "secondary_phone", "whatsapp", "contact_email"),
    }
    values = [settings[key] for key in setting_keys.get(topic, ()) if settings.get(key)]
    if values:
        return "، ".join(values)

    normalized = _normalize(message)
    if topic == "teacher" and not any(term in normalized for term in (_normalize("بيدرس"), _normalize("مراحل"), _normalize("مرحلة"))):
        name = settings.get("teacher_name_ar") or settings.get("teacher_name")
        if name:
            return f"الاسم المسجل للمستر هو {name}."

    if topic == "site" and any(term in normalized for term in ("الصيانه", "maintenance")):
        enabled = settings.get("maintenance_mode", "false").lower() == "true"
        answer = "وضع الصيانة مفعّل حاليًا." if enabled else "وضع الصيانة غير مفعّل حاليًا."
        maintenance_message = settings.get("maintenance_message", "") if enabled else ""
        return f"{answer} {maintenance_message}".strip()

    categories = KNOWLEDGE_CATEGORIES.get(topic)
    knowledge = db.scalars(select(ChatKnowledge).where(ChatKnowledge.is_active.is_(True))).all()
    candidates = [row for row in knowledge if not categories or row.category in categories]
    matched = _best_knowledge(message, candidates)
    if matched:
        return matched.answer
    if topic == "pricing":
        category = "الخصومات" if any(
            term in _normalize(message) for term in ("خصم", "خصومات", "discount")
        ) else "الأسعار"
        price_entry = next((row for row in candidates if row.category == category), None)
        if price_entry:
            return price_entry.answer

    return "مش لاقي المعلومة دي ضمن بيانات الموقع الحالية. تواصل مع مستر رائد للتأكد."


def _gemini_answer(
    message: str,
    instruction: str | None = None,
    history: list[AssistantHistoryItem] | None = None,
) -> str | None:
    settings = get_settings()
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return None
    if not api_key.isascii():
        logger.warning("Gemini API key contains non-ASCII characters; request was not sent")
        return None
    system = (
        "أنت مساعد تعليمي للطلاب. أجب بلغة عربية بسيطة، ويمكنك استخدام الإنجليزية إذا كان السؤال بالإنجليزية "
        "مع شرح عربي مختصر. لا تجب عن معلومات خاصة بمستر رائد أو السنتر مثل الأسعار أو المواعيد أو المكان أو الحجز "
        "أو التواصل؛ هذه المعلومات لا تأتي إلا من قاعدة بيانات الموقع."
    )
    if instruction:
        system = f"{system}\n{instruction}"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    contents = []
    for item in (history or [])[-8:]:
        role = "user" if item.role == "user" else "model"
        text = item.text.strip()
        if not text:
            continue
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += f"\n{text}"
        else:
            contents.append({"role": role, "parts": [{"text": text}]})
    while contents and contents[0]["role"] != "user":
        contents.pop(0)
    if contents and contents[-1]["role"] == "user":
        contents[-1]["parts"][0]["text"] += f"\n{message}"
    else:
        contents.append({"role": "user", "parts": [{"text": message}]})
    try:
        for attempt in range(2):
            response = httpx.post(
                url,
                headers={"x-goog-api-key": api_key},
                json={
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": contents,
                },
                timeout=12.0,
            )
            try:
                response.raise_for_status()
                break
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 503 or attempt == 1:
                    raise
                time.sleep(1)
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            logger.warning("Gemini returned an invalid response")
            return None
        candidates = data.get("candidates", [])
        if not isinstance(candidates, list) or not candidates or not isinstance(candidates[0], dict):
            logger.warning("Gemini returned no candidates")
            return None
        content = candidates[0].get("content", {})
        parts = content.get("parts", []) if isinstance(content, dict) else []
        text = "\n".join(str(part.get("text", "")).strip() for part in parts if part.get("text"))
        if not text.strip():
            logger.warning("Gemini returned an empty answer")
            return None
        return text.strip()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Gemini request failed (%s)", type(exc).__name__)
        return None


@router.post("/chat")
def chat(
    data: AssistantMessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    message = data.message.strip()
    normalized = _normalize(message)

    result_words = {"درجتي", "نتيجتي", "النتيجه", "الدرجة", "score", "result"}
    if any(word in normalized for word in result_words):
        if not user:
            return {"answer": "لازم تسجل دخول بحساب الطالب الأول عشان أقدر أجيب نتيجتك.", "source": "account"}
        return {"answer": _latest_result(db, user), "source": "account"}

    quick_prompt = _quick_prompt_kind(message)
    if quick_prompt:
        prompt = WORD_PROMPT if quick_prompt == "word" else GRAMMAR_PROMPT
        return {"answer": prompt, "source": "clarification"}

    local_topic = _local_topic(message)
    if local_topic:
        return {
            "answer": _local_data_answer(message, local_topic, db, user),
            "source": "local",
        }

    follow_up = _follow_up_kind(data.history)
    instruction = None
    gemini_message = message
    if follow_up == "word":
        instruction = (
            "اشرح الكلمة المطلوبة بالعربية، واذكر المعنى بالعربي والنطق إن أمكن ومثالًا بسيطًا بالإنجليزية "
            "وترجمة المثال."
        )
        gemini_message = f"اشرح معنى الكلمة التالية: {message}"
    elif follow_up == "grammar":
        instruction = "اشرح القاعدة أو السؤال التعليمي ببساطة بالعربية، مع أمثلة قصيرة عند الحاجة."
        gemini_message = f"اشرح القاعدة أو السؤال التالي: {message}"
    elif any(
        _normalize(phrase) in normalized
        for phrase in ("معنى كلمة", "معنى الكلمة", "translate", "ترجم", "ترجمة")
    ):
        instruction = (
            "إذا كان السؤال عن كلمة إنجليزية، اذكر معناها بالعربية والنطق إن أمكن ومثالًا بسيطًا بالإنجليزية "
            "وترجمة المثال. وإذا كان طلب ترجمة، قدم الترجمة واشرح أي تعبير غير مباشر باختصار."
        )
    elif any(
        _normalize(phrase) in normalized
        for phrase in ("جرامر", "grammar", "present perfect")
    ):
        instruction = "اشرح القاعدة ببساطة بالعربية، مع مثال أو مثالين قصيرين وترجمتهما."

    answer = _gemini_answer(gemini_message, instruction, data.history)
    if answer:
        return {"answer": answer, "source": "gemini"}
    return {"answer": GEMINI_UNAVAILABLE, "source": "gemini_unavailable"}
