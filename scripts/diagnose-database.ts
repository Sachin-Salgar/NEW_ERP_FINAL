import dotenv from 'dotenv';
import fs from 'node:fs';
import pg from 'pg';

const localEnvLoaded = fs.existsSync('.env.local');
const environmentKeys = new Set(Object.keys(process.env));
dotenv.config({ path: '.env.local', override: false });

function describeUrl(name: string, value: string | undefined): string {
  if (!value) return `${name}: absent`;
  const url = new URL(value);
  return `${name}: source=${environmentKeys.has(name) ? 'environment' : '.env.local'} host=${url.hostname} port=${url.port || '5432'} database=${url.pathname.slice(1)} user=${decodeURIComponent(url.username)} password=${url.password ? '<present>' : '<absent>'}`;
}

async function probe(name: string, value: string | undefined): Promise<void> {
  if (!value) return;
  const pool = new pg.Pool({ connectionString: value, ssl: false, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await pool.query<{ userName: string; databaseName: string; version: string }>(
      'SELECT current_user AS "userName", current_database() AS "databaseName", version()',
    );
    console.log(
      `${name}: CONNECTED user=${result.rows[0].userName} database=${result.rows[0].databaseName} server=${result.rows[0].version.split(' on ')[0]}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown database error';
    console.error(`${name}: FAILED code=${(error as { code?: string }).code ?? '<none>'} message=${message.replace(/password authentication failed for user "[^"]+"/i, 'password authentication failed for user <redacted>')}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

console.log(`.env.local: ${localEnvLoaded ? 'present and loaded' : 'absent'}`);
console.log(describeUrl('DATABASE_URL', process.env.DATABASE_URL));
console.log(describeUrl('TEST_DATABASE_URL', process.env.TEST_DATABASE_URL));
console.log(`DATABASE_SSL_MODE=${process.env.DATABASE_SSL_MODE ?? '<default=require>'}`);
console.log(`PG admin variables: ${process.env.PGUSER && process.env.PGPASSWORD ? 'present' : 'incomplete'}`);
await probe('DATABASE_URL', process.env.DATABASE_URL);
await probe('TEST_DATABASE_URL', process.env.TEST_DATABASE_URL);
