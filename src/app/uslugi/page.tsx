import { connection } from 'next/server';
import { getSettings } from '@/lib/db';
import { catalog, categories, money } from '@/lib/domain';
import { icons, SiteFrame, stageTints } from '@/components/site';

export const metadata = { title: 'Услуги и цены', alternates: { canonical: '/uslugi' } };
export default async function ServicesPage() {
  await connection();
  const { company, tariffs } = await getSettings();
  return <SiteFrame company={company}><main className="wrap content-page">
    <h1>Услуги и цены</h1>
    <p className="lead">Предварительные цены за один предмет. Минимум на чистку — {money(tariffs.minimum)}. Выезд за город — {money(tariffs.travel)} отдельно.</p>
    <div className="services-detail">{categories.map((category) => {
      const Icon = icons[category];
      return <article key={category} className="card">
        <span className={'service-icon ' + stageTints[category]}><Icon size={25}/></span>
        <h2>{catalog[category].title}</h2>
        {category === 'other' ? <p>Опишите мебель и приложите фото. Стоимость уточнит мастер.</p> : <dl className="price-lines">{catalog[category].variants.map((variant, i) =>
          <div key={variant}><dt>{variant}</dt><dd>{money(tariffs.prices[category][i])}</dd></div>)}</dl>}
        <a className="button secondary" href={'/?mebel=' + category + '#vybor'}>Выбрать</a>
      </article>;
    })}</div><p>Сильные загрязнения +{tariffs.heavyPercent}%. Вторая сторона матраса +{tariffs.secondSidePercent}%.</p>
  </main></SiteFrame>;
}
