import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const databaseDir = resolve('.data/postgres');
const port = Number(process.env.MYAGKO_DB_PORT ?? 55432);
const cluster = new EmbeddedPostgres({
  databaseDir, port, user: 'myagko', password: 'myagko-local',
  persistent: true, authMethod: 'scram-sha-256', autoRehydrateSymlinks: true,
  postgresFlags: ['-h', '127.0.0.1'],
});
if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await cluster.initialise();
await cluster.start();
const client = cluster.getPgClient('postgres');
await client.connect();
try {
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = 'myagko'")).rowCount) {
    await client.query('CREATE DATABASE myagko');
  }
} finally {
  await client.end();
}
console.log('PostgreSQL готов. Порт ' + port + ', база myagko.');
await new Promise((done) => {
  process.once('SIGINT', done);
  process.once('SIGTERM', done);
});
await cluster.stop();
