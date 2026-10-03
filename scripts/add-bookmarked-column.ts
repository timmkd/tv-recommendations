import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@libsql/client';
async function main() {
const c = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
const cols = await c.execute("PRAGMA table_info(shows)");
const has = cols.rows.some(r => r.name === 'bookmarked');
if (has) { console.log('bookmarked column already exists'); }
else { await c.execute("ALTER TABLE shows ADD COLUMN bookmarked integer DEFAULT 0"); console.log('added bookmarked column'); }
const check = await c.execute("SELECT COUNT(*) AS n, SUM(COALESCE(bookmarked,0)) AS b FROM shows");
console.log(check.rows[0]);
}
main().catch(e => { console.error(e); process.exit(1); });
