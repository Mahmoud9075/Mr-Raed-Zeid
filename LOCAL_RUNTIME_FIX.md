# Local runtime fix

The local development site could render HTML while all interactive controls appeared frozen.

Root cause: the production Content-Security-Policy was also applied unchanged to `next dev`. Next.js development requires eval-based source maps and a local WebSocket for HMR. The CSP blocked those runtime features, preventing React hydration.

Fix:
- Development only: allow `unsafe-eval` and local localhost/127.0.0.1 HTTP/WebSocket connections.
- Production: keep the stricter CSP unchanged (no `unsafe-eval`, same-origin connections only).

Symptoms fixed by this change:
- hamburger/menu button not opening
- client-side navigation/actions not responding
- chat button/gate not responding
- forms/client fetches appearing stuck
- Next dev HMR/runtime appearing frozen
