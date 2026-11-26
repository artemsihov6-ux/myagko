'use client';

import { cloneElement, isValidElement, useId, useState, type AriaAttributes, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Check, ChevronLeft, ImagePlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { allowedPhotoTypes, type Contact, type FieldErrors } from '@/lib/domain';
import { api, ClientError, errorText, forgetPhoto, loadPhotos, preparePhoto, storePhoto, type StoredPhoto } from '@/lib/client';

export type DraftPhoto = StoredPhoto & { preview: string; status: 'local' | 'uploading' | 'ready' | 'error' | 'removing'; message?: string };

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const id = useId();
  const field = isValidElement<AriaAttributes>(children)
    ? cloneElement(children, { 'aria-labelledby': id, 'aria-invalid': error ? true : children.props['aria-invalid'], 'aria-describedby': error ? id + '-error' : undefined })
    : children;
  return <label className="field"><span id={id}>{label}</span>{field}{error && <span id={id + '-error'} className="field-error" role="alert">{error}</span>}</label>;
}

export function CheckField({ checked, onChange, label, detail, invalid }: { checked: boolean; onChange: (checked: boolean) => void; label: React.ReactNode; detail?: React.ReactNode; invalid?: boolean }) {
  return <label className="check-field"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-invalid={invalid || undefined}/>
    <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span></label>;
}

export function PhotoPicker({ draft, photos, update, required, error, disabled, onPreparing }: {
  draft: string; photos: DraftPhoto[]; update: (fn: (items: DraftPhoto[]) => DraftPhoto[]) => void;
  required: boolean; error?: string; disabled: boolean; onPreparing: (busy: boolean) => void;
}) {
  const [message, setMessage] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  function change(id: string, patch: Partial<DraftPhoto>) {
    update((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  async function upload(photo: DraftPhoto) {
    change(photo.id, { status: 'uploading', message: undefined, removed: false });
    try {
      await api('/api/photos/' + photo.id, {
        method: 'PUT',
        headers: { 'Content-Type': photo.file.type, 'x-draft-key': draft }, body: photo.file,
      });
      await storePhoto({ draft, id: photo.id, file: photo.file, name: photo.name, state: 'ready' }).catch(() => setStorageWarning(true));
      change(photo.id, { status: 'ready', state: 'ready' });
    } catch (error) {
      change(photo.id, { status: 'error', message: errorText(error) });
    }
  }
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!incoming.length) return;
    const slots = 3 - photos.length;
    setMessage(incoming.length > slots ? 'Можно приложить до трёх фото.' : '');
    setPreparing(true);
    onPreparing(true);
    try {
      // Add the pending cards together before any upload starts.
      const selected: DraftPhoto[] = [];
      for (const file of incoming.slice(0, slots)) {
        if (!allowedPhotoTypes.includes(file.type)) {
          setMessage('Подойдут JPEG, PNG или WebP.');
          continue;
        }
        try {
          const ready = await preparePhoto(file);
          const photo: DraftPhoto = { draft, id: crypto.randomUUID(), file: ready, name: file.name, state: 'local', preview: URL.createObjectURL(ready), status: 'uploading' };
          selected.push(photo);
          await storePhoto({ draft, id: photo.id, file: ready, name: file.name, state: 'local' }).catch(() => setStorageWarning(true));
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Не удалось открыть фото.');
        }
      }
      update((old) => [...old, ...selected]);
      await Promise.all(selected.map(upload));
    } finally {
      setPreparing(false);
      onPreparing(false);
    }
  }
  async function remove(photo: DraftPhoto) {
    change(photo.id, { status: 'removing', message: undefined });
    try {
      await api('/api/photos/' + photo.id, { method: 'DELETE', headers: { 'x-draft-key': draft } });
      await forgetPhoto(photo.id).catch(() => setStorageWarning(true));
      URL.revokeObjectURL(photo.preview);
      update((items) => items.filter((item) => item.id !== photo.id));
    } catch (error) {
      change(photo.id, { status: 'error', message: errorText(error), removed: true });
    }
  }

  return <fieldset className="photo-field" aria-describedby="photo-help">
    <legend>Фотографии {required ? '(обязательно)' : '(по желанию)'}</legend>
    <p id="photo-help" className="muted small">До 3 фото в JPEG, PNG или WebP. Снимите мебель целиком и крупно покажите пятна. Оригинал до 24 МБ.</p>
    {photos.length > 0 && <ul className="photo-list">{photos.map((photo) => <li key={photo.id}>
      <img src={photo.preview} alt={photo.name}/>
      <div className="photo-actions">
        {(photo.status === 'uploading' || photo.status === 'removing') && <LoaderCircle aria-label="Обработка фото" className="spin" size={19}/>}
        {photo.status === 'ready' && <Check aria-label="Фото загружено" size={19}/>}
        {(photo.status === 'error' || photo.status === 'local') && <button type="button" className="icon-button" disabled={disabled} aria-label={'Повторить ' + (photo.removed ? 'удаление' : 'загрузку') + ' ' + photo.name}
          onClick={() => void (photo.removed ? remove(photo) : upload(photo))}><RefreshCw size={16}/></button>}
        <button type="button" className="icon-button" disabled={disabled || photo.status === 'uploading' || photo.status === 'removing'} onClick={() => void remove(photo)} aria-label={'Удалить ' + photo.name}><Trash2 size={16}/></button>
      </div>
      {photo.message && <span className="field-error">{photo.message}</span>}
    </li>)}</ul>}
    {photos.length < 3 && <label className="upload-target">
      {preparing ? <LoaderCircle className="spin" size={20}/> : <ImagePlus size={20}/>} {preparing ? 'Подготавливаем снимки…' : 'Добавить фото'} <span>{photos.length} / 3</span>
      <input type="file" aria-label="Добавить фото" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || preparing || !draft} onChange={(event) => void choose(event)}/>
    </label>}
    {storageWarning && <p className="field-error">Браузер не сохранил фото в черновик. Оставьте страницу открытой до отправки.</p>}
    {(error || message) && <p className="field-error with-icon" role="alert"><Camera size={16}/> {error || message}</p>}
  </fieldset>;
}

export async function restorePhotos(draft: string): Promise<DraftPhoto[]> {
  const stored = await loadPhotos(draft);
  return stored.map((entry) => ({ ...entry, status: entry.state, preview: URL.createObjectURL(entry.file) }));
}

export function CheckoutForm({ value, setValue, errors, photos, draft, update, requiredPhoto, busy, onSubmit, onBack }: {
  value: Contact; setValue: (value: Contact) => void; errors: FieldErrors; photos: DraftPhoto[]; draft: string;
  update: (fn: (items: DraftPhoto[]) => DraftPhoto[]) => void; requiredPhoto: boolean; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onBack: () => void;
}) {
  const [preparing, setPreparing] = useState(false);
  const set = <K extends keyof Contact,>(key: K, next: Contact[K]) => setValue({ ...value, [key]: next });
  function text(key: 'name' | 'address' | 'phone' | 'date' | 'time', props: React.ComponentProps<'input'>) {
    return <input {...props} name={key} value={value[key]} onChange={(event) => set(key, event.target.value)} aria-invalid={!!errors[key] || undefined}/>;
  }
  const incomplete = photos.some((photo) => photo.status !== 'ready');
  return <form className="card checkout-form" noValidate onSubmit={onSubmit}>
    <h2>Контактные данные</h2>
    <div className="field-row"><Field label="Имя" error={errors.name}>{text('name', { autoComplete: 'name', maxLength: 70, placeholder: 'Как к вам обращаться', required: true })}</Field>
      <Field label="Телефон" error={errors.phone}>{text('phone', { type: 'tel', autoComplete: 'tel', maxLength: 35, placeholder: '+7', required: true })}</Field></div>
    <Field label="Адрес" error={errors.address}>{text('address', { autoComplete: 'street-address', maxLength: 240, placeholder: 'Населённый пункт, улица, дом', required: true })}</Field>
    <CheckField checked={value.outside} onChange={(next) => set('outside', next)} label="Выезд за город" detail="Доплата появится в расчёте."/>
    <div className="form-divider"/><h2>Когда вам удобно</h2>
    <p className="muted">Дата и время по желанию. Мастер подтвердит запись после разговора.</p>
    <div className="field-row"><Field label="Желаемая дата" error={errors.date}>{text('date', { type: 'date' })}</Field>
      <Field label="Желаемое время" error={errors.time}>{text('time', { type: 'time' })}</Field></div>
    <div className="form-divider"/>
    <PhotoPicker draft={draft} photos={photos} update={update} required={requiredPhoto} error={errors.photos} disabled={busy} onPreparing={setPreparing}/>
    <Field label="Комментарий (по желанию)" error={errors.comment}><textarea rows={3} maxLength={1000} placeholder="Например, как пройти к подъезду" value={value.comment} onChange={(event) => set('comment', event.target.value)}/></Field>
    <CheckField checked={value.consent} onChange={(next) => set('consent', next)} invalid={!!errors.consent}
      label={<>Согласен на <a href="/politika" target="_blank" rel="noreferrer">обработку данных</a> для этой заявки</>}/>
    {errors.consent && <span className="field-error" role="alert">{errors.consent}</span>}
    {(errors.form || errors.items) && <p className="field-error" role="alert">{errors.form || errors.items}</p>}
    <div className="form-actions">
      <button type="button" className="button secondary" disabled={busy} onClick={onBack}><ChevronLeft size={18}/> К заказу</button>
      <button className="button primary" disabled={busy || incomplete || preparing || !draft}>{busy ? <><LoaderCircle className="spin" size={19}/> Отправляем…</> : 'Отправить заявку'}</button>
    </div>
    {incomplete && <p className="muted small">Завершите загрузку фото или удалите его, чтобы отправить заявку.</p>}
  </form>;
}

export function submissionErrors(error: unknown, update: (fn: (items: DraftPhoto[]) => DraftPhoto[]) => void) {
  if (error instanceof ClientError && Object.keys(error.fields).length) {
    if (error.fields.photos?.includes('Срок хранения')) update((items) => items.map((item) => ({ ...item, status: 'error', message: 'Повторите загрузку.' })));
    return error.fields;
  }
  return { form: errorText(error) };
}
