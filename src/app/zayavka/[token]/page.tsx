import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getSettings } from '@/lib/db';
import { HttpError, limit } from '@/lib/http';
import { getPublicOrder } from '@/lib/orders';
import { SiteFrame } from '@/components/site';
import { RequestStatus } from '@/components/request-status';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Статус заявки', robots: { index: false, follow: false } };
export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await limit('order-page', new Request('http://localhost', { headers: await headers() }), 120, 60);
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) return <main className="wrap content-page"><h1>Слишком много запросов</h1><p>Откройте ссылку ещё раз через минуту.</p></main>;
    throw error;
  }
  const [order, settings] = await Promise.all([getPublicOrder(token), getSettings()]);
  if (!order) notFound();
  return <SiteFrame company={settings.company}><RequestStatus initial={order} token={token} characters={settings.characters}/></SiteFrame>;
}
