import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: { '/*': ['./node_modules/@img/sharp-*/**/*'] },
  poweredByHeader: false,
  devIndicators: false,
  images: { formats: ['image/avif', 'image/webp'], qualities: [75, 85] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
    ] }];
  }
};

export default config;
