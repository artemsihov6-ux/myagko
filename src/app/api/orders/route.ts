import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { estimate, fields, mergeItem, requestSchema, type Item, type Snapshot } from '@/lib/domain';
import { getSettings, transaction } from '@/lib/db';
import { checkOrigin, digest, HttpError, limit, readJson, reply, route } from '@/lib/http';
import { historyRecord, lockDraft } from '@/lib/orders';

export const runtime = 'nodejs';

export const POST = route(async (request: Request) => {
  checkOrigin(request);
  await limit('submit', request, 80, 600);
  const data = await readJson(request);
  const identity = z.object({ key: z.uuidv4() }).safeParse(data);
  if (!identity.success) throw new HttpError(422, 'Обновите страницу и повторите отправку.');
  const key = digest(identity.data.key);
  return transaction(async (client) => {
    await lockDraft(client, key);
    const existing = await client.query<{ token: string }>('SELECT token FROM orders WHERE idem_digest=$1', [key]);
    if (existing.rows[0]) return reply({ path: '/zayavka/' + existing.rows[0].token });
    if ((await client.query('SELECT 1 FROM removed_requests WHERE digest=$1', [key])).rowCount) {
      throw new HttpError(410, 'Эта заявка удалена владельцем. Если нужна новая заявка, начните новый заказ.');
    }
    const parsed = requestSchema.safeParse(data);
    if (!parsed.success) throw new HttpError(422, 'Проверьте поля заявки.', fields(parsed.error));
    const { contact, photos } = parsed.data;
    let items: Item[] = [];
    for (const item of parsed.data.items) {
      const merged = mergeItem(items, item);
      if (!merged) throw new HttpError(422, 'Проверьте количество мебели.', { items: 'До 99 предметов в одной позиции.' });
      items = merged;
    }
    if (photos.length) {
      const result = await client.query(
        "SELECT id FROM photos WHERE id=ANY($1::uuid[]) AND draft_digest=$2 AND order_id IS NULL AND created_at > now() - interval '24 hours' FOR UPDATE",
        [photos, key]);
      if (result.rowCount !== photos.length) throw new HttpError(422, 'Загрузите фото ещё раз.', { photos: 'Срок хранения одного или нескольких черновых фото истёк. Повторите загрузку ниже.' });
    }
    const settings = await getSettings(client);
    const snapshot: Snapshot = { version: 1, companyName: settings.company.name, tariffs: settings.tariffs, game: settings.game, estimate: estimate(items, settings.tariffs, contact.outside) };
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    await client.query(
      'INSERT INTO orders(id, idem_digest, token, items, contact, snapshot, history) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, key, token, JSON.stringify(items), JSON.stringify(contact), JSON.stringify(snapshot),
        JSON.stringify([historyRecord({ status: 'new', finalPrice: null, agreedDate: '', agreedTime: '', note: '' })])],
    );
    if (photos.length) await client.query('UPDATE photos SET order_id=$1 WHERE id=ANY($2::uuid[])', [id, photos]);
    await client.query('DELETE FROM photos WHERE draft_digest=$1 AND order_id IS NULL', [key]);
    return reply({ path: '/zayavka/' + token }, 201);
  });
});
