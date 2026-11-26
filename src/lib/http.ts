import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { query } from './db';
import type { FieldErrors } from './domain';

export const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const tokenPattern = /^[\w-]{43}$/;
export class HttpError extends Error {
  constructor(public status: number, message: string, public fields?: FieldErrors) { super(message); }
}
export const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: privateHeaders });
export function route<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) return reply({ error: error.message, fields: error.fields }, error.status);
      console.error('Request failed', error instanceof Error ? (error.name + ' ' + ('code' in error ? String(error.code) : '')) : 'unknown');
      return reply({ error: 'Сервис временно недоступен. Попробуйте ещё раз.' }, 503);
    }
  };
}

export function checkOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN;
  const expected = configured
    ? new URL(configured).origin
    : process.env.NODE_ENV === 'production' ? undefined : new URL(request.url).origin;
  if (!expected || request.headers.get('origin') !== expected) {
    throw new HttpError(403, 'Откройте страницу приложения и повторите действие.');
  }
}
export async function readBytes(request: Request, limit: number) {
  const size = Number(request.headers.get('content-length'));
  if (size > limit) throw new HttpError(413, 'Превышен допустимый размер.');
  if (!request.body) throw new HttpError(400, 'Данные отсутствуют.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        throw new HttpError(413, 'Превышен допустимый размер.');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } finally {
    reader.releaseLock();
  }
}
export async function readJson(request: Request, limit = 40_000) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new HttpError(415, 'Ожидаются данные формы.');
  const bytes = await readBytes(request, limit);
  try { return JSON.parse(bytes.toString('utf8')) as unknown; }
  catch { throw new HttpError(400, 'Данные формы повреждены.'); }
}
export async function limit(scope: string, request: Request, max: number, seconds: number, identity?: string) {
  const header = process.env.TRUSTED_IP_HEADER;
  const forwarded = header ? request.headers.get(header)?.split(',')[0]?.trim() || '' : '';
  const source = identity ?? (isIP(forwarded) ? forwarded : 'shared');
  const bucket = digest(scope + ':' + source);
  const { rows } = await query<{ count: number }>(
    `INSERT INTO rate_limits(bucket, count, ends_at) VALUES($1, 1, now() + make_interval(secs => $2))
     ON CONFLICT (bucket) DO UPDATE SET
       count = CASE WHEN rate_limits.ends_at <= now() THEN 1 ELSE LEAST(rate_limits.count + 1, $3) END,
       ends_at = CASE WHEN rate_limits.ends_at <= now() THEN excluded.ends_at ELSE rate_limits.ends_at END
     RETURNING count`, [bucket, seconds, max + 1],
  );
  if (rows[0].count > max) throw new HttpError(429, 'Слишком много запросов. Попробуйте позже.');
}
