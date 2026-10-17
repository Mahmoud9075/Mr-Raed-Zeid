import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite:///./test_raed.db"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-local-automated-tests-only"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "StrongAdmin1"
os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = "10000"
os.environ["RATE_LIMIT_PER_MINUTE"] = "10000"
os.environ["ASSISTANT_RATE_LIMIT_PER_MINUTE"] = "10000"
from fastapi.testclient import TestClient
from app.main import app
from app.db import SessionLocal
from app.models import ChatKnowledge, Question, Quiz, SitePage, SiteSetting
from app.seed import QUESTIONS, run_quiz_seed, run_seed
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.routers import assistant as assistant_router

run_seed()
client = TestClient(app)


def student_headers():
    test_id = uuid4().hex
    email = f"student-{test_id}@test.com"
    client.post('/api/v1/auth/register', json={
        'first_name':'Test','last_name':'Student','email':email,'phone':str(uuid4().int)[:15],
        'guardian_phone':'01033334444','stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي','password':'StrongPass1'
    })
    login = client.post('/api/v1/auth/login', json={'identifier':email,'password':'StrongPass1'})
    assert login.status_code == 200
    return {'Authorization':'Bearer '+login.json()['access_token']}


def owner_headers():
    login = client.post('/api/v1/auth/login', json={'identifier':'admin@test.com','password':'StrongAdmin1'})
    assert login.status_code == 200
    return {'Authorization':'Bearer '+login.json()['access_token']}




def test_admin_api_rejects_anonymous_and_student():
    assert client.get('/api/v1/admin/dashboard').status_code == 401
    student = student_headers()
    assert client.get('/api/v1/admin/dashboard', headers=student).status_code == 403




def test_assistant_requires_signed_in_account():
    fresh_client = TestClient(app)
    anonymous = fresh_client.post('/api/v1/assistant/chat', json={'message':'مواعيد السنتر إيه؟'})
    assert anonymous.status_code == 401

    h = student_headers()
    signed_in = client.post('/api/v1/assistant/chat', headers=h, json={'message':'مواعيد السنتر إيه؟'})
    assert signed_in.status_code == 200
    assert signed_in.json()['source'] == 'local'

def test_health_and_quiz_count():
    assert client.get('/api/v1/health').status_code == 200
    h = student_headers()
    quizzes = client.get('/api/v1/quizzes', headers=h).json()
    assert quizzes[0]['question_count'] == 50


def test_placement_seed_is_additive_and_idempotent():
    db = SessionLocal()
    quiz = db.scalar(
        select(Quiz)
        .where(Quiz.slug == 'english-placement-50')
        .options(selectinload(Quiz.questions).selectinload(Question.choices))
    )
    assert quiz is not None
    original_title = quiz.title_ar
    original_duration = quiz.duration_minutes
    quiz.title_ar = 'Admin-edited placement title'
    quiz.duration_minutes = 47
    edited_question = next(question for question in quiz.questions if question.prompt == QUESTIONS[0][1])
    original_prompt = edited_question.prompt
    edited_question.prompt = 'Admin-edited placement question'
    manual_placement_question = Question(
        quiz_id=quiz.id,
        prompt='Admin-created placement question',
        position=max(question.position for question in quiz.questions) + 1,
    )
    db.add(manual_placement_question)
    custom_quiz = Quiz(slug='admin-created-quiz', title_ar='Admin quiz')
    db.add(custom_quiz)
    db.flush()
    custom_question = Question(
        quiz_id=custom_quiz.id,
        prompt='Admin-created question',
        position=1,
    )
    db.add(custom_question)
    db.commit()

    try:
        run_quiz_seed()
        run_quiz_seed()
        db.expire_all()
        quiz = db.scalar(
            select(Quiz)
            .where(Quiz.slug == 'english-placement-50')
            .options(selectinload(Quiz.questions).selectinload(Question.choices))
        )
        assert quiz is not None
        assert quiz.title_ar == 'Admin-edited placement title'
        assert quiz.duration_minutes == 47
        assert any(question.prompt == 'Admin-edited placement question' for question in quiz.questions)
        assert any(question.prompt == 'Admin-created placement question' for question in quiz.questions)
        seeded_question = next(question for question in quiz.questions if question.prompt == QUESTIONS[0][1])
        assert len(seeded_question.choices) == len(QUESTIONS[0][2])
        assert db.scalar(select(Quiz).where(Quiz.slug == 'admin-created-quiz')) is not None
        assert db.scalar(select(Question).where(Question.id == custom_question.id)) is not None
    finally:
        quiz = db.scalar(
            select(Quiz)
            .where(Quiz.slug == 'english-placement-50')
            .options(selectinload(Quiz.questions))
        )
        for question in list(quiz.questions):
            if question.prompt in {QUESTIONS[0][1], 'Admin-created placement question'}:
                db.delete(question)
            elif question.prompt == 'Admin-edited placement question':
                question.prompt = original_prompt
        quiz.title_ar = original_title
        quiz.duration_minutes = original_duration
        db.delete(db.scalar(select(Quiz).where(Quiz.slug == 'admin-created-quiz')))
        db.commit()
        db.close()


def test_full_seed_backfills_site_data_and_preserves_admin_edits():
    db = SessionLocal()
    hours = db.get(SiteSetting, 'center_hours')
    phone = db.get(SiteSetting, 'secondary_phone')
    home_page = db.scalar(select(SitePage).where(SitePage.slug == 'home'))
    booking = db.scalar(select(ChatKnowledge).where(ChatKnowledge.question == 'أحجز إزاي؟'))
    missing_page = db.scalar(select(SitePage).where(SitePage.slug == 'honors'))
    assert hours is not None and phone is not None and home_page is not None and booking is not None and missing_page is not None
    original_hours = hours.value
    original_phone = phone.value
    original_page = (home_page.title, home_page.path)
    original_booking = booking.answer
    db.delete(phone)
    db.delete(missing_page)
    hours.value = 'مواعيد معدلة من الأدمن'
    home_page.title = 'عنوان رئيسية مخصص من الأدمن'
    home_page.path = '/admin-configured-home'
    booking.answer = 'معلومة الحجز المعدلة من الأدمن'
    db.commit()

    try:
        run_seed()
        db.expire_all()
        settings = client.get('/api/v1/site-settings').json()
        navigation = client.get('/api/v1/navigation').json()
        assert settings['center_hours'] == 'مواعيد معدلة من الأدمن'
        assert settings['secondary_phone'] == original_phone
        assert navigation
        assert any(page['slug'] == 'honors' for page in navigation)
        assert any(
            page['slug'] == 'home'
            and page['title'] == 'عنوان رئيسية مخصص من الأدمن'
            and page['path'] == '/admin-configured-home'
            for page in navigation
        )

        headers = student_headers()
        hours_response = client.post(
            '/api/v1/assistant/chat',
            headers=headers,
            json={'message': 'مواعيد السنتر إيه؟'},
        )
        booking_response = client.post(
            '/api/v1/assistant/chat',
            headers=headers,
            json={'message': 'إزاي أحجز؟'},
        )
        assert hours_response.json()['answer'] == 'مواعيد معدلة من الأدمن'
        assert booking_response.json()['answer'] == 'معلومة الحجز المعدلة من الأدمن'
    finally:
        db.expire_all()
        hours = db.get(SiteSetting, 'center_hours')
        phone = db.get(SiteSetting, 'secondary_phone')
        home_page = db.scalar(select(SitePage).where(SitePage.slug == 'home'))
        booking = db.scalar(select(ChatKnowledge).where(ChatKnowledge.question == 'أحجز إزاي؟'))
        if hours:
            hours.value = original_hours
        if phone:
            phone.value = original_phone
        if home_page:
            home_page.title, home_page.path = original_page
        if booking:
            booking.answer = original_booking
        db.commit()
        run_seed()
        db.close()


def test_student_full_quiz_flow():
    h = student_headers()
    start=client.post('/api/v1/quizzes/english-placement-50/start',headers=h)
    assert start.status_code == 200 and len(start.json()['questions']) == 50
    data=start.json(); answers=[{'question_id':q['id'],'choice_id':q['choices'][0]['id']} for q in data['questions']]
    result=client.post(f"/api/v1/quizzes/attempts/{data['attempt_id']}/submit",headers=h,json={'answers':answers})
    assert result.status_code == 200 and result.json()['total_questions'] == 50


def test_profile_update():
    h = student_headers()
    r=client.put('/api/v1/auth/profile',headers=h,json={
        'first_name':'Test','last_name':'Student','guardian_phone':'01055556666','stage':'إعدادي',
        'education_type':'عام','grade':'الصف الثالث الإعدادي','school_name':'مدرسة تجريبية'
    })
    assert r.status_code == 200
    assert r.json()['grade'] == 'الصف الثالث الإعدادي'


def test_review_is_moderated():
    r=client.post('/api/v1/reviews',json={'display_name':'طالب','student_stage':'ثانوي عام','rating':5,'body':'تقييم حقيقي بعد الاستخدام'})
    assert r.status_code == 201 and r.json()['status']=='pending'
    public=client.get('/api/v1/reviews').json()
    assert all(x['id'] != r.json()['id'] for x in public)


def test_owner_can_toggle_maintenance_and_knowledge_works():
    h=owner_headers()
    r=client.put('/api/v1/admin/site-settings',headers=h,json={'maintenance_mode':True})
    assert r.status_code == 200
    settings=client.get('/api/v1/site-settings').json()
    assert settings['maintenance_mode']=='true'
    # restore it for repeatable local runs
    client.put('/api/v1/admin/site-settings',headers=h,json={'maintenance_mode':False})


def test_assistant_uses_local_data_before_gemini(monkeypatch):
    def unexpected_gemini_call(*args, **kwargs):
        raise AssertionError("Local questions must not be sent to Gemini")

    monkeypatch.setattr(assistant_router, "_gemini_answer", unexpected_gemini_call)
    questions = (
        ("فين مكان السنتر؟", "سنتر إبداع"),
        ("مواعيد السنتر إيه؟", "8 صباحًا"),
        ("إزاي أحجز؟", "تقدر تحجز أونلاين"),
        ("الأسعار؟", "150 جنيه"),
        ("بيانات مستر رائد؟", "مستر رائد زيد"),
        ("المستر بيدرس أنهي مراحل؟", "ثانوي أزهري"),
        ("حسابي على الموقع؟", "admin@test.com"),
        ("الكويزات المتاحة؟", "اختبارات"),
        ("وضع الصيانة الحالي؟", "وضع الصيانة غير مفعّل"),
    )
    for question, expected_text in questions:
        response = client.post("/api/v1/assistant/chat", json={"message": question})
        assert response.status_code == 200
        assert response.json()["source"] == "local"
        assert expected_text in response.json()["answer"]


def test_assistant_sends_educational_questions_to_gemini(monkeypatch):
    calls = []
    monkeypatch.setattr(
        assistant_router,
        "get_settings",
        lambda: type("Settings", (), {"gemini_api_key": "test-key", "gemini_model": "test-model"})(),
    )

    class GeminiResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Gemini test answer"}]}}]}

    def fake_gemini_request(url, **kwargs):
        calls.append((url, kwargs))
        return GeminiResponse()

    monkeypatch.setattr(assistant_router.httpx, "post", fake_gemini_request)
    questions = (
        "معنى كلمة beautiful",
        "يعني اي beautiful؟",
        "اشرحلي Present Perfect",
        "صحح الجملة I goes to school",
    )
    for question in questions:
        response = client.post("/api/v1/assistant/chat", json={"message": question})
        assert response.status_code == 200
        assert response.json() == {"answer": "Gemini test answer", "source": "gemini"}

    assert len(calls) == len(questions)
    for url, kwargs in calls:
        assert url.endswith("/test-model:generateContent")
        assert kwargs["headers"]["x-goog-api-key"] == "test-key"
        assert "key" not in kwargs.get("params", {})
        assert kwargs["timeout"] == 12.0
    assert "معناها بالعربية" in calls[0][1]["json"]["systemInstruction"]["parts"][0]["text"]
    assert "اشرح القاعدة" in calls[2][1]["json"]["systemInstruction"]["parts"][0]["text"]


def test_assistant_quick_prompts_ask_for_clarification_then_use_gemini(monkeypatch):
    calls = []
    monkeypatch.setattr(
        assistant_router,
        "get_settings",
        lambda: type("Settings", (), {"gemini_api_key": "test-key", "gemini_model": "test-model"})(),
    )

    class GeminiResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Gemini test answer"}]}}]}

    def fake_gemini_request(url, **kwargs):
        calls.append(kwargs)
        return GeminiResponse()

    monkeypatch.setattr(assistant_router.httpx, "post", fake_gemini_request)
    word_prompt = client.post(
        "/api/v1/assistant/chat",
        json={"message": "إيه معنى الكلمة دي؟"},
    ).json()
    grammar_prompt = client.post(
        "/api/v1/assistant/chat",
        json={"message": "اشرحلي قاعدة في الجرامر"},
    ).json()
    assert word_prompt == {
        "answer": "اكتبلي الكلمة اللي عايز تعرف معناها.",
        "source": "clarification",
    }
    assert grammar_prompt == {
        "answer": "اكتبلي اسم القاعدة أو السؤال اللي محتاج شرحه.",
        "source": "clarification",
    }
    assert calls == []

    follow_up = client.post(
        "/api/v1/assistant/chat",
        json={
            "message": "beautiful",
            "history": [{"role": "assistant", "text": word_prompt["answer"]}],
        },
    )
    assert follow_up.status_code == 200
    assert follow_up.json()["source"] == "gemini"
    assert calls[0]["json"]["contents"] == [
        {"role": "user", "parts": [{"text": "اشرح معنى الكلمة التالية: beautiful"}]},
    ]
    assert "النطق إن أمكن" in calls[0]["json"]["systemInstruction"]["parts"][0]["text"]

    grammar_follow_up = client.post(
        "/api/v1/assistant/chat",
        json={
            "message": "Present Perfect",
            "history": [{"role": "assistant", "text": grammar_prompt["answer"]}],
        },
    )
    assert grammar_follow_up.status_code == 200
    assert grammar_follow_up.json()["source"] == "gemini"
    assert "Present Perfect" in calls[1]["json"]["contents"][-1]["parts"][0]["text"]


def test_assistant_passes_recent_conversation_to_gemini(monkeypatch):
    calls = []
    monkeypatch.setattr(
        assistant_router,
        "get_settings",
        lambda: type("Settings", (), {"gemini_api_key": "test-key", "gemini_model": "test-model"})(),
    )

    class GeminiResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Gemini test answer"}]}}]}

    def fake_gemini_request(url, **kwargs):
        calls.append(kwargs)
        return GeminiResponse()

    monkeypatch.setattr(assistant_router.httpx, "post", fake_gemini_request)
    response = client.post(
        "/api/v1/assistant/chat",
        json={
            "message": "صحح الجملة باستخدام القاعدة دي",
            "history": [
                {"role": "user", "text": "اشرحلي Present Perfect"},
                {"role": "assistant", "text": "نستخدمها للحديث عن تجربة حتى الآن."},
            ],
        },
    )

    assert response.status_code == 200
    contents = calls[0]["json"]["contents"]
    assert contents == [
        {"role": "user", "parts": [{"text": "اشرحلي Present Perfect"}]},
        {"role": "model", "parts": [{"text": "نستخدمها للحديث عن تجربة حتى الآن."}]},
        {"role": "user", "parts": [{"text": "صحح الجملة باستخدام القاعدة دي"}]},
    ]


def test_assistant_drops_leading_greeting_from_gemini_history(monkeypatch):
    calls = []
    monkeypatch.setattr(
        assistant_router,
        "get_settings",
        lambda: type("Settings", (), {"gemini_api_key": "test-key", "gemini_model": "test-model"})(),
    )

    class GeminiResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Gemini test answer"}]}}]}

    def fake_gemini_request(url, **kwargs):
        calls.append(kwargs)
        return GeminiResponse()

    monkeypatch.setattr(assistant_router.httpx, "post", fake_gemini_request)
    response = client.post(
        "/api/v1/assistant/chat",
        json={
            "message": "معنى كلمة beautiful",
            "history": [
                {"role": "assistant", "text": "أهلًا! أنا مساعد مستر رائد."},
                {"role": "user", "text": "مواعيد السنتر إيه؟"},
                {"role": "assistant", "text": "السنتر شغال من 8 صباحًا."},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["source"] == "gemini"
    assert calls[0]["json"]["contents"] == [
        {"role": "user", "parts": [{"text": "مواعيد السنتر إيه؟"}]},
        {"role": "model", "parts": [{"text": "السنتر شغال من 8 صباحًا."}]},
        {"role": "user", "parts": [{"text": "معنى كلمة beautiful"}]},
    ]


def test_assistant_returns_friendly_error_when_gemini_is_unavailable(monkeypatch):
    calls = []

    monkeypatch.setattr(
        assistant_router,
        "get_settings",
        lambda: type("Settings", (), {"gemini_api_key": "", "gemini_model": "test-model"})(),
    )

    def unexpected_gemini_request(*args, **kwargs):
        calls.append((args, kwargs))
        raise AssertionError("Gemini must not be called when the API key is missing")

    monkeypatch.setattr(assistant_router.httpx, "post", unexpected_gemini_request)
    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "معنى كلمة beautiful"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "answer": "مش قادر أوصل للمساعد الذكي دلوقتي، جرّب كمان شوية.",
        "source": "gemini_unavailable",
    }
    assert calls == []


def test_assistant_handles_gemini_timeout_without_failing_request(monkeypatch):
    monkeypatch.setattr(
        assistant_router,
        "get_settings",
        lambda: type("Settings", (), {"gemini_api_key": "test-key", "gemini_model": "test-model"})(),
    )

    def timeout(*args, **kwargs):
        raise assistant_router.httpx.TimeoutException("request timed out")

    monkeypatch.setattr(assistant_router.httpx, "post", timeout)
    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "اشرحلي Present Perfect"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "answer": "مش قادر أوصل للمساعد الذكي دلوقتي، جرّب كمان شوية.",
        "source": "gemini_unavailable",
    }



def test_quiz_resume_autosave_and_idempotent_submit():
    h = student_headers()
    first = client.post('/api/v1/quizzes/english-placement-50/start', headers=h)
    assert first.status_code == 200
    data = first.json()
    q0 = data['questions'][0]
    saved = client.put(
        f"/api/v1/quizzes/attempts/{data['attempt_id']}/answers",
        headers=h,
        json={'answers':[{'question_id':q0['id'],'choice_id':q0['choices'][0]['id']}]},
    )
    assert saved.status_code == 200 and saved.json()['saved'] is True

    resumed = client.post('/api/v1/quizzes/english-placement-50/start', headers=h)
    assert resumed.status_code == 200
    resumed_data = resumed.json()
    assert resumed_data['attempt_id'] == data['attempt_id']
    assert resumed_data['resumed'] is True
    assert any(x['question_id'] == q0['id'] for x in resumed_data['saved_answers'])

    answers = [
        {'question_id':q['id'],'choice_id':q['choices'][0]['id']}
        for q in resumed_data['questions']
    ]
    result = client.post(
        f"/api/v1/quizzes/attempts/{data['attempt_id']}/submit",
        headers=h,
        json={'answers':answers},
    )
    assert result.status_code == 200
    duplicate = client.post(
        f"/api/v1/quizzes/attempts/{data['attempt_id']}/submit",
        headers=h,
        json={'answers':answers},
    )
    assert duplicate.status_code == 200
    assert duplicate.json() == result.json()


def test_admin_results_excel_and_manual_essay_grading():
    owner = owner_headers()
    slug = f"essay-{uuid4().hex[:12]}"
    created = client.post('/api/v1/admin/quizzes', headers=owner, json={
        'slug':slug,'title_ar':'اختبار مقالي آلي','title_en':'','description_ar':'اختبار للتأكد من التصحيح',
        'stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي','duration_minutes':20,
        'passing_score':60,'max_attempts':2,'randomize_questions':False,'show_result_immediately':True,
        'is_published':False,'is_placement':False,
    })
    assert created.status_code == 201
    quiz_id = created.json()['id']
    question = client.post(f'/api/v1/admin/quizzes/{quiz_id}/questions', headers=owner, json={
        'prompt':'اكتب فقرة قصيرة عن يومك','explanation':'','level':'A1','question_type':'essay',
        'expected_answer':None,'position':1,'points':5,'choices':[],
    })
    assert question.status_code == 201
    assert client.patch(f'/api/v1/admin/quizzes/{quiz_id}/publish?published=true', headers=owner).status_code == 200

    student = student_headers()
    start = client.post(f'/api/v1/quizzes/{slug}/start', headers=student)
    assert start.status_code == 200
    qid = start.json()['questions'][0]['id']
    attempt_id = start.json()['attempt_id']
    submitted = client.post(
        f'/api/v1/quizzes/attempts/{attempt_id}/submit', headers=student,
        json={'answers':[{'question_id':qid,'text_answer':'I study English every day.'}]},
    )
    assert submitted.status_code == 200
    assert submitted.json()['needs_manual_review'] is True

    details = client.get(f'/api/v1/admin/results/{attempt_id}', headers=owner)
    assert details.status_code == 200
    answer_id = details.json()['answers'][0]['answer_id']
    grade = client.patch(
        f'/api/v1/admin/results/answers/{answer_id}/grade', headers=owner,
        json={'awarded_points':5},
    )
    assert grade.status_code == 200
    assert grade.json()['score'] == 100.0
    assert grade.json()['needs_manual_review'] is False

    export = client.get('/api/v1/admin/results-export.xlsx', headers=owner)
    assert export.status_code == 200
    assert export.headers['content-type'].startswith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    assert export.content[:2] == b'PK'


def test_assistant_uses_latest_site_setting_not_seeded_stale_answer(monkeypatch):
    owner = owner_headers()
    updated = 'كل يوم من 9 صباحًا حتى 7 مساءً'
    assert client.put('/api/v1/admin/site-settings', headers=owner, json={'center_hours':updated}).status_code == 200

    def unexpected_gemini_call(*args, **kwargs):
        raise AssertionError('Current center settings must be answered locally')
    monkeypatch.setattr(assistant_router, '_gemini_answer', unexpected_gemini_call)
    response = client.post('/api/v1/assistant/chat', json={'message':'مواعيد السنتر إيه؟'})
    assert response.status_code == 200
    assert response.json()['source'] == 'local'
    assert '9 صباحًا' in response.json()['answer']

    # Restore canonical local test value for the older assistant test on repeat runs.
    client.put('/api/v1/admin/site-settings', headers=owner, json={'center_hours':'السنتر شغال من 8 صباحًا حتى 8 مساءً'}).raise_for_status()


def test_search_does_not_leak_ineligible_quiz():
    owner = owner_headers()
    slug = f"private-{uuid4().hex[:12]}"
    title = f"اختبار أزهري {uuid4().hex[:6]}"
    created = client.post('/api/v1/admin/quizzes', headers=owner, json={
        'slug':slug,'title_ar':title,'title_en':'','description_ar':'خاص بالأزهري','stage':'ثانوي',
        'education_type':'أزهري','grade':'الصف الأول الثانوي','duration_minutes':10,'passing_score':60,
        'max_attempts':1,'randomize_questions':False,'show_result_immediately':True,'is_published':False,'is_placement':False,
    })
    assert created.status_code == 201
    quiz_id = created.json()['id']
    q = client.post(f'/api/v1/admin/quizzes/{quiz_id}/questions', headers=owner, json={
        'prompt':'Choose','explanation':'','level':'A1','question_type':'mcq','expected_answer':None,
        'position':1,'points':1,'choices':[['A',True],['B',False]],
    })
    assert q.status_code == 201
    assert client.patch(f'/api/v1/admin/quizzes/{quiz_id}/publish?published=true', headers=owner).status_code == 200

    student = student_headers()  # General education, not Azhar.
    search = client.get('/api/v1/search', headers=student, params={'q':title})
    assert search.status_code == 200
    assert not any(item.get('href') == f'/quizzes/{slug}' for item in search.json())
    assert client.post(f'/api/v1/quizzes/{slug}/start', headers=student).status_code == 403


def test_message_workflow_and_profile_upload_spoof_rejected():
    created = client.post('/api/v1/contact', json={'name':'طالب اختبار','phone':'01012345678','message':'رسالة متابعة للاختبار'})
    assert created.status_code == 201
    owner = owner_headers()
    messages = client.get('/api/v1/admin/messages', headers=owner)
    assert messages.status_code == 200
    message = next(x for x in messages.json() if x['phone'] == '01012345678')
    changed = client.patch(f"/api/v1/admin/messages/{message['id']}", headers=owner, json={'status':'followed_up'})
    assert changed.status_code == 200 and changed.json()['status'] == 'followed_up'

    student = student_headers()
    fake = client.post(
        '/api/v1/auth/profile/image', headers=student,
        files={'file':('fake.png', b'<script>alert(1)</script>', 'image/png')},
    )
    assert fake.status_code == 415


def test_audit_log_is_owner_only():
    student = student_headers()
    assert client.get('/api/v1/admin/audit', headers=student).status_code == 403
    owner = owner_headers()
    response = client.get('/api/v1/admin/audit?page_size=5', headers=owner)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
