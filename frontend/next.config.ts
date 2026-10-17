import type { NextConfig } from 'next';

// Browser requests always stay same-origin at /api/v1. Next.js proxies them
// to the private FastAPI service. Keeping this separate from NEXT_PUBLIC_API_URL
// prevents accidental browser calls to the backend container directly.
const configuredInternalApi = process.env.API_INTERNAL_URL || 'http://127.0.0.1:8100/api/v1';
const backendOrigin = configuredInternalApi.replace(/\/api\/v1\/?$/, '');
const isDev = process.env.NODE_ENV !== 'production';

// Next.js development uses eval-based source maps and a WebSocket for HMR.
// A production CSP that blocks those features makes the server-rendered HTML
// appear normally while React never hydrates: buttons, menus, chat and client
// navigation then look "frozen". Keep production strict, but allow only the
// local dev capabilities while running `next dev`.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
  : "script-src 'self' 'unsafe-inline'";
const connectSrc = isDev
  ? "connect-src 'self' ws: wss: http: https:"
  : "connect-src 'self'";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  connectSrc
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendOrigin}/api/v1/:path*`
      },
      {
        source: '/uploads/:path*',
        destination: `${backendOrigin}/uploads/:path*`
      }
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Mr-Raed-Runtime', value: 'stable-3100' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy }
        ]
      }
    ];
  }
};

export default nextConfig;
