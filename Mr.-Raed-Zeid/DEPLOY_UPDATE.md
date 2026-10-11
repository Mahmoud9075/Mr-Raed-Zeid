# Mr. Raed Platform v3 deployment update

## Frontend Vercel environment variables

- `NEXT_PUBLIC_API_URL=https://mr-raed-zeid-backend.vercel.app/api/v1`
- Optional server-side override: `API_INTERNAL_URL=https://mr-raed-zeid-backend.vercel.app/api/v1`

The browser now calls `/api/v1/*` on the frontend origin. Next.js proxies those requests to the backend. This keeps browser requests same-origin and reduces CORS/cookie issues.

## Backend Vercel environment variables

Required in production:

- `ENV=production`
- `DATABASE_URL=postgresql+psycopg://...`
- `JWT_SECRET=<strong random value, 32+ characters>`
- `ADMIN_EMAIL=<owner email>`
- `ADMIN_PASSWORD=<strong owner password>`
- `ALLOWED_ORIGINS=https://mr-raed-zeid-frontend.vercel.app`
- `ADMIN_OTP_REQUIRED=true` after SMTP is configured

Gemini:

- `GEMINI_API_KEY=<Gemini API key>`
- `GEMINI_MODEL=gemini-2.0-flash`

SMTP for admin OTP:

- `SMTP_HOST`
- `SMTP_PORT=587`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`

## Important notes

- Do not commit `.env` files or secrets to GitHub.
- The admin login route is `/admin/login`.
- The admin dashboard route is `/admin`.
- The public assistant is available from the floating assistant button.
- Student grades remain protected and require login.
- The old demo 50-question placement quiz is no longer seeded. If it exists with no attempts, startup archives it automatically.
- Uploaded profile images still use local filesystem storage. Before large-scale production usage, move uploads to persistent object storage.
