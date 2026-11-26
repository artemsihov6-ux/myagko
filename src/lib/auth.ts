import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { cookies } from 'next/headers';
import { query } from './db';
import { digest, HttpError, tokenPattern } from './http';

const sessionCookie = 'myagko_owner';
const maxAge = 60 * 60 * 24 * 7;
const cookieOptions = () => ({
  path: '/', httpOnly: true, sameSite: 'strict' as const,
  secure: process.env.APP_ORIGIN?.startsWith('https:') ?? process.env.NODE_ENV === 'production',
});
export async function ownerSession(client?: PoolClient) {
  const raw = (await cookies()).get(sessionCookie)?.value;
  if (!raw || !tokenPattern.test(raw)) return null;
  const hashed = digest(raw);
  const statement = 'SELECT 1 FROM owner_sessions WHERE digest=$1 AND expires_at>now()';
  const result = client ? await client.query(statement, [hashed]) : await query(statement, [hashed]);
  return result.rowCount ? hashed : null;
}
export async function requireOwner(client?: PoolClient) {
  const session = await ownerSession(client);
  if (!session) throw new HttpError(401, 'Войдите в кабинет владельца.');
  return session;
}
export async function createSession(client: PoolClient) {
  const raw = randomBytes(32).toString('base64url');
  await client.query('DELETE FROM owner_sessions WHERE expires_at <= now()');
  await client.query('INSERT INTO owner_sessions VALUES($1, now() + make_interval(secs => $2))', [digest(raw), maxAge]);
  return raw;
}
export async function setSession(raw: string) {
  (await cookies()).set(sessionCookie, raw, { ...cookieOptions(), maxAge });
}
export async function clearSession() {
  (await cookies()).set(sessionCookie, '', { ...cookieOptions(), maxAge: 0 });
}
