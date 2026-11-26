import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/onest';
import './style.css';
import { ServiceWorker } from '@/components/theme';

const base = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN) : new URL('http://localhost:3000');
export const metadata: Metadata = {
  metadataBase: base,
  title: { default: 'Мягко — выездная химчистка мебели', template: '%s · Мягко' },
  description: 'Рассчитайте предварительную стоимость химчистки дивана, кресла, матраса или стула и оставьте заявку на выезд.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/192.png', apple: '/icons/apple.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f4f5ef' };
const themeScript = "try{document.documentElement.dataset.theme=localStorage.getItem('myagko.theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}";
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/></head>
    <body>{children}<ServiceWorker/></body></html>;
}
