# Interactive runtime + navbar fix

Date: 2026-10-15

## What was fixed
- Local `next dev` CSP now permits the development runtime features React/Next need for hydration (eval/source maps, WebSocket/HMR and blob workers). Production CSP remains stricter.
- This addresses the symptom where the page HTML appears but buttons, hamburger, chat and client-side navigation look frozen.
- Navbar now visibly includes account/login, language switch, theme switch and the 3-line menu while staying compact and responsive.
- Local Windows start script clears stale `.next` cache, waits for the backend health endpoint, then starts the frontend.
- Frontend API calls time out after 12 seconds and show a clear server-connection error instead of spinning forever when the backend is down.

## Verification
- Backend pytest: 20/20 passed.
- TypeScript: passed after the changes.
- Static routes/anchors were checked; no real missing public route/anchor was found.

## Important local use note
Keep both backend and frontend terminal windows open while using the site. If either one is closed, data-backed pages/chat will not work.
