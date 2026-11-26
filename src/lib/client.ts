import type { FieldErrors } from './domain';

export class ClientError extends Error {
  constructor(message: string, public status: number, public fields: FieldErrors = {}) { super(message); }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response;
  try {
    response = await fetch(path, { ...options, cache: 'no-store' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ClientError('Нет связи с сервером. Проверьте соединение и повторите.', 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new ClientError(data?.error ?? 'Сервер не ответил. Повторите действие.', response.status, data?.fields);
  return data as T;
}
export const json = (data: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const errorText = (error: unknown) => error instanceof ClientError ? error.message : 'Не удалось выполнить действие. Попробуйте ещё раз.';

type StoredPhoto = { draft: string; id: string; file: Blob; name: string; state: 'local' | 'ready'; removed?: boolean };
export type { StoredPhoto };

function openPhotos() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('myagko-draft', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('photos', { keyPath: 'id' }).createIndex('draft', 'draft'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function photoStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openPhotos();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('photos', mode);
      const request = operation(tx.objectStore('photos'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export const loadPhotos = (draft: string) => photoStore<StoredPhoto[]>('readonly', (store) => store.index('draft').getAll(draft));
export const storePhoto = (file: StoredPhoto) => photoStore('readwrite', (store) => store.put(file));
export const forgetPhoto = (id: string) => photoStore('readwrite', (store) => store.delete(id));

export async function preparePhoto(original: File) {
  if (original.size <= 4 * 1024 * 1024) return original;
  // Limit client decoding. The server still checks the real format and every byte.
  if (original.size > 24 * 1024 * 1024) throw new Error('Размер оригинала должен быть до 24 МБ.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(original); }
  catch { throw new Error('Браузер не смог прочитать фото. Выберите другой снимок.'); }
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .83));
    if (!blob || blob.size > 4 * 1024 * 1024) throw new Error('Выберите фото меньшего размера.');
    return blob;
  } finally {
    bitmap.close();
  }
}
