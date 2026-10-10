import os
os.environ["DATABASE_URL"] = "sqlite:///./test_raed.db"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-local-automated-tests-only"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "StrongAdmin1"
from fastapi.testclient import TestClient
from app.main import app
from app.seed import run_seed

run_seed()
client = TestClient(app)


def student_headers():
    client.post('/api/v1/auth/register', json={
        'first_name':'Test','last_name':'Student','email':'student@test.com','phone':'01011112222',
        'guardian_phone':'01033334444','stage':'ثانوي','education_type':'عام','grade':'الصف الأول الثانوي','password':'StrongPass1'
    })
    login = client.post('/api/v1/auth/login', json={'identifier':'student@test.com','password':'StrongPass1'})
    assert login.status_code == 200
    return {'Authorization':'Bearer '+login.json()['access_token']}


def owner_headers():
    login = client.post('/api/v1/auth/login', json={'identifier':'admin@test.com','password':'StrongAdmin1'})
    assert login.status_code == 200
    return {'Authorization':'Bearer '+login.json()['access_token']}


def test_health_and_quiz_count():
    assert client.get('/api/v1/health').status_code == 200
    h = student_headers()
    quizzes = client.get('/api/v1/quizzes', headers=h).json()
    assert quizzes[0]['question_count'] == 50


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
