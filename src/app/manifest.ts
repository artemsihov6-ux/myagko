import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { getSettings } from '@/lib/db';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection();
  const { company } = await getSettings();
  return {
    id: '/', name: company.name + ' — химчистка мебели', short_name: company.name,
    lang: 'ru', start_url: '/', scope: '/', display: 'standalone',
    background_color: '#f4f5ef', theme_color: '#f4f5ef',
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
