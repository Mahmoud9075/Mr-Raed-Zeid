# Runtime Fix Report

- Root cause observed from the screenshot: the browser was still serving an older frontend on port 3000. The current source renders Login/Account, EN/AR, Theme and the hamburger in the server HTML, while the screenshot only showed the older minimal navbar.
- The local launcher now uses dedicated ports: frontend 3100, backend 8100.
- It stops stale Node/Python listeners on those dedicated ports, removes `.next`, prepares the database first, waits for backend health, waits for the frontend response header `X-Mr-Raed-Runtime: stable-3100`, and only then opens the browser.
- The navbar source includes account/login, language, theme and menu controls.
- WhatsApp uses a WhatsApp-specific phone-in-bubble icon; assistant chat uses a separate three-dots chat icon.
- Backend regression suite: 20/20 passed after the runtime changes.
- TypeScript: passed after the runtime changes.
