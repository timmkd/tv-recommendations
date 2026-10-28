// @ts-nocheck
/**
 * Set which streaming services are subscribed, from an explicit slug list.
 * The `streamingServices.isSubscribed` column drives recommendations, so this
 * is user preference data — only ever run it from an explicit user statement.
 *
 * Any service NOT named is set to unsubscribed, so always pass the FULL list.
 *
 * Run: npx tsx scripts/set-subscriptions.ts <slug> [<slug> ...] [--dry-run]
 *      npx tsx scripts/set-subscriptions.ts --list        (read-only: print the current table)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, streamingServices } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const want = new Set(process.argv.slice(2).filter(a => !a.startsWith('--')));
  const rows = await db.select().from(streamingServices);
  if (process.argv.includes('--list')) {
    for (const r of rows) console.log(`  ${r.slug.padEnd(16)} ${r.name.padEnd(16)} ${r.isSubscribed ? 'SUBSCRIBED' : '-'}`);
    console.log(`\nSUMMARY: subscribed=${rows.filter(r => r.isSubscribed).map(r => r.slug).sort().join(',') || 'none'}`);
    console.log('RESULT: OK');
    return;
  }
  if (!want.size) { console.error('RESULT: FAIL — pass the FULL list of subscribed slugs (or --list to read)'); process.exit(1); }

  const known = new Set(rows.map(r => r.slug));
  const unknown = [...want].filter(s => !known.has(s));
  if (unknown.length) { console.error(`RESULT: FAIL — unknown slug(s): ${unknown.join(', ')}`); process.exit(1); }

  let changed = 0;
  for (const r of rows) {
    const next = want.has(r.slug);
    if (!!r.isSubscribed === next) { console.log(`  keep   ${r.name.padEnd(16)} ${next ? 'SUBSCRIBED' : '-'}`); continue; }
    console.log(`  ${dryRun ? 'WOULD ' : ''}CHANGE ${r.name.padEnd(16)} ${r.isSubscribed ? 'SUBSCRIBED' : '-'} -> ${next ? 'SUBSCRIBED' : '-'}`);
    if (!dryRun) await db.update(streamingServices).set({ isSubscribed: next }).where(eq(streamingServices.slug, r.slug));
    changed++;
  }
  console.log(`\nRESULT: ${dryRun ? 'DRY-RUN OK' : 'OK'} (${changed} changed, subscribed = ${[...want].sort().join(', ')})`);
}
main().catch(e => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
