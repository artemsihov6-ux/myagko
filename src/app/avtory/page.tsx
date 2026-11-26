import { connection } from 'next/server';
import { getSettings } from '@/lib/db';
import { SiteFrame } from '@/components/site';

export const metadata = { title: 'Авторы и лицензии', alternates: { canonical: '/avtory' } };
export default async function CreditsPage() {
  await connection();
  const { company } = await getSettings();
  return <SiteFrame company={company}><main className="wrap content-page document">
    <h1>Авторы и лицензии</h1>
    <p>Модели мебели, персонажи, материалы и постеры созданы для шаблона «Мягко». Их исходники можно адаптировать и передавать вместе с проектом на условиях CC0 1.0.</p>
    <p>Иконки <a href="https://lucide.dev/license">Lucide</a> распространяются по ISC, включая унаследованные части по MIT. Шрифт <a href="https://github.com/simpals/onest">Onest</a> распространяется по SIL Open Font License 1.1.</p>
  </main></SiteFrame>;
}
