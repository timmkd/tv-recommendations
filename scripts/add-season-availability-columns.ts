/**
 * One-off, idempotent migration for per-season availability (2026-11-04):
 *   shows.season_streaming, shows.trakt_aired / trakt_completed /
 *   trakt_last_episode / trakt_next_episode / trakt_progress_at,
 *   and the 7plus + 9now rows in streaming_services (free-to-air, unsubscribed).
 *
 * Run: npx tsx scripts/add-season-availability-columns.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@libsql/client';

const COLUMNS: [string, string][] = [
  ['season_streaming', 'text'],
  ['trakt_aired', 'integer'],
  ['trakt_completed', 'integer'],
  ['trakt_last_episode', 'text'],
  ['trakt_next_episode', 'text'],
  ['trakt_progress_at', 'text'],
];
const SERVICES: [string, string][] = [['7plus', '7plus'], ['9now', '9Now']];

async function main() {
  const c = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
  const have = new Set((await c.execute('PRAGMA table_info(shows)')).rows.map((r) => r.name as string));
  for (const [name, type] of COLUMNS) {
    if (have.has(name)) { console.log(`  exists  shows.${name}`); continue; }
    await c.execute(`ALTER TABLE shows ADD COLUMN ${name} ${type}`);
    console.log(`  added   shows.${name}`);
  }
  for (const [slug, name] of SERVICES) {
    const r = await c.execute({ sql: 'SELECT id FROM streaming_services WHERE slug = ?', args: [slug] });
    if (r.rows.length) { console.log(`  exists  service ${slug}`); continue; }
    await c.execute({ sql: 'INSERT INTO streaming_services (slug, name, is_subscribed) VALUES (?, ?, 0)', args: [slug, name] });
    console.log(`  added   service ${slug}`);
  }
  console.log('RESULT: OK');
}
main().catch((e) => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
