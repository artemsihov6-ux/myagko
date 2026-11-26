import { connection } from 'next/server';
import { getSettings } from '@/lib/db';
import { SiteFrame } from '@/components/site';

export const metadata = { title: 'Обработка данных', alternates: { canonical: '/politika' } };
export default async function PrivacyPage() {
  await connection();
  const { company } = await getSettings();
  const ready = Boolean(company.operator && (company.email || company.phone || company.telegram));
  return <SiteFrame company={company}><main className="wrap content-page document">
    <h1>Обработка данных</h1>
    {!ready && <p className="callout">Шаблон политики демонстрационного экземпляра. Для теста используйте вымышленные данные.</p>}
    <h2>Кто обрабатывает данные</h2>
    <p>{company.operator || company.name}. {company.email && <a href={'mailto:' + company.email}>{company.email}</a>} {company.phone && <span>{company.phone}</span>} {company.telegram && <a href={'https://t.me/' + company.telegram.slice(1)}>{company.telegram}</a>}</p>
    <h2>Данные заявки</h2>
    <p>Сохраняем имя, телефон, адрес, выбранную мебель, пожелания по времени, комментарий и приложенные фото. Они нужны, чтобы оценить заказ, связаться с вами и согласовать выезд.</p>
    <h2>Хранение и доступ</h2>
    <p>Черновик сохраняется в вашем браузере. Фотографии, загруженные до отправки, доступны для прикрепления в течение 24 часов. Состав и статус доступны по приватной ссылке. Фото, контактные данные и рабочие записи доступны владельцу в кабинете.</p>
    <p>Карточка заявки хранится, пока владелец сопровождает заказ и выполняет обязательства по нему. По вопросам доступа, исправления и удаления данных обратитесь к оператору по контактам выше.</p>
  </main></SiteFrame>;
}
