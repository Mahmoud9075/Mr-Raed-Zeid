# النشر

## أسرع تشغيل محلي بـ Docker
1. انسخ `.env.example` إلى `.env`.
2. غيّر كلمات السر والـJWT secret.
3. شغّل: `docker compose up --build -d`
4. افتح: `http://localhost`
5. الـAPI docs في التطوير المحلي المباشر: `http://localhost:8000/docs` عند تشغيل backend منفردًا.

## تشغيل بدون Docker
### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
ثم افتح `http://localhost:3000`.

## مهم بخصوص GitHub Pages
GitHub Pages مناسب للـHTML/JS الثابت فقط. هذا المشروع بعد إضافة Backend وDatabase لا يُنشر كاملًا على GitHub Pages. استخدم VPS/Docker أو استضف Next.js وFastAPI وقاعدة البيانات على خدمات تدعم السيرفر.
