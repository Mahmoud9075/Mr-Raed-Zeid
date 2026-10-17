# Mr. Raed website — deployment update

## Frontend Vercel environment variables

- Required: `API_INTERNAL_URL=https://<your-backend-domain>/api/v1` in the Vercel project's Production environment (and Preview if used).
- `NEXT_PUBLIC_API_URL` is not required: browser requests use the same-origin `/api/v1` path.

The browser calls `/api/v1/*` on the frontend origin and Next.js proxies those requests to `API_INTERNAL_URL`. This value is used by the Next.js rewrite configuration; the default points to localhost and will not work on Vercel. Redeploy after changing it.

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

On startup, a production backend seeds missing default site settings and assistant knowledge into the configured `DATABASE_URL`. Seeding is idempotent and preserves existing admin-edited knowledge and site settings. The database must be reachable, and the required `ADMIN_EMAIL` and `ADMIN_PASSWORD` must be configured.

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
