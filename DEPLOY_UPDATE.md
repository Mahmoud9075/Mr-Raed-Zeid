# Mr. Raed website — deployment update

## Frontend Vercel environment variables

- `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api/v1`
- Optional server-side override: `API_INTERNAL_URL=https://<your-backend-domain>/api/v1`

The browser calls `/api/v1/*` on the frontend origin and Next.js proxies those requests to the configured backend. This keeps browser requests same-origin and reduces CORS/cookie issues.

## Backend environment variables

Required in production:

- `ENV=production`
- `DATABASE_URL=postgresql+psycopg://...`
- `JWT_SECRET=<strong random value, 32+ characters>`
- `ADMIN_EMAIL=<owner email>`
- `ADMIN_PASSWORD=<strong owner password>`
- `ALLOWED_ORIGINS=https://<your-frontend-domain>`

Optional Gemini:

- `GEMINI_API_KEY=<Gemini API key>`
- `GEMINI_MODEL=gemini-3.8-flash`

Optional SMTP / admin OTP:

- `ADMIN_OTP_REQUIRED=true`
- `SMTP_HOST`
- `SMTP_PORT=587`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Keep `ADMIN_OTP_REQUIRED=false` until SMTP is configured and tested.

## Important notes

- Do not commit `.env` files or secrets.
- Admin login: `/admin/login`.
- Admin dashboard: `/admin`.
- The public assistant is available from the floating assistant button.
- Student grades/results remain protected and require authentication.
- The English placement quiz `english-placement-50` is intentionally seeded as a **published 50-question placement test** and is not auto-archived at startup.
- Uploaded profile images use local filesystem storage in the Docker setup. For serverless/large-scale production, use persistent object storage.
- Frontend Vercel Root Directory: `frontend`.
- Use the actual project root when pushing to GitHub; avoid nesting a second project copy one level above it.
