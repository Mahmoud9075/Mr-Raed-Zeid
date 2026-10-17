import asyncio
import os
from datetime import datetime, timedelta, timezone
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
from app.seed import run_seed
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


def test_production_startup_seeds_missing_assistant_data(monkeypatch, tmp_path):
    import app.main as main_module
    from sqlalchemy import select
    from app.db import SessionLocal
    from app.models import ChatKnowledge, SiteSetting

    db = SessionLocal()
    try:
        hours = db.scalar(select(SiteSetting).where(SiteSetting.key == "center_hours"))
        knowledge = db.scalar(select(ChatKnowledge).where(ChatKnowledge.category == "الحجز"))
        if hours:
            db.delete(hours)
        if knowledge:
            db.delete(knowledge)
        db.commit()
    finally:
        db.close()

    class ProductionSettings:
        env = "production"
        upload_dir = str(tmp_path / "uploads")

        @staticmethod
        def validate_production():
            return None

    monkeypatch.setattr(main_module, "settings", ProductionSettings())

    async def start_application():
        async with main_module.lifespan(main_module.app):
            pass

    asyncio.run(start_application())

    db = SessionLocal()
    try:
        assert db.scalar(select(SiteSetting).where(SiteSetting.key == "center_hours"))
        assert db.scalar(select(ChatKnowledge).where(ChatKnowledge.category == "الحجز"))
    finally:
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
    assert "اشرح القاعدة" in calls[1][1]["json"]["systemInstruction"]["parts"][0]["text"]


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
    assert "المعنى بالعربي ومثالًا بسيطًا" in calls[0]["json"]["systemInstruction"]["parts"][0]["text"]
    assert "النطق" not in calls[0]["json"]["systemInstruction"]["parts"][0]["text"]

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


def test_forgot_password_code_resets_password_and_revokes_old_login():
    test_id = uuid4().hex
    email = f"reset-{test_id}@test.com"
    phone = str(uuid4().int)[:15]
    created = client.post('/api/v1/auth/register', json={
        'first_name':'Reset','last_name':'Student','email':email,'phone':phone,
        'guardian_phone':'01033334444','stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي','password':'StrongPass1'
    })
    assert created.status_code == 201
    request = client.post('/api/v1/auth/forgot-password', json={'email': email})
    assert request.status_code == 200
    code = request.json().get('dev_code')
    assert code and len(code) == 6
    reset = client.post('/api/v1/auth/reset-password', json={'email': email, 'code': code, 'new_password':'NewStrongPass2'})
    assert reset.status_code == 200
    assert client.post('/api/v1/auth/login', json={'identifier':email,'password':'StrongPass1'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'identifier':email,'password':'NewStrongPass2'}).status_code == 200


def test_authorized_admin_email_otp_pin_and_permissions():
    owner = owner_headers()
    email = 'm47662266@gmail.com'
    request = client.post('/api/v1/auth/admin-email/request', json={'email': email})
    assert request.status_code == 200
    code = request.json().get('dev_code')
    assert code and len(code) == 6
    verified = client.post('/api/v1/auth/admin-email/verify', json={'email': email, 'code': code})
    assert verified.status_code == 200
    admin_token = verified.json()['access_token']
    admin_headers = {'Authorization': 'Bearer ' + admin_token}
    me = client.get('/api/v1/auth/me', headers=admin_headers)
    assert me.status_code == 200 and me.json()['role'] == 'admin'

    # Owner can make the role genuinely restricted at the API layer.
    admin_id = me.json()['id']
    changed = client.put(f'/api/v1/admin/admins/{admin_id}/permissions', headers=owner, json={'permissions':['students']})
    assert changed.status_code == 200
    assert client.get('/api/v1/admin/users', headers=admin_headers).status_code == 200
    assert client.get('/api/v1/admin/dashboard', headers=admin_headers).status_code == 403

    # Restore normal permissions so later tests are independent.
    standard = ['dashboard','students','results','reviews','months','quizzes','content','assistant','settings','analytics','notifications','admins']
    assert client.put(f'/api/v1/admin/admins/{admin_id}/permissions', headers=owner, json={'permissions':standard}).status_code == 200

    pin = str(uuid4().int)[-6:]
    assert client.post('/api/v1/auth/admin-pin/setup', headers=admin_headers, json={'pin':pin}).status_code == 200
    pin_login = client.post('/api/v1/auth/admin-pin', json={'pin':pin})
    assert pin_login.status_code == 200


def test_admin_can_edit_student_record():
    h = student_headers()
    me = client.get('/api/v1/auth/me', headers=h).json()
    owner = owner_headers()
    changed = client.put(f"/api/v1/admin/users/{me['id']}", headers=owner, json={
        'first_name':'Updated','last_name':'Student','email':me['email'],'phone':me['phone'],
        'guardian_phone':'01099998888','stage':'ثانوي','education_type':'عام','grade':'الصف الثاني الثانوي',
        'school_name':'مدرسة الاختبار','is_verified':True,
    })
    assert changed.status_code == 200
    details = client.get(f"/api/v1/admin/users/{me['id']}", headers=owner).json()['user']
    assert details['first_name'] == 'Updated'
    assert details['grade'] == 'الصف الثاني الثانوي'
    assert details['is_verified'] is True


def test_monthly_path_locks_next_quiz_until_previous_passed():
    owner = owner_headers()
    suffix = uuid4().hex[:10]
    base = {
        'title_en':'','description_ar':'','description_en':'','stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي',
        'duration_minutes':20,'passing_score':60,'max_attempts':3,'randomize_questions':False,
        'show_result_immediately':True,'is_published':False,'is_placement':False,
    }
    ids = []
    slugs = []
    for n in (1,2):
        slug = f"path-{suffix}-{n}"
        payload = {**base, 'slug':slug, 'title_ar':f'اختبار مسار {suffix}-{n}'}
        made = client.post('/api/v1/admin/quizzes', headers=owner, json=payload)
        assert made.status_code == 201
        qid = made.json()['id']; ids.append(qid); slugs.append(slug)
        question = client.post(f'/api/v1/admin/quizzes/{qid}/questions', headers=owner, json={
            'prompt':f'سؤال {n}','explanation':'','level':'A1','question_type':'mcq','expected_answer':None,
            'position':1,'points':1,'choices':[['صح',True],['غلط',False]],
        })
        assert question.status_code == 201
        assert client.patch(f'/api/v1/admin/quizzes/{qid}/publish?published=true', headers=owner).status_code == 200

    month = client.post('/api/v1/admin/months', headers=owner, json={
        'title':f'شهر {suffix}','stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي','sort_order':999,'is_visible':True
    })
    assert month.status_code == 201
    month_id = month.json()['id']
    assert client.put(f'/api/v1/admin/quiz-path/{ids[0]}', headers=owner, json={
        'month_id':month_id,'week_label':'الأسبوع الأول','sort_order':10,'requires_previous':False,'unlock_after_quiz_id':None,'min_previous_score':60,'show_when_locked':True
    }).status_code == 200
    assert client.put(f'/api/v1/admin/quiz-path/{ids[1]}', headers=owner, json={
        'month_id':month_id,'week_label':'الأسبوع الثاني','sort_order':20,'requires_previous':True,'unlock_after_quiz_id':None,'min_previous_score':60,'show_when_locked':True
    }).status_code == 200

    student = student_headers()
    locked = client.post(f'/api/v1/quizzes/{slugs[1]}/start', headers=student)
    assert locked.status_code == 403
    first = client.post(f'/api/v1/quizzes/{slugs[0]}/start', headers=student)
    assert first.status_code == 200
    q = first.json()['questions'][0]
    submit = client.post(f"/api/v1/quizzes/attempts/{first.json()['attempt_id']}/submit", headers=student, json={'answers':[{'question_id':q['id'],'choice_id':q['choices'][0]['id']}]})
    assert submit.status_code == 200 and submit.json()['score'] == 100
    unlocked = client.post(f'/api/v1/quizzes/{slugs[1]}/start', headers=student)
    assert unlocked.status_code == 200
    path = client.get('/api/v1/path', headers=student)
    assert path.status_code == 200
    target = next(q for m in path.json() for q in m['quizzes'] if q['quiz_id'] == ids[1])
    assert target['locked'] is False


def test_visits_presence_review_delete_and_backup_export():
    owner = owner_headers()
    student = student_headers()
    assert client.post('/api/v1/analytics/visit', headers=student, json={'path':'/student/test-page'}).status_code == 200
    assert client.post('/api/v1/auth/presence', headers=student, json={'path':'/student/test-page'}).status_code == 200
    analytics = client.get('/api/v1/admin/analytics', headers=owner)
    assert analytics.status_code == 200 and analytics.json()['total'] >= 1
    presence = client.get('/api/v1/admin/presence', headers=owner)
    assert presence.status_code == 200 and any(x['path'] == '/student/test-page' for x in presence.json())

    review = client.post('/api/v1/reviews', json={'display_name':'طالب للحذف','student_stage':'ثانوي عام','rating':4,'body':'تقييم سيتم حذفه من الإدارة'}).json()
    assert client.patch(f"/api/v1/admin/reviews/{review['id']}?status=pending", headers=owner).status_code == 200
    assert client.delete(f"/api/v1/admin/reviews/{review['id']}", headers=owner).status_code == 200

    backup = client.get('/api/v1/admin/backup/export.json', headers=owner)
    assert backup.status_code == 200
    data = backup.json()
    assert data['version'] == 3
    assert 'site_settings' in data and 'quizzes' in data and 'quiz_path' in data


def test_month_schedule_blocks_direct_quiz_access_until_month_opens():
    owner = owner_headers()
    suffix = uuid4().hex[:10]
    slug = f"scheduled-month-{suffix}"
    created = client.post('/api/v1/admin/quizzes', headers=owner, json={
        'slug':slug,'title_ar':f'اختبار شهر مؤجل {suffix}','title_en':'','description_ar':'',
        'stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي','duration_minutes':10,
        'passing_score':60,'max_attempts':2,'randomize_questions':False,'show_result_immediately':True,
        'is_published':False,'is_placement':False,
    })
    assert created.status_code == 201
    quiz_id = created.json()['id']
    assert client.post(f'/api/v1/admin/quizzes/{quiz_id}/questions', headers=owner, json={
        'prompt':'سؤال موعد','explanation':'','level':'A1','question_type':'mcq','expected_answer':None,
        'position':1,'points':1,'choices':[['صح',True],['غلط',False]],
    }).status_code == 201
    assert client.patch(f'/api/v1/admin/quizzes/{quiz_id}/publish?published=true', headers=owner).status_code == 200

    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    month = client.post('/api/v1/admin/months', headers=owner, json={
        'title':f'شهر مؤجل {suffix}','stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي',
        'sort_order':1000,'is_visible':True,'starts_at':future,
    })
    assert month.status_code == 201
    month_id = month.json()['id']
    assert client.put(f'/api/v1/admin/quiz-path/{quiz_id}', headers=owner, json={
        'month_id':month_id,'week_label':'الأسبوع الأول','sort_order':10,'requires_previous':False,
        'unlock_after_quiz_id':None,'min_previous_score':60,'show_when_locked':True,
    }).status_code == 200

    student = student_headers()
    start = client.post(f'/api/v1/quizzes/{slug}/start', headers=student)
    assert start.status_code == 403
    path = client.get('/api/v1/path', headers=student)
    assert path.status_code == 200
    target = next(q for m in path.json() for q in m['quizzes'] if q['quiz_id'] == quiz_id)
    assert target['status'] == 'scheduled'
    assert target['locked'] is True


def test_verification_code_locks_after_five_wrong_attempts():
    test_id = uuid4().hex
    email = f"otp-limit-{test_id}@test.com"
    phone = str(uuid4().int)[:15]
    assert client.post('/api/v1/auth/register', json={
        'first_name':'OTP','last_name':'Student','email':email,'phone':phone,
        'guardian_phone':'01033334444','stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي','password':'StrongPass1'
    }).status_code == 201
    requested = client.post('/api/v1/auth/forgot-password', json={'email':email})
    code = requested.json()['dev_code']
    wrong = '000000' if code != '000000' else '999999'
    for _ in range(5):
        response = client.post('/api/v1/auth/reset-password', json={'email':email,'code':wrong,'new_password':'NewStrongPass2'})
        assert response.status_code == 400
    # Even the real code is invalid once the failure limit has been reached.
    locked = client.post('/api/v1/auth/reset-password', json={'email':email,'code':code,'new_password':'NewStrongPass2'})
    assert locked.status_code == 400


def test_admin_pin_can_be_reset_by_authorized_email_code():
    owner = owner_headers()
    allow = client.post('/api/v1/admin/authorized-admins', headers=owner, json={'email':'admin@test.com','role':'owner'})
    assert allow.status_code == 201
    request = client.post('/api/v1/auth/admin-pin/forgot', json={'email':'admin@test.com'})
    assert request.status_code == 200
    code = request.json().get('dev_code')
    assert code and len(code) == 6
    reset = client.post('/api/v1/auth/admin-pin/reset', json={'email':'admin@test.com','code':code,'pin':'654321'})
    assert reset.status_code == 200
    login = client.post('/api/v1/auth/admin-pin', json={'pin':'654321'})
    assert login.status_code == 200


def test_student_soft_archive_and_restore_keeps_results():
    owner = owner_headers()
    student = student_headers()
    me = client.get('/api/v1/auth/me', headers=student).json()
    start = client.post('/api/v1/quizzes/english-placement-50/start', headers=student)
    assert start.status_code == 200
    attempt_id = start.json()['attempt_id']
    archive = client.post(f"/api/v1/admin/users/{me['id']}/archive", headers=owner)
    assert archive.status_code == 200
    listed = client.get('/api/v1/admin/users', headers=owner).json()
    assert all(row['id'] != me['id'] for row in listed)
    trash = client.get('/api/v1/admin/trash', headers=owner).json()
    assert any(row['id'] == me['id'] for row in trash['students'])
    restore = client.post(f"/api/v1/admin/trash/students/{me['id']}/restore", headers=owner)
    assert restore.status_code == 200
    detail = client.get(f"/api/v1/admin/users/{me['id']}", headers=owner)
    assert detail.status_code == 200
    assert any(row['id'] == attempt_id for row in detail.json()['attempts'])


def test_full_safe_backup_contains_students_and_results_without_password_hashes():
    owner = owner_headers()
    student = student_headers()
    start = client.post('/api/v1/quizzes/english-placement-50/start', headers=student)
    assert start.status_code == 200
    backup = client.get('/api/v1/admin/backup/export.json', headers=owner)
    assert backup.status_code == 200
    data = backup.json()
    assert data['version'] == 3
    assert data['students']
    assert data['attempts']
    serialized = backup.text.lower()
    assert 'password_hash' not in serialized
    assert 'refresh_token' not in serialized
    assert 'api_key' not in serialized


def test_admin_password_recovery_is_limited_to_authorized_admin_email():
    owner = owner_headers()
    allow = client.post('/api/v1/admin/authorized-admins', headers=owner, json={'email':'admin@test.com','role':'owner'})
    assert allow.status_code == 201
    request = client.post('/api/v1/auth/admin-password/forgot', json={'email':'admin@test.com'})
    assert request.status_code == 200
    code = request.json().get('dev_code')
    assert code and len(code) == 6
    reset = client.post('/api/v1/auth/admin-password/reset', json={'email':'admin@test.com','code':code,'new_password':'NewStrong1'})
    assert reset.status_code == 200
    assert client.post('/api/v1/auth/login', json={'identifier':'admin@test.com','password':'NewStrong1'}).status_code == 200
    # Restore the deterministic test password for repeatable runs.
    request2 = client.post('/api/v1/auth/admin-password/forgot', json={'email':'admin@test.com'})
    code2 = request2.json().get('dev_code')
    assert client.post('/api/v1/auth/admin-password/reset', json={'email':'admin@test.com','code':code2,'new_password':'StrongAdmin1'}).status_code == 200
