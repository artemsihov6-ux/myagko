import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { Armchair, BedDouble, Boxes, CircleHelp, MapPin, RockingChair, Sofa, Sparkles } from 'lucide-react';
import { Brand } from './brand';
import { ThemeButton } from './theme';
import { catalog, categories, money, type Company, type Settings } from '@/lib/domain';

export const icons = { sofa: Sofa, armchair: Armchair, mattress: BedDouble, chair: RockingChair, other: Boxes };
export const stageTints = { sofa: 'sage', armchair: 'lilac', mattress: 'teal', chair: 'ochre', other: 'peach' };

export function Header({ company, children, onSection }: { company: Company; children?: ReactNode; onSection?: (section: 'vybor' | 'kontakty') => void }) {
  function jump(event: MouseEvent<HTMLAnchorElement>, section: 'vybor' | 'kontakty') {
    if (!onSection || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onSection(section);
  }
  return <header className="site-header"><div className="wrap header-content">
    <Brand name={company.name}/>
    <nav className="main-nav" aria-label="Основная навигация"><a href="/#vybor" onClick={onSection ? (event) => jump(event, 'vybor') : undefined}>Калькулятор</a><a href="/uslugi">Услуги</a><a href="/#kontakty" onClick={onSection ? (event) => jump(event, 'kontakty') : undefined}>Контакты</a></nav>
    <div className="header-actions"><ThemeButton/>{children}</div>
  </div></header>;
}
export function Footer({ company }: { company: Company }) {
  return <footer className="site-footer"><div className="wrap footer-inner">
    <Brand name={company.name}/><nav aria-label="Ссылки в подвале">
      <a href="/politika">Обработка данных</a><a href="/avtory">Лицензии</a><a href="/cabinet">Кабинет</a>
    </nav><span>{company.city}</span>
  </div></footer>;
}
export function SiteFrame({ company, children }: { company: Company; children: ReactNode }) {
  return <div style={{ '--company': company.accent } as CSSProperties}><Header company={company}/>{children}<Footer company={company}/></div>;
}
export function Services({ settings, heading = true }: { settings: Settings; heading?: boolean }) {
  return <section className="service-section" id="uslugi">
    {heading && <div className="section-title"><h2>Что чистим</h2><a className="quiet-link" href="/uslugi">Все услуги</a></div>}
    <div className="service-grid">
      {categories.map((category) => {
        const Icon = icons[category];
        return <a className="service-item" href={'/?mebel=' + category + '#vybor'} key={category}>
          <span className={'service-icon ' + stageTints[category]}><Icon aria-hidden size={22}/></span>
          <span><strong>{catalog[category].title}</strong><small>{category === 'other' ? 'По фото' : 'от ' + money(Math.min(...settings.tariffs.prices[category]))}</small></span>
        </a>;
      })}
    </div>
  </section>;
}
export function Contacts({ company }: { company: Company }) {
  return <section className="contact-section" id="kontakty">
    <div><span className="inline-label"><MapPin size={17}/> Территория выезда</span><h2>{company.city}</h2><p>{company.territory}</p></div>
    <div className="contact-links">
      {company.phone && <a className="button secondary" href={'tel:' + company.phone.replace(/[^+0-9]/g, '')}>{company.phone}</a>}
      {company.telegram && <a className="button secondary" href={'https://t.me/' + company.telegram.slice(1)}>Написать в Telegram</a>}
      {company.email && <a className="button secondary" href={'mailto:' + company.email}>{company.email}</a>}
      <a className="button primary" href="/?mebel=sofa#vybor">Оставить заявку</a>
    </div>
  </section>;
}
export function Steps() {
  return <section className="how-section"><h2>Как проходит выезд</h2><div className="how-grid">
    <div><Sparkles size={22}/><h3>Соберите заказ</h3><p>Выберите мебель и посмотрите предварительный расчёт.</p></div>
    <div><CircleHelp size={22}/><h3>Дождитесь звонка</h3><p>Мастер уточнит детали и согласует итоговую цену и время.</p></div>
    <div><MapPin size={22}/><h3>Встретьте мастера</h3><p>Чистка проходит у вас дома по согласованному адресу.</p></div>
  </div></section>;
}
