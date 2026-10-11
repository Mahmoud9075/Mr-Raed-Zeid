import type { NextConfig } from 'next';

const configuredApi = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const backendOrigin = configuredApi.replace(/\/api\/v1\/?$/, '');

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
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ];
  }
};

export default nextConfig;
