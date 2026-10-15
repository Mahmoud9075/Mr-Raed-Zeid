# Final hardening report

This package fixes the concrete failure modes found during the final audit.

## Data/session reliability
- One deterministic local SQLite path: `backend/raed.db`; starting from a different shell directory no longer creates/reads a second database.
- Production Docker keeps PostgreSQL in a named persistent volume.
- Browser API retries one failed authenticated request after rotating the HttpOnly refresh session, so saves/admin pages do not suddenly fail when the short access token expires.
- Local Windows launcher seeds the database before starting the backend.

## Quizzes
- Starting a quiz resumes an unfinished attempt instead of consuming a new attempt on refresh.
- Answers autosave to the backend.
- Remaining time is server-authoritative.
- On timeout, the attempt is finalized from answers that reached the server before the deadline.
- Repeated final-submit requests are idempotent.
- Search/listing/assistant availability respects stage, education type, grade and start/end times.

## Admin
- Results/report view and per-attempt details.
- Excel export.
- Print/PDF-friendly results page.
- Manual essay grading with score recalculation.
- Student lookup/details and attempt history.
- Contact-message workflow states.
- Assistant knowledge update/delete/enable controls.
- Owner-only audit log.

## Assistant
- Operational information such as hours/address/contact is read from current Site Settings first, so admin edits are reflected immediately rather than being shadowed by old seed text.
- Gemini fallback/timeout behavior remains graceful.

## Security hardening
- Profile upload checks magic bytes and configured size, not just the supplied MIME type.
- Refresh token must belong to the JWT subject and is rotated.
- Changing a password revokes refresh sessions and clears auth cookies.
- Admin/owner authorization remains enforced server-side.
- Owner-only audit access.
- Per-IP rate limits, request-size cap, no-store on auth/admin responses, CSP/security headers, strict cookies in production.
- Submission archive contains no `.env`, database, node_modules, build cache or runtime upload data.

## Verification performed
- Backend regression suite: **19 passed**.
- Python modules compile successfully.
- Frontend TypeScript check: **passed** on the audited source tree.
- Production Next build could not be rerun in this offline Linux container because the matching SWC binary is not installed and the registry is unreachable; this is an environment limitation rather than a reported TypeScript error.

Absolute zero-vulnerability guarantees are not technically possible. The package is hardened against the issues found in this audit and should still be deployed with HTTPS, unique production secrets, backups and routine dependency/security scans.
