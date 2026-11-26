import { readFileSync } from 'node:fs';
import pg from 'pg';
import { hashPassword } from '../src/lib/password.mjs';

if (!process.env.DATABASE_URL) throw new Error('Укажите DATABASE_URL.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const account = await client.query('SELECT 1 FROM owner_account WHERE singleton');
  if (!account.rowCount) {
    const password = process.env.OWNER_BOOTSTRAP_PASSWORD;
    if (!password || password.length < 12 || password.length > 128) {
      throw new Error('Для первого запуска задайте OWNER_BOOTSTRAP_PASSWORD длиной 12–128 символов.');
    }
    await client.query('INSERT INTO owner_account(password_hash) VALUES($1) ON CONFLICT DO NOTHING', [hashPassword(password)]);
    console.log('Структура базы и пароль владельца подготовлены.');
  } else {
    console.log('Структура базы проверена. Существующий пароль сохранён.');
  }
} finally {
  await client.end();
}
