import pg, { type PoolClient } from 'pg';
import { defaults, settingsSchema, type Settings } from './domain';

const globalDb = globalThis as typeof globalThis & { myagkoPool?: pg.Pool };
function pool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return globalDb.myagkoPool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 15_000,
    statement_timeout: 10_000,
  });
}
export const query = <T extends pg.QueryResultRow = pg.QueryResultRow>(statement: string, values: unknown[] = []) => pool().query<T>(statement, values);

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function getSettings(client?: PoolClient): Promise<Settings> {
  const result = client
    ? await client.query('SELECT data FROM settings WHERE singleton')
    : await query('SELECT data FROM settings WHERE singleton');
  return result.rows[0] ? settingsSchema.parse({ ...defaults, ...result.rows[0].data }) : defaults;
}
