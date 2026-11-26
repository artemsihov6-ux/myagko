import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getSettings } from '@/lib/db';
import { categories, type Category } from '@/lib/domain';
import { Cleaning } from '@/components/cleaning';
import { Contacts, Services, Steps } from '@/components/site';


export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { company } = await getSettings();
  return {
    title: { absolute: company.name + ' — выездная химчистка мебели в городе ' + company.city },
    description: 'Выберите мебель, узнайте ориентировочную стоимость химчистки и оставьте заявку на выезд мастера.',
    alternates: { canonical: '/' },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ mebel?: string }> }) {
  const [settings, params] = await Promise.all([getSettings(), searchParams]);
  const category = categories.includes(params.mebel as Category) ? params.mebel as Category : 'sofa';
  return <Cleaning settings={settings} initialCategory={category} initialDirect={Boolean(params.mebel)} demo={process.env.DEMO_MODE === 'true'}>
    <Services settings={settings}/><Steps/><Contacts company={settings.company}/>
  </Cleaning>;
}
