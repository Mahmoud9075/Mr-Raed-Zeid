# Final Submission Notes

## Important URLs
- Public site: `/`
- Student login: `/login`
- Admin login: `/admin/login`
- Admin dashboard: `/admin`

The admin login/dashboard are intentionally not linked from the public navigation.

## Environment setup
Copy `.env.example` to `.env` and set your own values before running Docker.

At minimum set:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Optional assistant:
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3.8-flash`

Never commit or share the real `.env`.

## Final verification
- Backend tests: 13 passed.
- TypeScript check: passed.
- Admin API rejects anonymous and student access.
- Local assistant data and Gemini routing are covered by automated tests.
- Submission archive excludes `.env`, local databases, caches, `node_modules`, `.next`, virtual environments, logs, and user-uploaded files.
