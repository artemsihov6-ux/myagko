import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '') || 'http://localhost:3000';
  return ['/', '/uslugi', '/politika', '/avtory'].map((path) => ({ url: origin + path }));
}
