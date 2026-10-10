# API المختصرة

Base URL: `/api/v1`

## Public
- `GET /health`
- `GET /site-settings`
- `POST /contact`
- `GET /reviews`
- `POST /reviews`
- `GET /quizzes`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

المصادقة في الويب تستخدم HttpOnly cookies. الـAPI يدعم Bearer token أيضًا للاختبارات أو تطبيقات مستقبلية.

## Student
- `POST /quizzes/{slug}/start`
- `POST /quizzes/attempts/{attempt_id}/submit`
- `GET /quizzes/attempts/mine`

## Admin
- `GET /admin/dashboard`
- `GET /admin/users`
- `POST /admin/quizzes`
- `POST /admin/quizzes/{id}/questions`
- `PATCH /admin/quizzes/{id}/publish`
- `GET /admin/reviews`
- `PATCH /admin/reviews/{id}`
- `GET /admin/messages`
- `GET /admin/audit`
