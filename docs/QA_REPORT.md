# QA Report — final corrected package

## Backend
- `pytest`: **19 passed** in the final hardened regression suite.
- Local database path is now resolved to `backend/raed.db` regardless of the shell working directory.
- Root `.env` and optional `backend/.env` are both discovered deterministically, so Gemini configuration no longer depends on where Uvicorn is started.
- Admin API authorization is covered for anonymous and student users.
- Assistant routing is covered for Local data, clarification flows, Gemini, history, missing-key behavior and timeout handling.

## Frontend
- `npx tsc --noEmit`: passed after the final changes.
- Admin UI is separated from the public site:
  - direct login: `/admin/login`
  - dashboard: `/admin`
  - no public Header/Floating Assistant on admin routes
  - admin routes are marked `noindex`.
- Public navigation does not expose an Admin link.
- Chat UI has mobile-safe height/composer handling and a single retry for transport failures.
- Arabic typography uses Cairo consistently with fallbacks.
- A full `next build` could not be rerun in the packaging container because Next.js attempted to download the Linux SWC binary and the container had no network (`EAI_AGAIN`). The user's development machine had already completed a production build successfully before packaging.

## Security checks already completed on the development machine
- Frontend `npm audit`: zero known vulnerabilities after dependency updates.
- Backend `pip-audit`: no known vulnerabilities found.
- Backend `bandit`: no issues identified.
- `.env` is ignored and must not be included in submission archives.


## Final hardening coverage
- Quiz attempts resume instead of silently consuming a new attempt after refresh.
- Answers autosave to the backend and the server timer remains authoritative.
- Expired quizzes finalize from the last server-saved answers.
- Submit is idempotent: repeating a completed submit returns the existing result rather than duplicating answers.
- Search and assistant quiz listings enforce stage, education type, grade and availability dates.
- Admin results include filtering, detail view, Excel export and manual essay grading.
- Contact messages support workflow status.
- Assistant operational answers read the latest Site Settings before stale seeded knowledge.
- Profile uploads validate actual file signatures and size, not just MIME/extension.
- Owner-only audit-log endpoint is enforced.
- Browser API automatically rotates a valid refresh session once on HTTP 401 and retries the original request.
- Same-origin `/api/v1` proxying is separated from the server-only backend URL to prevent save/chat routing loops.
- Added a non-Docker Windows launcher so the full stack can run locally without Docker Desktop.
