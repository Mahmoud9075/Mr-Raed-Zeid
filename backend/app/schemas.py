from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator

STAGES = ["إعدادي", "ثانوي", "كورسات للكبار"]


class RegisterIn(BaseModel):
    first_name: str = Field(min_length=2, max_length=80)
    last_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=32)
    guardian_phone: str | None = Field(default=None, max_length=32)
    stage: str | None = Field(default=None, max_length=80)
    education_type: str | None = Field(default=None, max_length=80)
    grade: str | None = Field(default=None, max_length=80)
    school_name: str | None = Field(default=None, max_length=180)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("stage")
    @classmethod
    def valid_stage(cls, v):
        if v and v not in STAGES:
            raise ValueError("المرحلة غير مدعومة")
        return v


class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=190)
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str | None = Field(default=None, max_length=4096)


class AdminOtpVerifyIn(BaseModel):
    challenge_id: int
    code: str = Field(pattern=r"^[0-9]{6}$")


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    guardian_phone: str | None = None
    stage: str | None = None
    education_type: str | None = None
    grade: str | None = None
    school_name: str | None = None
    profile_image: str | None = None
    role: str
    is_active: bool = True
    model_config = {"from_attributes": True}


class ProfileUpdateIn(BaseModel):
    first_name: str = Field(min_length=2, max_length=80)
    last_name: str = Field(min_length=2, max_length=80)
    guardian_phone: str | None = Field(default=None, max_length=32)
    stage: str | None = Field(default=None, max_length=80)
    education_type: str | None = Field(default=None, max_length=80)
    grade: str | None = Field(default=None, max_length=80)
    school_name: str | None = Field(default=None, max_length=180)

    @field_validator("stage")
    @classmethod
    def valid_stage(cls, v):
        if v and v not in STAGES:
            raise ValueError("المرحلة غير مدعومة")
        return v


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ChoiceOut(BaseModel):
    id: int
    text: str
    position: int
    model_config = {"from_attributes": True}


class QuestionOut(BaseModel):
    id: int
    prompt: str
    level: str
    position: int
    question_type: str
    choices: list[ChoiceOut]
    model_config = {"from_attributes": True}


class QuizSummaryOut(BaseModel):
    id: int
    slug: str
    title_ar: str
    title_en: str
    description_ar: str
    duration_minutes: int
    question_count: int
    stage: str | None = None
    education_type: str | None = None
    grade: str | None = None
    max_attempts: int = 2


class SavedAnswerOut(BaseModel):
    question_id: int
    choice_id: int | None = None
    text_answer: str | None = None


class QuizStartOut(BaseModel):
    attempt_id: int
    quiz: QuizSummaryOut
    questions: list[QuestionOut]
    remaining_seconds: int
    resumed: bool = False
    saved_answers: list[SavedAnswerOut] = Field(default_factory=list)


class AnswerIn(BaseModel):
    question_id: int
    choice_id: int | None = None
    text_answer: str | None = Field(default=None, max_length=10000)


class SubmitAttemptIn(BaseModel):
    answers: list[AnswerIn] = Field(default_factory=list, max_length=200)


class SaveAttemptIn(BaseModel):
    answers: list[AnswerIn] = Field(default_factory=list, max_length=200)


class AttemptResultOut(BaseModel):
    attempt_id: int
    score: float
    correct_answers: int
    total_questions: int
    level_result: str | None = None
    needs_manual_review: bool = False


class ReviewIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=120)
    student_stage: str = Field(min_length=2, max_length=80)
    rating: int = Field(ge=1, le=5)
    body: str = Field(min_length=5, max_length=1200)


class ReviewOut(ReviewIn):
    id: int
    status: str
    model_config = {"from_attributes": True}


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=32)
    message: str = Field(min_length=5, max_length=2000)


class QuizCreateIn(BaseModel):
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")
    title_ar: str = Field(min_length=2, max_length=200)
    title_en: str = Field(default="", max_length=200)
    description_ar: str = Field(default="", max_length=5000)
    description_en: str = Field(default="", max_length=5000)
    stage: str | None = Field(default=None, max_length=80)
    education_type: str | None = Field(default=None, max_length=80)
    grade: str | None = Field(default=None, max_length=80)
    duration_minutes: int = Field(default=30, ge=1, le=240)
    passing_score: int = Field(default=60, ge=0, le=100)
    max_attempts: int = Field(default=2, ge=1, le=20)
    randomize_questions: bool = False
    show_result_immediately: bool = True
    is_published: bool = False
    is_placement: bool = False


class QuestionCreateIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=10000)
    explanation: str = Field(default="", max_length=10000)
    level: str = Field(default="A1", max_length=10)
    question_type: str = "mcq"
    expected_answer: str | None = Field(default=None, max_length=10000)
    position: int = Field(ge=1)
    points: int = Field(ge=1, le=20)
    choices: list[tuple[str, bool]] = Field(default_factory=list, max_length=10)

    @field_validator("question_type")
    @classmethod
    def type_valid(cls, v):
        if v not in {"mcq", "true_false", "short", "essay"}:
            raise ValueError("نوع السؤال غير مدعوم")
        return v

    @field_validator("choices")
    @classmethod
    def choices_valid(cls, v, info):
        if any(not text.strip() or len(text) > 500 for text, _ in v):
            raise ValueError("نص الاختيار يجب أن يكون بين 1 و500 حرف")
        qtype = info.data.get("question_type", "mcq")
        if qtype in {"mcq", "true_false"} and (len(v) < 2 or sum(1 for _, ok in v if ok) != 1):
            raise ValueError("السؤال الاختياري يحتاج اختيارين على الأقل وإجابة صحيحة واحدة")
        return v


class SitePageIn(BaseModel):
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=180)
    path: str = Field(min_length=1, max_length=220)
    is_visible: bool = True
    sort_order: int = Field(default=0, ge=-10000, le=10000)
    content_json: str = Field(default="{}", max_length=100000)


class SiteSettingsIn(BaseModel):
    maintenance_mode: bool | None = None
    maintenance_message: str | None = Field(default=None, max_length=1000)
    primary_phone: str | None = Field(default=None, max_length=32)
    secondary_phone: str | None = Field(default=None, max_length=32)
    whatsapp: str | None = Field(default=None, max_length=32)
    contact_email: str | None = Field(default=None, max_length=190)
    center_hours: str | None = Field(default=None, max_length=500)
    center_address: str | None = Field(default=None, max_length=1000)
    stage_primary_enabled: bool | None = None
    stage_prep_enabled: bool | None = None
    stage_secondary_enabled: bool | None = None
    stage_university_enabled: bool | None = None
    stage_adults_enabled: bool | None = None


class NotificationIn(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    body: str = Field(min_length=1, max_length=5000)
    stage: str | None = Field(default=None, max_length=80)
    education_type: str | None = Field(default=None, max_length=80)
    grade: str | None = Field(default=None, max_length=80)
    user_id: int | None = None


class AdminInviteIn(BaseModel):
    email: EmailStr
    role: str = "admin"


class AdminInviteAcceptIn(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    first_name: str = Field(min_length=2, max_length=80)
    last_name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=8, max_length=32)
    password: str = Field(min_length=8, max_length=128)


class ChatKnowledgeIn(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=2, max_length=1000)
    answer: str = Field(min_length=1, max_length=5000)
    keywords: str = Field(default="", max_length=1500)


class AssistantHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=2000)


class AssistantMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[AssistantHistoryItem] = Field(default_factory=list, max_length=12)


class ManualGradeIn(BaseModel):
    awarded_points: float = Field(ge=0)


class KnowledgeUpdateIn(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=80)
    question: str | None = Field(default=None, min_length=2, max_length=1000)
    answer: str | None = Field(default=None, min_length=1, max_length=5000)
    keywords: str | None = Field(default=None, max_length=1500)
    is_active: bool | None = None


class MessageStatusIn(BaseModel):
    status: Literal["new", "followed_up", "closed"]
