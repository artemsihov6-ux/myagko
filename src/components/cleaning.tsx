'use client';

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ChevronLeft, ChevronRight, MapPin, Minus, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { api, forgetPhoto, json } from '@/lib/client';
import {
  catalog, categories, emptyContact, estimate, fields, furniture, itemDetails, itemKey, itemSchema,
  itemTitle, itemTotal, mergeItem, money, requestSchema, type Category, type Contact, type FieldErrors, type Item, type Settings,
} from '@/lib/domain';
import { CheckoutForm, CheckField, Field, restorePhotos, submissionErrors, type DraftPhoto } from './checkout';
import { EstimateCard, OrderItems } from './estimate';
import { Footer, Header, icons, stageTints } from './site';
import { FurnitureStage } from './stage';

type Step = 'choose' | 'cart' | 'checkout';
type Draft = { key: string; items: Item[]; contact: Contact; step: Step };
const draftStorage = 'myagko.order.v1';
const emptyDraft: Draft = { key: '', items: [], contact: emptyContact, step: 'choose' };
function freshDraft(): Draft { return { ...emptyDraft, key: crypto.randomUUID() }; }
function recoverDraft(): Draft {
  try {
    const raw = JSON.parse(localStorage.getItem(draftStorage) || 'null') as Partial<Draft> | null;
    if (!raw?.key || typeof raw.key !== 'string') return freshDraft();
    const items = Array.isArray(raw.items) ? raw.items.flatMap((item) => {
      const parsed = itemSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    }) : [];
    const step = items.length && (raw.step === 'checkout' || raw.step === 'cart') ? raw.step : 'choose';
    return { key: raw.key, items, contact: { ...emptyContact, ...raw.contact }, step };
  } catch { return freshDraft(); }
}

function Quantity({ qty, change, label = 'Количество', limit = 99 }: { qty: number; change: (qty: number) => void; label?: string; limit?: number }) {
  return <div className="quantity" role="group" aria-label={label}>
    <button type="button" aria-label="Уменьшить количество" disabled={qty <= 1} onClick={() => change(qty - 1)}><Minus size={17}/></button>
    <output aria-live="polite">{qty}</output>
    <button type="button" aria-label="Увеличить количество" disabled={qty >= limit} onClick={() => change(qty + 1)}><Plus size={17}/></button>
  </div>;
}

export function Cleaning({ settings, initialCategory, initialDirect, demo, children }: { settings: Settings; initialCategory: Category; initialDirect?: boolean; demo: boolean; children: ReactNode }) {
  const { company, tariffs, characters } = settings;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selection, setSelection] = useState<Item>(() => furniture(initialCategory));
  const [editing, setEditing] = useState<string | null>(null);
  const [entryError, setEntryError] = useState('');
  const [undo, setUndo] = useState<Item | null>(null);
  const [lastOrder, setLastOrder] = useState('');
  const [notice, setNotice] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [draftWarning, setDraftWarning] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [restoringPhotos, setRestoringPhotos] = useState(true);
  const reduced = useReducedMotion();
  const step = draft.step;
  const quote = estimate(draft.items, tariffs, draft.contact.outside);
  const selectedPrice = itemTotal(selection, tariffs);
  const count = draft.items.reduce((total, item) => total + item.qty, 0);
  const category = selection.category;

  useEffect(() => {
    const old = recoverDraft();
    try {
      const previous = localStorage.getItem('myagko.last-order') || '';
      if (/^\/zayavka\/[\w-]{43}$/.test(previous)) setLastOrder(previous);
    } catch {}
    setDraft(initialDirect ? { ...old, step: 'choose' } : old);
    let active = true;
    void restorePhotos(old.key).then((items) => {
      if (active) setPhotos(items);
      else items.forEach((photo) => URL.revokeObjectURL(photo.preview));
    }).catch(() => {}).finally(() => { if (active) setRestoringPhotos(false); });
    return () => { active = false; };
  }, [initialDirect]);
  useEffect(() => {
    if (!draft.key) return;
    try { localStorage.setItem(draftStorage, JSON.stringify(draft)); }
    catch { setDraftWarning(true); }
  }, [draft]);

  function go(next: Step, section = 'vybor') {
    setDraft((old) => ({ ...old, step: next }));
    setErrors({});
    if (next !== 'choose') setEditing(null);
    requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  function select(next: Category) {
    if (next === category) return;
    setEntryError('');
    setNotice('');
    setSelection(furniture(next));
  }
  function patch(next: Partial<Item>) {
    setEntryError('');
    setNotice('');
    setSelection((old) => ({ ...old, ...next }));
  }
  function add() {
    const parsed = itemSchema.safeParse(selection);
    if (!parsed.success) {
      setEntryError(parsed.error.issues[0].message);
      return;
    }
    const base = editing ? draft.items.filter((item) => itemKey(item) !== editing) : draft.items;
    const next = mergeItem(base, parsed.data);
    if (!next) { setEntryError('До 30 позиций и до 99 предметов в каждой.'); return; }
    setDraft((old) => ({ ...old, items: next }));
    if (editing) {
      setSelection(furniture(category));
      go('cart');
    } else {
      setNotice('В заказе: ' + itemTitle(parsed.data).toLocaleLowerCase('ru') + ', ' + parsed.data.qty + ' шт.');
    }
  }
  function edit(item: Item) {
    setSelection(item);
    setEditing(itemKey(item));
    setEntryError('');
    go('choose');
  }
  function remove(item: Item) {
    setUndo(item);
    setDraft((old) => ({ ...old, items: old.items.filter((one) => one !== item) }));
  }
  function restore() {
    if (!undo) return;
    const next = mergeItem(draft.items, undo);
    if (!next) { setNotice('Освободите место в заказе, чтобы вернуть предмет.'); return; }
    setDraft((old) => ({ ...old, items: next }));
    setUndo(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || restoringPhotos || photos.some((photo) => photo.status !== 'ready')) return;
    const payload = { key: draft.key, items: draft.items, contact: draft.contact, photos: photos.map((photo) => photo.id) };
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fields(parsed.error));
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const result = await api<{ path: string }>('/api/orders', json(parsed.data));
      try {
        localStorage.setItem('myagko.last-order', result.path);
        localStorage.removeItem(draftStorage);
      } catch {}
      await Promise.all(photos.map((photo) => forgetPhoto(photo.id).catch(() => {})));
      window.location.assign(result.path);
    } catch (error) {
      setErrors(submissionErrors(error, setPhotos));
      setSending(false);
    }
  }

  return <div style={{ '--company': company.accent } as CSSProperties}>
    <Header company={company} onSection={(section) => { if (!sending) go('choose', section); }}><button type="button" className="bag-button" onClick={() => go('cart')} aria-label={'Заказ, ' + count + ' шт.'} disabled={sending}><ShoppingBag size={18}/><span>Заказ</span><b>{count}</b></button></Header>
    <main className="wrap home">
      <div className="workflow" id="vybor">
      {step === 'choose' && <>
        <div className="hero-intro">
          <div><p className="place"><MapPin size={15}/>{company.city} · Химчистка с выездом</p><h1>Чистая мебель.<br className="mobile-break"/> У вас дома.</h1></div>
          <p className="hero-description">Выберите мебель и рассчитайте стоимость. Мастер уточнит детали и согласует выезд.</p>
        </div>
        {demo && <p className="demo-line">Демо · Для проверки используйте вымышленные данные.</p>}
        {editing && <button className="button secondary edit-back" type="button" onClick={() => go('cart')}><ChevronLeft size={17}/> К заказу</button>}
        <div className="builder">
          <div className="viewer-column">
            <FurnitureStage category={category} characters={characters} label={catalog[category].model}/>
            <div className="category-tabs" role="group" aria-label="Предмет мебели">
              {categories.map((key) => {
                const Icon = icons[key];
                return <button type="button" key={key} className={key === category ? 'selected' : ''} aria-pressed={key === category} onClick={() => select(key)}>
                  <Icon size={20} aria-hidden/><span>{catalog[key].title}</span>
                </button>;
              })}
            </div>
          </div>
          <motion.section layout={reduced ? false : 'position'} className="card config-card" aria-label="Параметры предмета">
            <div className="config-title"><h2>{catalog[category].title}</h2><span>{selection.qty === 1 ? 'За один предмет' : 'За ' + selection.qty + ' шт.'}</span></div>
            {category !== 'other' ? <fieldset className="option-field">
              <legend>{category === 'sofa' ? 'Размер дивана' : category === 'mattress' ? 'Размер матраса' : category === 'chair' ? 'Что чистим' : 'Тип кресла'}</legend>
              <div className="variant-list">{catalog[category].variants.map((variant, index) => <button
                type="button" key={variant} className={index === selection.variant ? 'selected' : ''} aria-pressed={index === selection.variant} onClick={() => patch({ variant: index })}>{variant}</button>)}</div>
            </fieldset> : <Field label="Что нужно почистить" error={entryError && entryError.includes('Опишите') ? entryError : undefined}>
              <textarea rows={3} value={selection.description} maxLength={500} onChange={(event) => patch({ description: event.target.value })} placeholder="Например, мягкая банкетка из велюра"/>
            </Field>}
            {category !== 'other' ? <>
              {category === 'mattress' && <CheckField checked={selection.second} onChange={(next) => patch({ second: next })} label="Чистка с двух сторон" detail={'К цене матраса +' + tariffs.secondSidePercent + '%'}/>}
              <CheckField checked={selection.heavy} onChange={(next) => patch({ heavy: next })} label="Сильные загрязнения" detail={'К тарифу +' + tariffs.heavyPercent + '%'}/>
            </> : <p className="muted small">Добавьте хотя бы одно фото при оформлении. Стоимость уточнит мастер.</p>}
            <div className="qty-row"><span>Количество</span><Quantity qty={selection.qty} change={(qty) => patch({ qty })}/></div>
            <div className="config-bottom"><div className="config-price"><div><strong aria-live="polite">{selectedPrice === null ? 'По фото' : money(selectedPrice)}</strong><span>{selectedPrice === null ? 'Ручная оценка' : 'Предварительно'}</span></div>
              {selectedPrice !== null && tariffs.minimum > 0 && <span className="min-label">Минимум на чистку<br/><b>{money(tariffs.minimum)}</b></span>}</div>
              {entryError && !entryError.includes('Опишите') && <p className="field-error" role="alert">{entryError}</p>}
              <button type="button" className="button primary add-button" disabled={!draft.key} onClick={add}>{editing ? <Pencil size={19}/> : <Plus size={20}/>} {editing ? 'Сохранить позицию' : 'В заказ'}</button>
              {notice && <div className="added-note" role="status"><span>{notice}</span><button type="button" className="text-button" onClick={() => go('cart')}>Смотреть заказ <ChevronRight size={14}/></button></div>}
            </div>
          </motion.section>
        </div>
        <div className="builder-foot"><p>3D-модель показывает тип мебели. Вариант меняет тариф.</p><a href="#uslugi">Смотреть услуги <ArrowDown size={15}/></a></div>
        {lastOrder && <a className="last-order small" href={lastOrder}>Открыть последнюю заявку</a>}
      </>}
      {step === 'cart' && <>
        <button className="text-button back-link" type="button" onClick={() => go('choose')}><ChevronLeft size={19}/> К выбору мебели</button>
        <div className="flow-heading"><h1>Ваш заказ</h1><p>{count ? 'Проверьте состав и переходите к заявке.' : 'Здесь появится мебель, которую вы добавите.'}</p></div>
        {undo && <div className="undo-bar" role="status">{itemTitle(undo)} убран из заказа. <button type="button" className="text-button" onClick={restore}>Отменить удаление</button></div>}
        {count === 0 ? <div className="card empty-cart"><ShoppingBag size={36}/><h2>Заказ пока пуст</h2><p className="muted">Выберите мебель, чтобы увидеть предварительную стоимость.</p><button type="button" className="button primary" onClick={() => go('choose')}>Выбрать мебель</button></div> :
          <div className="flow-grid"><section className="card cart-list" aria-label="Мебель в заказе">
            {draft.items.map((item, i) => {
              const Icon = icons[item.category];
              return <div className="cart-line" key={itemKey(item)}>
                <span className={'service-icon ' + stageTints[item.category]}><Icon size={22}/></span>
                <div className="cart-name"><strong>{itemTitle(item)}</strong><small>{itemDetails(item)}</small></div>
                <Quantity qty={item.qty} label={'Количество: ' + itemTitle(item)} change={(qty) => setDraft((old) => ({ ...old, items: old.items.map((line) => line === item ? { ...line, qty } : line) }))}/>
                <strong className="line-price">{quote.lines[i] == null ? 'По фото' : money(quote.lines[i]!)}</strong>
                <div className="line-actions"><button type="button" className="icon-button" aria-label={'Изменить: ' + itemTitle(item)} onClick={() => edit(item)}><Pencil size={17}/></button>
                  <button type="button" className="icon-button" aria-label={'Удалить: ' + itemTitle(item)} onClick={() => remove(item)}><Trash2 size={17}/></button></div>
              </div>;
            })}
            <button className="button secondary" type="button" onClick={() => go('choose')}><Plus size={18}/> Добавить мебель</button>
          </section><EstimateCard quote={quote} minimum={tariffs.minimum}>
            <button className="button primary wide" type="button" onClick={() => go('checkout')}>Оформить заявку <ChevronRight size={18}/></button>
          </EstimateCard></div>}
        {notice && undo && <p className="muted small" role="status">{notice}</p>}
      </>}
      {step === 'checkout' && <>
        <button className="text-button back-link" type="button" disabled={sending} onClick={() => go('cart')}><ChevronLeft size={19}/> К заказу</button>
        <div className="flow-heading"><h1>Оформление заявки</h1><p>Оставьте контакты. Мастер свяжется с вами перед выездом.</p></div>
        {demo && <p className="demo-line">Демо · Используйте вымышленные имя, адрес и фотографии.</p>}
        <div className="flow-grid">
          <CheckoutForm value={draft.contact} setValue={(contact) => setDraft((old) => ({ ...old, contact }))}
            errors={errors} photos={photos} draft={draft.key} update={setPhotos} requiredPhoto={quote.manualCount > 0} busy={sending || restoringPhotos}
            onSubmit={(event) => void submit(event)} onBack={() => go('cart')}/>
          <div className="order-side"><EstimateCard quote={quote} minimum={tariffs.minimum}/>
            <section className="card summary-card"><h2>Состав заказа</h2><OrderItems items={draft.items} quote={quote}/></section></div>
        </div>
      </>}
      {draftWarning && <p className="field-error">Браузер не сохранил черновик. Оставьте страницу открытой до отправки.</p>}
      </div>
      {step === 'choose' && children}
    </main>
    <Footer company={company}/>
  </div>;
}
