import { Image, MapPin, ReceiptText } from 'lucide-react';
import { itemDetails, itemTitle, money, type Estimate, type Item } from '@/lib/domain';

export function EstimateCard({ quote, minimum, children }: { quote: Estimate; minimum: number; children?: React.ReactNode }) {
  return <section className="card estimate-card" aria-label="Предварительный расчёт">
    <h2>Предварительный расчёт</h2>
    {quote.total !== null && <dl className="price-lines"><div><dt>Чистка по тарифам</dt><dd>{money(quote.subtotal)}</dd></div>
      {quote.minimumAdjustment > 0 && <div><dt>Доплата до минимума</dt><dd>{money(quote.minimumAdjustment)}</dd></div>}</dl>}
    {quote.travel > 0 && <dl className="price-lines"><div><dt><MapPin size={15}/> Выезд за город</dt><dd>{money(quote.travel)}</dd></div></dl>}
    <div className="quote-total"><span>{quote.manualCount && quote.total !== null ? 'Известная часть' : 'Ориентир'}</span><strong>{quote.total === null ? 'По фото' : money(quote.total)}</strong></div>
    {quote.manualCount > 0 && <p className="mixed-note"><Image size={18}/> <span>По фото — {quote.manualCount} шт. Мастер уточнит стоимость по снимкам.</span></p>}
    {quote.manualCount > 0 && quote.total !== null && quote.minimumAdjustment > 0 && <p className="muted small">Мастер учтёт позиции «По фото» при пересчёте минимума.</p>}
    {quote.total === null && minimum > 0 && <p className="muted small">Минимум на чистку {money(minimum)}.</p>}
    <p className="muted small with-icon"><ReceiptText size={17}/> Итоговую цену подтвердит мастер.</p>
    {children}
  </section>;
}

export function OrderItems({ items, quote }: { items: Item[]; quote: Estimate }) {
  return <ul className="order-items">{items.map((item, i) => <li key={i}>
    <div><strong>{itemTitle(item)} · {item.qty} шт.</strong><small>{itemDetails(item)}</small></div>
    <strong>{quote.lines[i] == null ? 'По фото' : money(quote.lines[i]!)}</strong>
  </li>)}</ul>;
}
