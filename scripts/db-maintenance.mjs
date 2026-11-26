import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Укажите DATABASE_URL.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const photos = await client.query("DELETE FROM photos WHERE order_id IS NULL AND created_at <= now() - interval '24 hours'");
  const sessions = await client.query('DELETE FROM owner_sessions WHERE expires_at <= now()');
  const limits = await client.query('DELETE FROM rate_limits WHERE ends_at <= now()');
  console.log('Удалены истёкшие записи. Фото: ' + photos.rowCount + ', сеансы: ' + sessions.rowCount + ', счётчики: ' + limits.rowCount + '.');
} finally {
  await client.end();
}
