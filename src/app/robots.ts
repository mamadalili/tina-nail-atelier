import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', ...(process.env.SITE_URL ? { allow: '/', disallow: ['/api/'] } : { disallow: '/' }) } };
}
