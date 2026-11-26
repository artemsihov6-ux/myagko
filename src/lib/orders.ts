import type { PoolClient } from 'pg';
import { getSettings, query } from './db';
import { tokenPattern, uuidPattern } from './http';
import type { Bonus, Contact, Item, OwnerUpdate, PublicOrder, Snapshot, Status } from './domain';

export type HistoryEntry = { at: string; status: Status; finalPrice: number | null; agreedDate: string; agreedTime: string; note: string };
export type OrderRow = {
  id: string; token: string; number: string; items: Item[]; contact: Contact; snapshot: Snapshot;
  status: Status; final_price: number | null; agreed_date: string; agreed_time: string; note: string;
  history: HistoryEntry[]; bonus: Bonus | null; created_at: Date;
};
export type OwnerOrder = PublicOrder & { id: string; contact: Contact; note: string; history: HistoryEntry[]; photos: string[]; snapshot: Snapshot };
export const publicOrder = (row: OrderRow): PublicOrder => ({
  number: Number(row.number), items: row.items, estimate: row.snapshot.estimate, status: row.status,
  finalPrice: row.final_price, agreedDate: row.agreed_date, agreedTime: row.agreed_time,
  date: row.contact.date, time: row.contact.time, createdAt: row.created_at.toISOString(),
  game: row.snapshot.game, bonus: row.bonus, minimum: row.snapshot.tariffs.minimum,
  companyName: row.snapshot.companyName,
});
export async function getPublicOrder(token: string) {
  if (!tokenPattern.test(token)) return null;
  const { rows } = await query<OrderRow>('SELECT * FROM orders WHERE token=$1', [token]);
  if (!rows[0]) return null;
  const order = publicOrder(rows[0]);
  const settings = await getSettings();
  if (settings.game.mode === 'off') order.game = { ...order.game, mode: 'off' };
  return order;
}
export async function getOwnerOrder(id: string): Promise<OwnerOrder | null> {
  if (!uuidPattern.test(id)) return null;
  const { rows } = await query<OrderRow & { photos: string[] }>(
    `SELECT orders.*, ARRAY(SELECT id FROM photos WHERE order_id=orders.id ORDER BY created_at) AS photos
      FROM orders WHERE id=$1`, [id]);
  const row = rows[0];
  return row ? { ...publicOrder(row), id, contact: row.contact, note: row.note, history: row.history, photos: row.photos, snapshot: row.snapshot } : null;
}
export async function lockDraft(client: PoolClient, key: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
}
export const historyRecord = (value: OwnerUpdate): HistoryEntry => ({ ...value, at: new Date().toISOString() });
