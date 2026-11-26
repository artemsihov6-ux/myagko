import sharp from 'sharp';
import { requireOwner } from '@/lib/auth';
import { query, transaction } from '@/lib/db';
import { allowedPhotoTypes, photoLimit } from '@/lib/domain';
import { checkOrigin, digest, HttpError, limit, privateHeaders, readBytes, reply, route, uuidPattern } from '@/lib/http';
import { lockDraft } from '@/lib/orders';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
async function draft(request: Request, context: Context) {
  checkOrigin(request);
  const key = request.headers.get('x-draft-key') || '';
  const { id } = await context.params;
  if (!uuidPattern.test(key) || !uuidPattern.test(id)) throw new HttpError(400, 'Некорректный черновик.');
  return { id, key: digest(key) };
}

export const PUT = route(async (request: Request, context: Context) => {
  const { id, key } = await draft(request, context);
  await limit('photo-upload', request, 55, 600);
  await limit('photo-draft', request, 18, 600, key);
  const type = request.headers.get('content-type') || '';
  if (!allowedPhotoTypes.includes(type)) throw new HttpError(415, 'Подойдут JPEG, PNG или WebP.');
  const bytes = await readBytes(request, photoLimit);
  let compressed;
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!metadata.format || 'image/' + metadata.format !== type || (metadata.pages ?? 1) > 1) {
      throw new Error('Invalid format');
    }
    compressed = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    throw new HttpError(422, 'Пришлите обычное фото JPEG, PNG или WebP до 40 мегапикселей.');
  }
  return transaction(async (client) => {
    await lockDraft(client, key);
    if ((await client.query('SELECT 1 FROM orders WHERE idem_digest=$1 UNION ALL SELECT 1 FROM removed_requests WHERE digest=$1', [key])).rowCount) {
      throw new HttpError(409, 'Черновик уже отправлен.');
    }
    await client.query("DELETE FROM photos WHERE order_id IS NULL AND created_at <= now() - interval '24 hours'");
    const own = await client.query<{ id: string }>('SELECT id FROM photos WHERE draft_digest=$1 AND order_id IS NULL', [key]);
    if (own.rows.some((row) => row.id === id)) return reply({ id });
    if (own.rows.length >= 3) throw new HttpError(422, 'Можно приложить до трёх фото.');
    const inserted = await client.query('INSERT INTO photos(id,draft_digest,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [id, key, compressed]);
    if (!inserted.rowCount) throw new HttpError(409, 'Не удалось сохранить это фото.');
    return reply({ id }, 201);
  });
});

export const DELETE = route(async (request: Request, context: Context) => {
  const { id, key } = await draft(request, context);
  await limit('photo-delete', request, 100, 600);
  await transaction(async (client) => {
    await lockDraft(client, key);
    await client.query('DELETE FROM photos WHERE id=$1 AND draft_digest=$2 AND order_id IS NULL', [id, key]);
  });
  return reply({ ok: true });
});

export const GET = route(async (request: Request, context: Context) => {
  const owner = await requireOwner();
  await limit('owner-photo', request, 150, 60, owner);
  const { id } = await context.params;
  if (!uuidPattern.test(id)) throw new HttpError(404, 'Фото недоступно.');
  const { rows: [photo] } = await query<{ data: Buffer }>('SELECT data FROM photos WHERE id=$1 AND order_id IS NOT NULL', [id]);
  if (!photo) throw new HttpError(404, 'Фото недоступно.');
  return new Response(new Uint8Array(photo.data), {
    headers: { ...privateHeaders, 'Content-Type': 'image/webp', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' },
  });
});
