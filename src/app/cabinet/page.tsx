import type { CSSProperties } from 'react';
import { ownerSession } from '@/lib/auth';
import { getSettings } from '@/lib/db';
import { Cabinet, OwnerLogin } from '@/components/cabinet';
import { Header } from '@/components/site';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Кабинет владельца', robots: { index: false, follow: false } };
export default async function CabinetPage() {
  const [session, settings] = await Promise.all([ownerSession(), getSettings()]);
  return <div style={{ '--company': settings.company.accent } as CSSProperties}>
    <Header company={settings.company}/>
    {session ? <Cabinet initial={settings}/> : <OwnerLogin demo={process.env.DEMO_MODE === 'true'}/>}
  </div>;
}
