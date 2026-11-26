import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '');
  if (process.env.DEMO_MODE === 'true') return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/', disallow: ['/cabinet', '/zayavka/', '/api/'] }, ...(origin && { sitemap: origin + '/sitemap.xml' }) };
}
