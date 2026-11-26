'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ChevronLeft, ChevronRight, CircleUserRound, ClipboardList, Gamepad2, History, KeyRound,
  LockKeyhole, LogOut, RefreshCw, Search, Settings2, Smile, Tag, Trash2,
} from 'lucide-react';
import { api, ClientError, errorText, json } from '@/lib/client';
import {
  catalog, formatDay, formatStamp, gameModes, money, moods, requestNumber, statuses, statusKeys,
  type Company, type FieldErrors, type OwnerUpdate, type Settings, type SettingSection, type Status, type Tariffs,
} from '@/lib/domain';
import type { OwnerOrder } from '@/lib/orders';
import { CheckField, Field } from './checkout';
import { EstimateCard, OrderItems } from './estimate';

type ListItem = { id: string; number: number; name: string; phone: string; status: Status; createdAt: string; total: number | null; finalPrice: number | null; manualCount: number };
type Section = 'orders' | SettingSection | 'access';
const nav = [
  ['orders', 'Заявки', ClipboardList], ['tariffs', 'Тарифы', Tag], ['company', 'Компания', Settings2],
  ['game', 'Игра', Gamepad2], ['characters', 'Персонажи', Smile], ['access', 'Доступ', LockKeyhole],
] as const;
const statusBadge = (status: Status) => <span className={'status-pill ' + status}>{statuses[status]}</span>;
function problem(error: unknown, setFields: (fields: FieldErrors) => void, setMessage: (message: string) => void) {
  if (error instanceof ClientError && error.status === 401) { window.location.reload(); return; }
  setFields(error instanceof ClientError ? error.fields : {});
  setMessage(errorText(error));
}

export function OwnerLogin({ demo }: { demo: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await api('/api/owner/login', json({ password })); window.location.reload(); }
    catch (failure) { setError(errorText(failure)); setBusy(false); }
  }
  return <main className="wrap login-page"><form className="card login-card" onSubmit={(event) => void login(event)}>
    <span className="success-icon"><KeyRound size={25}/></span><h1>Вход владельца</h1>
    <p className="muted">{demo ? 'Пароль задан при запуске демонстрационного экземпляра.' : 'Введите пароль от кабинета компании.'}</p>
    <Field label="Пароль" error={error}><input name="password" type="password" autoComplete="current-password" value={password} required maxLength={128} onChange={(event) => setPassword(event.target.value)}/></Field>
    <button className="button primary wide" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
  </form></main>;
}

export function Cabinet({ initial }: { initial: Settings }) {
  const [section, setSection] = useState<Section>('orders');
  const [settings, setSettings] = useState(initial);
  return <main className="wrap cabinet-page">
    <div className="cabinet-heading"><div><p className="place"><CircleUserRound size={17}/> Кабинет владельца</p><h1>Управление</h1></div><span className="muted">{settings.company.name} · {settings.company.city}</span></div>
    <nav className="cabinet-tabs" aria-label="Разделы кабинета">{nav.map(([key, label, Icon]) =>
      <button key={key} type="button" className={key === section ? 'selected' : ''} aria-current={key === section ? 'page' : undefined} onClick={() => setSection(key)}><Icon size={19}/> {label}</button>)
    }</nav>
    {section === 'orders' ? <OrdersPanel/> : section === 'access' ? <AccessPanel/> :
      <SettingsPanel key={section} section={section} initial={settings} onSaved={setSettings}/>}
  </main>;
}

function OrdersPanel() {
  const [formSearch, setFormSearch] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [orders, setOrders] = useState<ListItem[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const refresh = useCallback(() => setReload((old) => old + 1), []);

  useEffect(() => {
    if (selected) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: search, status: filter, page: String(page) });
    setLoading(true);
    setError('');
    void api<{ orders: ListItem[]; more: boolean }>('/api/owner/orders?' + params.toString(), { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setOrders(data.orders); setMore(data.more); }
    }).catch((failure) => {
      if (!controller.signal.aborted) problem(failure, () => {}, setError);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, filter, page, reload, selected]);

  if (selected) return <OrderEditor key={selected} id={selected} onBack={() => { setSelected(null); refresh(); }}/>;
  return <section className="card admin-card">
    <div className="section-title"><div><h2>Заявки</h2><p className="muted small">Откройте заявку, чтобы проверить фото и согласовать выезд.</p></div>
      <button className="button secondary" type="button" onClick={refresh}><RefreshCw size={17}/> Обновить</button></div>
    <div className="admin-filter">
      <form onSubmit={(event) => { event.preventDefault(); setSearch(formSearch); setPage(1); refresh(); }}>
        <input type="search" placeholder="Имя, телефон, адрес, номер или бонус" aria-label="Поиск заявок" value={formSearch} onChange={(event) => setFormSearch(event.target.value)} maxLength={100}/>
        <button className="icon-button" aria-label="Найти"><Search size={19}/></button>
      </form>
      <select aria-label="Фильтр по статусу" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
        <option value="">Все статусы</option>{statusKeys.map((status) => <option value={status} key={status}>{statuses[status]}</option>)}
      </select>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    {loading && <p className="muted" role="status">Загружаем заявки…</p>}
    {!loading && !orders.length && !error && <div className="list-empty"><ClipboardList size={30}/><h3>{search || filter ? 'Ничего не найдено' : 'Заявок пока нет'}</h3><p className="muted">{search || filter ? 'Попробуйте изменить поиск или статус.' : 'Здесь появятся заявки из калькулятора.'}</p></div>}
    {!loading && orders.length > 0 && <div className="admin-list">
      <div className="admin-list-head"><span>Номер и клиент</span><span>Статус</span><span>Цена</span><span aria-hidden="true"/></div>
      {orders.map((order) => <button key={order.id} type="button" className="admin-list-row" onClick={() => setSelected(order.id)}>
        <div><strong>{requestNumber(order.number)} · {order.name}</strong><small>{order.phone} · {formatStamp(order.createdAt)}</small></div>
        <div>{statusBadge(order.status)}</div>
        <span>{order.finalPrice !== null ? money(order.finalPrice) : order.total !== null ? (order.manualCount ? 'от ' : '≈ ') + money(order.total) : 'По фото'}</span>
        <ChevronRight size={19}/>
      </button>)}
    </div>}
    {(page > 1 || more) && <div className="pagination">
      <button className="button secondary" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</button>
      <span>Страница {page}</span><button className="button secondary" type="button" disabled={!more} onClick={() => setPage((p) => p + 1)}>Дальше</button>
    </div>}
  </section>;
}

function OrderEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [order, setOrder] = useState<OwnerOrder | null>(null);
  const [edit, setEdit] = useState<OwnerUpdate>({ status: 'new', finalPrice: null, agreedDate: '', agreedTime: '', note: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const path = '/api/owner/orders/' + id;
  const set = <K extends keyof OwnerUpdate>(key: K, value: OwnerUpdate[K]) => setEdit((old) => ({ ...old, [key]: value }));
  useEffect(() => {
    const controller = new AbortController();
    void api<OwnerOrder>(path, { signal: controller.signal }).then((entry) => {
      if (controller.signal.aborted) return;
      setOrder(entry);
      const { status, finalPrice, agreedDate, agreedTime, note } = entry;
      setEdit({ status, finalPrice, agreedDate, agreedTime, note });
    }).catch((error) => { if (!controller.signal.aborted) problem(error, setErrors, setMessage); });
    return () => controller.abort();
  }, [path]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage(''); setErrors({}); setSuccess(''); setBusy(true);
    try { setOrder(await api<OwnerOrder>(path, json(edit))); setSuccess('Изменения сохранены.'); }
    catch (error) { problem(error, setErrors, setMessage); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setMessage('');
    try { await api(path, { method: 'DELETE' }); onBack(); }
    catch (error) { problem(error, setErrors, setMessage); setBusy(false); }
  }

  return <section>
    <button type="button" className="text-button back-link" onClick={onBack}><ChevronLeft size={18}/> К списку заявок</button>
    {!order ? <p className={message ? 'field-error' : 'muted'}>{message || 'Загружаем заявку…'}</p> : <>
      <div className="detail-title"><h2>Заявка {requestNumber(order.number)}</h2>{statusBadge(order.status)}</div>
      <div className="flow-grid admin-detail">
        <div className="order-side">
          <section className="card summary-card"><h3>Клиент и адрес</h3>
            <dl className="price-lines"><div><dt>Имя</dt><dd>{order.contact.name}</dd></div>
              <div><dt>Телефон</dt><dd><a href={'tel:' + order.contact.phone.replace(/[^+\d]/g, '')}>{order.contact.phone}</a></dd></div>
              <div><dt>Адрес</dt><dd>{order.contact.address}</dd></div>
              <div><dt>Выезд за город</dt><dd>{order.contact.outside ? 'Да' : 'Нет'}</dd></div>
              <div><dt>Пожелание по времени</dt><dd>{order.date ? formatDay(order.date) + (order.time ? ', ' + order.time : '') : 'Без пожеланий'}</dd></div></dl>
            {order.contact.comment && <div className="callout"><strong>Комментарий клиента</strong><p>{order.contact.comment}</p></div>}
          </section>
          <section className="card summary-card"><h3>Состав заказа</h3><OrderItems items={order.items} quote={order.estimate}/></section>
          <section className="card summary-card"><h3>Фото</h3>
            {order.photos.length ? <div className="owner-photos">{order.photos.map((photo, i) => <a key={photo} href={'/api/photos/' + photo} target="_blank" rel="noreferrer" aria-label={'Открыть фото ' + (i + 1)}>
              <img loading="lazy" src={'/api/photos/' + photo} alt={'Фото мебели ' + (i + 1)}/>
            </a>)}</div> : <p className="muted">Фото не приложены.</p>}
          </section>
          {order.bonus && <section className="card summary-card"><h3>Бонус на следующий заказ</h3><p><strong>{order.bonus.code}</strong> · {money(order.bonus.amount)} · чистка от {money(order.bonus.minimum)}</p><p className="muted">Действует до {formatStamp(order.bonus.expires)}. Применяется вручную.</p></section>}
          <section className="card summary-card"><h3><History size={19}/> История</h3>
            <ol className="history">{[...order.history].reverse().map((entry, i) => <li key={i}><div>{statusBadge(entry.status)} <time dateTime={entry.at}>{formatStamp(entry.at)}</time></div>
              <p>{entry.finalPrice !== null && money(entry.finalPrice)} {entry.agreedDate && formatDay(entry.agreedDate)} {entry.agreedTime}</p>{entry.note && <p className="muted">{entry.note}</p>}</li>)}</ol>
          </section>
        </div>
        <div className="order-side">
          <form className="card checkout-form" noValidate onSubmit={(event) => void save(event)}>
            <h3>Согласование</h3>
            <Field label="Статус" error={errors.status}><select value={edit.status} onChange={(event) => set('status', event.target.value as Status)}>
              {statusKeys.map((status) => <option value={status} key={status}>{statuses[status]}</option>)}</select></Field>
            <Field label="Итоговая цена, ₽" error={errors.finalPrice}><input type="number" min={0} max={1000000} value={edit.finalPrice ?? ''} onChange={(event) => set('finalPrice', event.target.value === '' ? null : Number(event.target.value))}/></Field>
            <div className="field-row"><Field label="Согласованная дата" error={errors.agreedDate}><input type="date" value={edit.agreedDate} onChange={(event) => set('agreedDate', event.target.value)}/></Field>
              <Field label="Согласованное время" error={errors.agreedTime}><input type="time" value={edit.agreedTime} onChange={(event) => set('agreedTime', event.target.value)}/></Field></div>
            <Field label="Приватная заметка" error={errors.note}><textarea rows={3} value={edit.note} maxLength={2000} onChange={(event) => set('note', event.target.value)}/></Field>
            <button className="button primary" disabled={busy}>Сохранить заявку</button>
            {message && <p className="field-error" role="alert">{message}</p>}{success && <p className="success-inline" role="status">{success}</p>}
          </form>
          <EstimateCard quote={order.estimate} minimum={order.minimum}>
            <details><summary>Тарифы на момент отправки</summary><p className="small muted">Минимум {money(order.minimum)}, загрязнения +{order.snapshot.tariffs.heavyPercent}%, вторая сторона +{order.snapshot.tariffs.secondSidePercent}%, выезд {money(order.snapshot.tariffs.travel)}.</p></details>
          </EstimateCard>
          <section className="card summary-card delete-box">
            {!confirm ? <button type="button" className="button danger" onClick={() => setConfirm(true)}><Trash2 size={17}/> Удалить заявку</button> :
              <><h3>Удалить заявку и фото?</h3><p className="muted">Ссылка клиента перестанет открываться.</p>
                <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>Оставить</button>
                  <button type="button" className="button danger" disabled={busy} onClick={() => void remove()}>Удалить навсегда</button></div></>}
          </section>
        </div>
      </div>
    </>}
  </section>;
}

function Numeric({ label, value, update, minimum = 0, maximum = 1000000, error }: {
  label: string; value: number; update: (value: number) => void; minimum?: number; maximum?: number; error?: string;
}) {
  return <Field label={label} error={error}><input type="number" inputMode="numeric" required min={minimum} max={maximum}
    value={Number.isNaN(value) ? '' : value} onChange={(event) => update(event.target.value === '' ? NaN : Number(event.target.value))}/></Field>;
}

function SettingsPanel({ section, initial, onSaved }: { section: SettingSection; initial: Settings; onSaved: (settings: Settings) => void }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const change = <K extends SettingSection>(key: K, value: Settings[K]) => {
    setValues((old) => ({ ...old, [key]: value })); setSuccess('');
  };
  const { company, tariffs, characters, game } = values;
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(''); setErrors({}); setSuccess('');
    try {
      await api('/api/owner/settings/' + section, json(values[section]));
      onSaved(values);
      setSuccess('Настройки сохранены.');
    } catch (error) { problem(error, setErrors, setMessage); }
    finally { setBusy(false); }
  }
  function area<K extends keyof Company>(key: K, label: string, type = 'text') {
    return <Field label={label} error={errors[key]}><input type={type} value={company[key]} onChange={(event) => change('company', { ...company, [key]: event.target.value })}/></Field>;
  }
  let content: ReactNode;
  if (section === 'tariffs') {
    const priceGroups = Object.keys(tariffs.prices) as (keyof Tariffs['prices'])[];
    content = <>
      <p className="muted">Базовые цены за один предмет. Сохранённые расчёты заявок остаются в истории.</p>
      <div className="tariff-grid">{priceGroups.map((key) => <fieldset key={key}><legend>{catalog[key].title}</legend>
        {catalog[key].variants.map((variant, i) => <Numeric key={variant} label={variant + ', ₽'} minimum={1} value={tariffs.prices[key][i]} update={(price) => {
          const prices = { ...tariffs.prices, [key]: tariffs.prices[key].map((value, index) => index === i ? price : value) } as Tariffs['prices'];
          change('tariffs', { ...tariffs, prices });
        }}/>)}</fieldset>)}</div>
      {errors.prices && <p className="field-error">{errors.prices}</p>}
      <div className="form-divider"/><div className="field-row">
        <Numeric label="Минимальный заказ на чистку, ₽" value={tariffs.minimum} error={errors.minimum} update={(minimum) => change('tariffs', { ...tariffs, minimum })}/>
        <Numeric label="Выезд за город, ₽" value={tariffs.travel} error={errors.travel} update={(travel) => change('tariffs', { ...tariffs, travel })}/>
        <Numeric label="Сильные загрязнения, %" value={tariffs.heavyPercent} maximum={300} error={errors.heavyPercent} update={(heavyPercent) => change('tariffs', { ...tariffs, heavyPercent })}/>
        <Numeric label="Вторая сторона матраса, %" value={tariffs.secondSidePercent} maximum={300} error={errors.secondSidePercent} update={(secondSidePercent) => change('tariffs', { ...tariffs, secondSidePercent })}/>
      </div></>;
  } else if (section === 'company') {
    content = <><div className="field-row">{area('name', 'Название')}{area('city', 'Город')}{area('operator', 'Оператор данных (ИП или организация)')}{area('phone', 'Рабочий телефон', 'tel')}{area('email', 'Рабочая почта', 'email')}{area('telegram', 'Telegram, @username')}</div>
      <Field label="Территория выезда" error={errors.territory}><textarea rows={3} value={company.territory} onChange={(event) => change('company', { ...company, territory: event.target.value })}/></Field>
      <div className="field-row">{area('accent', 'Акцент в формате #RRGGBB')}<Field label="Выбрать цвет"><input type="color" value={/^#[0-9a-f]{6}$/i.test(company.accent) ? company.accent : '#345744'} onChange={(event) => change('company', { ...company, accent: event.target.value })}/></Field></div>
      <p className="muted small">Контакт появится на сайте после сохранения. Укажите канал, по которому действительно можно связаться с компанией.</p></>;
  } else if (section === 'game') {
    content = <><Field label="Режим игры" error={errors.mode}><select value={game.mode} onChange={(event) => change('game', { ...game, mode: event.target.value as typeof game.mode })}>
      {Object.entries(gameModes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <div className="field-row">
        <Numeric label="Бонус, ₽" minimum={1} value={game.amount} error={errors.amount} update={(amount) => change('game', { ...game, amount })}/>
        <Numeric label="Срок действия, дней" minimum={1} maximum={365} value={game.days} error={errors.days} update={(days) => change('game', { ...game, days })}/>
        <Numeric label="Минимум следующей чистки, ₽" value={game.minimum} error={errors.minimum} update={(minimum) => change('game', { ...game, minimum })}/>
      </div><p className="muted small">Мастер проверяет код и вручную применяет бонус к следующему заказу. Выключение скрывает игру и в ранее отправленных заявках.</p></>;
  } else {
    content = <><Field label="Характер персонажей" error={errors.mood}><select value={characters.mood} onChange={(event) => change('characters', { ...characters, mood: event.target.value as typeof characters.mood })}>
      {Object.entries(moods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <CheckField checked={characters.faces} onChange={(faces) => change('characters', { ...characters, faces })} label="Показывать лица"/>
      <CheckField checked={characters.phrases} onChange={(phrases) => change('characters', { ...characters, phrases })} label="Показывать реплики"/></>;
  }
  return <form className="card admin-card checkout-form settings-form" onSubmit={(event) => void save(event)}>
    <h2>{nav.find(([key]) => key === section)?.[1]}</h2>{content}
    <div className="form-actions"><button className="button primary" disabled={busy}>Сохранить настройки</button></div>
    {message && <p className="field-error" role="alert">{message}</p>}{success && <p className="success-inline" role="status">{success}</p>}
  </form>;
}

function AccessPanel() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  async function change(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setErrors({}); setMessage(''); setSuccess('');
    try {
      await api('/api/owner/password', json({ current, password }));
      setCurrent(''); setPassword(''); setSuccess('Пароль изменён. Прежние сеансы завершены.');
    } catch (error) { problem(error, setErrors, setMessage); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setMessage('');
    try { await api('/api/owner/logout', json({})); window.location.reload(); }
    catch (error) { problem(error, setErrors, setMessage); setBusy(false); }
  }
  return <form className="card admin-card checkout-form settings-form" onSubmit={(event) => void change(event)}>
    <h2>Доступ</h2><p className="muted">Новый пароль должен содержать от 12 до 128 символов.</p>
    <div className="field-row"><Field label="Текущий пароль" error={errors.current}><input type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required maxLength={128}/></Field>
      <Field label="Новый пароль" error={errors.password}><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128}/></Field></div>
    <div className="form-actions"><button className="button primary" disabled={busy}>Сменить пароль</button><button type="button" className="button secondary" disabled={busy} onClick={() => void logout()}><LogOut size={17}/> Выйти</button></div>
    {message && <p className="field-error" role="alert">{message}</p>}{success && <p className="success-inline" role="status">{success}</p>}
  </form>;
}
