// @ts-nocheck
// One-off migration: un-hide all shows that were wrongly hidden by the old
// Trakt "hidden from recommendations" -> app "hidden" conflation sync.
// Writes directly to the DB and does NOT touch Trakt's hidden-recs list.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

async function main() {
  const hidden = await db.select().from(shows).where(eq(shows.hidden, true));
  console.log(`Found ${hidden.length} hidden shows. Un-hiding all...\n`);
  for (const s of hidden) {
    console.log(`  un-hide: ${s.title} (rating=${s.rating ?? '-'}, status=${s.status})`);
  }

  const now = new Date().toISOString();
  await db.update(shows).set({ hidden: false, updatedAt: now }).where(eq(shows.hidden, true));

  const stillHidden = await db.select().from(shows).where(eq(shows.hidden, true));
  console.log(`\nDone. hidden=true remaining: ${stillHidden.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
