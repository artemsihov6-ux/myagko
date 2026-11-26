'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Clipboard, Eraser, Gamepad2, Link2, RefreshCw, Rotate3D } from 'lucide-react';
import { api, ClientError, errorText, json } from '@/lib/client';
import { formatDay, money, requestNumber, statuses, type Bonus, type Characters, type PublicOrder } from '@/lib/domain';
import { EstimateCard, OrderItems } from './estimate';
import { FurnitureStage } from './stage';

function BonusDetails({ bonus }: { bonus: Bonus }) {
  return <div className="bonus-details"><strong>Код {bonus.code}</strong>
    <p>{money(bonus.amount)} на следующий заказ при чистке от {money(bonus.minimum)}. Действует до {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(bonus.expires))}.</p>
    <p>Назовите код мастеру. Он проверит условия и вручную применит бонус к следующему заказу.</p>
  </div>;
}

function CleaningGame({ order, token, characters, onBonus }: { order: PublicOrder; token: string; characters: Characters; onBonus: (bonus: Bonus) => void }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cleaning, setCleaning] = useState(true);
  const [keyboardStroke, setKeyboardStroke] = useState(0);
  const [message, setMessage] = useState('');
  const [claiming, setClaiming] = useState(false);
  const update = useCallback((next: number) => setProgress((old) => Math.max(old, next)), []);
  async function claim() {
    setClaiming(true);
    setMessage('');
    try { onBonus(await api<Bonus>('/api/orders/' + token + '/bonus', json({}))); }
    catch (error) { setMessage(errorText(error)); }
    finally { setClaiming(false); }
  }
  return <section className="card game-card">
    <div className="game-heading"><span className="game-icon"><Gamepad2 size={24}/></span><div><h2>Почистите диван</h2>
      <p className="muted">Короткая игра после заявки. {order.game.mode === 'bonus' && 'Награда — бонус на следующий заказ.'}</p></div></div>
    {order.bonus ? <BonusDetails bonus={order.bonus}/> : <>
      {!open ? <button type="button" className="button secondary" onClick={() => setOpen(true)}>Сыграть</button> : <>
        <div className="game-controls">
          <button type="button" className={'button ' + (cleaning ? 'primary' : 'secondary')} aria-pressed={cleaning} onClick={() => setCleaning(true)}><Eraser size={18}/> Чистить</button>
          <button type="button" className={'button ' + (!cleaning ? 'primary' : 'secondary')} aria-pressed={!cleaning} onClick={() => setCleaning(false)}><Rotate3D size={18}/> Поворачивать</button>
        </div>
        <FurnitureStage category="sofa" characters={characters} label="Диван с пятнами" game={{ cleaning, progress: update, keyboardStroke, availability: setReady }}/>
        <div className="game-progress"><label htmlFor="game-progress">Чистота <b>{progress}%</b></label><progress id="game-progress" max={100} value={progress}/></div>
        {ready && progress < 100 && <button className="text-button small" type="button" onClick={() => setKeyboardStroke((count) => count + 1)}>Очистить одно пятно кнопкой</button>}
        {progress === 100 && <p className="success-inline" role="status"><CheckCircle2 size={20}/> Диван чистый!</p>}
        {progress === 100 && order.game.mode === 'bonus' && <button type="button" className="button primary" disabled={claiming} onClick={() => void claim()}>{claiming ? 'Получаем код…' : 'Получить код'}</button>}
        {message && <p className="field-error" role="alert">{message}</p>}
      </>}
    </>}
  </section>;
}

export function RequestStatus({ initial, token, characters }: { initial: PublicOrder; token: string; characters: Characters }) {
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState(false);
  const [link, setLink] = useState('');
  const [linkNote, setLinkNote] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async (showError: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const entry = await api<PublicOrder>('/api/orders/' + token);
      setOrder(entry);
      setError('');
      setRemoved(false);
    } catch (error) {
      if (error instanceof ClientError && error.status === 404) setRemoved(true);
      else if (showError) setError(errorText(error));
    } finally {
      inFlight.current = false;
    }
  }, [token]);
  useEffect(() => {
    setLink(window.location.origin + '/zayavka/' + token);
    const update = () => { if (!document.hidden) void refresh(false); };
    const timer = window.setInterval(update, 12_000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [refresh, token]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setLinkNote('Ссылка скопирована.');
    } catch {
      input.current?.focus();
      input.current?.select();
      setLinkNote('Ссылка выделена. Скопируйте её вручную.');
    }
  }

  if (removed) return <main className="wrap content-page"><h1>Заявка недоступна</h1><p>Эта ссылка больше не действует.</p><a className="button primary" href="/">На главную</a></main>;
  return <main className="wrap order-page">
    <div className="order-header"><span className="success-icon"><CheckCircle2 size={31}/></span>
      <div><p className="muted">Заявка {requestNumber(order.number)}</p><h1>{order.status === 'new' ? 'Заявка принята' : 'Статус заявки'}</h1></div>
      <span className={'status-pill ' + order.status}>{statuses[order.status]}</span></div>
    <p className="lead">{order.status === 'new' ? 'Мастер свяжется с вами, чтобы уточнить цену и время выезда.' : order.status === 'agreed' ? 'Мастер подтвердил цену и время выезда.' : order.status === 'done' ? 'Чистка завершена.' : 'Мастер отменил эту заявку.'}</p>
    <div className="flow-grid status-grid">
      <div className="order-side">
        <section className="card summary-card"><h2>Состав заказа</h2><OrderItems items={order.items} quote={order.estimate}/></section>
        <section className="card link-card"><h2><Link2 size={20}/> Приватная ссылка</h2><p>Сохраните ссылку, чтобы вернуться к заявке и увидеть обновления.</p>
          <div className="copy-row"><input ref={input} value={link} readOnly aria-label="Приватная ссылка"/><button type="button" className="button secondary" disabled={!link} onClick={() => void copy()}><Clipboard size={18}/> Скопировать</button></div>
          {linkNote && <p className="success-inline" role="status">{linkNote}</p>}</section>
      </div>
      <div className="order-side">
        <section className="card agreed-card"><h2><CalendarDays size={22}/> Цена и выезд</h2>
          <dl className="price-lines"><div><dt>Итоговая цена</dt><dd>{order.finalPrice === null ? 'Уточняет мастер' : money(order.finalPrice)}</dd></div>
            <div><dt>Согласованное время</dt><dd>{order.agreedDate && order.agreedTime ? formatDay(order.agreedDate) + ', ' + order.agreedTime : 'Ожидает согласования'}</dd></div>
            {order.date && <div><dt>Ваше пожелание</dt><dd>{formatDay(order.date)}{order.time && ', ' + order.time}</dd></div>}</dl>
          <button className="text-button" type="button" onClick={() => void refresh(true)}><RefreshCw size={16}/> Обновить статус</button>
          {error && <p className="field-error" role="alert">{error}</p>}
        </section>
        <EstimateCard quote={order.estimate} minimum={order.minimum}/>
      </div>
    </div>
    {(order.game.mode !== 'off' && order.status !== 'canceled' || order.bonus) && <CleaningGame order={order} token={token} characters={characters} onBonus={(bonus) => setOrder((old) => ({ ...old, bonus }))}/>}
    <a href="/" className="button secondary">На главную</a>
  </main>;
}
