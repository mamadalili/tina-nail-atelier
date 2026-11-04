import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export', basePath: '/tina-preview', trailingSlash: true,
  poweredByHeader: false, devIndicators: false,
  images: { unoptimized: true, qualities: [75, 85] },
};
export default config;
