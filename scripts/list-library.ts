/**
 * List every show in the library on one line each: title, year, rating or
 * prediction, watch pref, status, dropped/hidden flags. For quick diffs against
 * external candidate lists ("is X already in the library?").
 *
 * Run with: npx tsx scripts/list-library.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { db, shows } = require('../src/lib/db');

async function main() {
  const rows = await db.select().from(shows);
  rows.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  for (const r of rows) {
    const val =
      r.rating != null
        ? `rated=${r.rating}`
        : r.predictedRating != null
          ? `pred=${r.predictedRating}`
          : 'unpredicted';
    const flags = `${r.dropped ? ' DROPPED' : ''}${r.hidden ? ' HIDDEN' : ''}`;
    console.log(
      `${r.title ?? 'null'} (${r.year ?? '?'})  ${val}  ${r.watchPreference ?? r.recommendedWatchPreference ?? '?'}  ${r.status ?? '?'}${flags}`
    );
  }
  console.log(`\nTOTAL: ${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
