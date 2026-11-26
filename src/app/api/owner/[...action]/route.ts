import { z } from 'zod';
import { clearSession, createSession, requireOwner, setSession } from '@/lib/auth';
import { getSettings, query, transaction } from '@/lib/db';
import { defaults, fields, ownerUpdateSchema, settingsSchemas, statusKeys, type SettingSection } from '@/lib/domain';
import { checkOrigin, HttpError, limit, readJson, reply, route, uuidPattern } from '@/lib/http';
import { getOwnerOrder, historyRecord, lockDraft, type OrderRow } from '@/lib/orders';
import { hashPassword, verifyPassword } from '@/lib/password.mjs';

type Context = { params: Promise<{ action: string[] }> };
const passwordText = z.string().min(1).max(128);
const passwordSchema = z.object({ current: passwordText, password: z.string().min(12, 'Введите минимум 12 символов.').max(128) });

export const GET = route(async (request: Request, context: Context) => {
  const session = await requireOwner();
  await limit('owner-read', request, 180, 60, session);
  const [action, part] = (await context.params).action;
  if (action === 'settings' && !part) return reply(await getSettings());
  if (action === 'orders' && part) {
    const order = await getOwnerOrder(part);
    if (!order) throw new HttpError(404, 'Заявка недоступна.');
    return reply(order);
  }
  if (action === 'orders') {
    const url = new URL(request.url);
    const search = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
    const status = z.enum(statusKeys).safeParse(url.searchParams.get('status'));
    const page = Math.max(1, Math.min(5000, parseInt(url.searchParams.get('page') ?? '1', 10) || 1));
    const { rows } = await query(
      `SELECT id, number::integer, contact->>'name' AS name, contact->>'phone' AS phone,
       status, created_at AS "createdAt", (snapshot->'estimate'->>'total')::double precision AS total,
       (snapshot->'estimate'->>'manualCount')::integer AS "manualCount", final_price AS "finalPrice"
       FROM orders
       WHERE ($1='' OR status=$1)
       AND ($2='' OR strpos(lower(contact->>'name'),lower($2))>0 OR strpos(lower(contact->>'address'),lower($2))>0
       OR ($3<>'' AND strpos(regexp_replace(contact->>'phone','[^0-9]','','g'),$3)>0)
       OR ($3<>'' AND ltrim($3,'0')=number::text)
       OR strpos(lower(COALESCE(bonus->>'code','')),lower($2))>0)
       ORDER BY created_at DESC, number DESC LIMIT 31 OFFSET $4`,
      [status.success ? status.data : '', search.replace(/^#/, ''), (/^#?[+0-9().\s-]+$/.test(search) ? search.replace(/\D/g, '') : ''), (page - 1) * 30],
    );
    return reply({ orders: rows.slice(0, 30), more: rows.length > 30 });
  }
  throw new HttpError(404, 'Раздел недоступен.');
});

export const POST = route(async (request: Request, context: Context) => {
  checkOrigin(request);
  const [action, part] = (await context.params).action;
  if (action === 'login' && !part) {
    await limit('login', request, 8, 300);
    const result = z.object({ password: passwordText }).safeParse(await readJson(request, 2048));
    if (!result.success) throw new HttpError(422, 'Введите пароль.');
    const raw = await transaction(async (client) => {
      const { rows: [account] } = await client.query<{ password_hash: string }>('SELECT password_hash FROM owner_account WHERE singleton FOR UPDATE');
      if (!account || !verifyPassword(result.data.password, account.password_hash)) throw new HttpError(401, 'Пароль не подошёл.');
      return createSession(client);
    });
    await setSession(raw);
    return reply({ ok: true });
  }
  const session = await requireOwner();
  await limit('owner-write', request, 60, 60, session);
  if (action === 'logout') {
    await query('DELETE FROM owner_sessions WHERE digest=$1', [session]);
    await clearSession();
    return reply({ ok: true });
  }
  if (action === 'password') {
    await limit('password', request, 6, 300, session);
    const input = passwordSchema.safeParse(await readJson(request, 2048));
    if (!input.success) throw new HttpError(422, 'Проверьте пароли.', fields(input.error));
    const raw = await transaction(async (client) => {
      const { rows: [account] } = await client.query('SELECT password_hash FROM owner_account WHERE singleton FOR UPDATE');
      await requireOwner(client);
      if (!account || !verifyPassword(input.data.current, account.password_hash)) throw new HttpError(422, 'Текущий пароль не подошёл.', { current: 'Проверьте текущий пароль.' });
      await client.query('UPDATE owner_account SET password_hash=$1 WHERE singleton', [hashPassword(input.data.password)]);
      await client.query('DELETE FROM owner_sessions');
      return createSession(client);
    });
    await setSession(raw);
    return reply({ ok: true });
  }
  if (action === 'settings' && part && Object.hasOwn(settingsSchemas, part)) {
    const section = part as SettingSection;
    const input = settingsSchemas[section].safeParse(await readJson(request));
    if (!input.success) throw new HttpError(422, 'Проверьте настройки.', fields(input.error));
    await query(
      `INSERT INTO settings(data) VALUES($1)
       ON CONFLICT(singleton) DO UPDATE SET data=jsonb_set(settings.data, ARRAY[$2], $3::jsonb, true)`,
      [JSON.stringify({ ...defaults, [section]: input.data }), section, JSON.stringify(input.data)],
    );
    return reply({ ok: true });
  }
  if (action === 'orders' && part && uuidPattern.test(part)) {
    const input = ownerUpdateSchema.safeParse(await readJson(request));
    if (!input.success) throw new HttpError(422, 'Проверьте поля заявки.', fields(input.error));
    await transaction(async (client) => {
      const { rows: [current] } = await client.query<OrderRow>('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [part]);
      if (!current) throw new HttpError(404, 'Заявка недоступна.');
      const { status, finalPrice, agreedDate, agreedTime, note } = input.data;
      if (current.status === status && current.final_price === finalPrice && current.agreed_date === agreedDate && current.agreed_time === agreedTime && current.note === note) return;
      await client.query(
        `UPDATE orders SET status=$2, final_price=$3, agreed_date=$4, agreed_time=$5, note=$6, history=history || $7::jsonb WHERE id=$1`,
        [part, status, finalPrice, agreedDate, agreedTime, note, JSON.stringify([historyRecord(input.data)])],
      );
    });
    return reply(await getOwnerOrder(part));
  }
  throw new HttpError(404, 'Раздел недоступен.');
});

export const DELETE = route(async (request: Request, context: Context) => {
  checkOrigin(request);
  const session = await requireOwner();
  await limit('owner-delete', request, 30, 60, session);
  const [action, id] = (await context.params).action;
  if (action !== 'orders' || !id || !uuidPattern.test(id)) throw new HttpError(404, 'Заявка недоступна.');
  await transaction(async (client) => {
    const { rows: [entry] } = await client.query<{ idem_digest: string }>('SELECT idem_digest FROM orders WHERE id=$1', [id]);
    if (!entry) return;
    await lockDraft(client, entry.idem_digest);
    await client.query('INSERT INTO removed_requests VALUES($1) ON CONFLICT DO NOTHING', [entry.idem_digest]);
    await client.query('DELETE FROM orders WHERE id=$1', [id]);
  });
  return reply({ ok: true });
});
