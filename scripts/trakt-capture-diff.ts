// @ts-nocheck
/**
 * Diff a Trakt browser-session capture against the local library. Read-only.
 *
 * Reports:
 *   1. Shows on the Trakt watchlist / watched list that are NOT in the local DB
 *      (with tmdbId + slug so they can be imported; tombstoned ids are flagged
 *      and must NOT be re-imported without asking).
 *   2. Local shows that have neither a rating nor a prediction.
 *   3. Shows watched on Trakt since the previous capture (what changed).
 *   4. Shows in data/stalled-shows.json that have NEW plays — candidates for
 *      removal from the stalled list.
 *
 * Run: npx tsx scripts/trakt-capture-diff.ts [.trakt-capture-<date>.json] [--since YYYY-MM-DD]
 *      (defaults to the newest capture; --since defaults to the previous capture's date,
 *       or 30 days ago if there is no previous capture)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
const { db, shows, deletedShows } = require('../src/lib/db');

function unwrap(d) {
  let x = d;
  for (let i = 0; i < 3 && x && typeof x === 'object' && !x.watched; i++) x = x.result ?? x.data ?? x.value ?? x;
  return x;
}

async function main() {
  const args = process.argv.slice(2);
  const captures = fs.readdirSync('.').filter((f) => /^\.trakt-capture-.*\.json$/.test(f)).sort();
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--since');
  const file = positional[0] || captures[captures.length - 1];
  if (!file || !fs.existsSync(file)) { console.error('RESULT: FAIL — no capture file'); process.exit(1); }
  const c = unwrap(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!Array.isArray(c?.watched) || !Array.isArray(c?.watchlist)) { console.error(`RESULT: FAIL — ${file} is not a capture`); process.exit(1); }

  let since = args[args.indexOf('--since') + 1];
  if (!args.includes('--since')) {
    const prev = captures.filter((f) => f !== file).pop();
    since = prev ? (prev.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  }

  const local = await db.select({ tmdbId: shows.tmdbId, title: shows.title, status: shows.status, pred: shows.predictedRating, rating: shows.rating, dropped: shows.dropped }).from(shows);
  const del = await db.select().from(deletedShows);
  const L = new Map(local.map((s) => [s.tmdbId, s]));
  const D = new Set(del.map((d) => d.tmdbId));
  const stalled = fs.existsSync('data/stalled-shows.json') ? new Set(JSON.parse(fs.readFileSync('data/stalled-shows.json', 'utf8')).titles) : new Set();

  const missingWl = c.watchlist.filter((w) => w.tmdb != null && !L.has(w.tmdb));
  const missingW = c.watched.filter((w) => w.tmdb != null && !L.has(w.tmdb));
  const noTmdb = [...c.watchlist, ...c.watched].filter((w) => w.tmdb == null);
  console.log(`Capture: ${file} (${c.capturedAt}) | since: ${since}`);
  console.log('\n--- On Trakt watchlist but not local:');
  for (const w of missingWl) console.log(`  ${w.title} (${w.year}) tmdb=${w.tmdb} slug=${w.slug} listed=${(w.listed || '').slice(0, 10)}${D.has(w.tmdb) ? '  [TOMBSTONED — deleted on purpose; do not re-import without asking]' : ''}`);
  if (!missingWl.length) console.log('  (none)');
  console.log('\n--- Watched on Trakt but not local:');
  for (const w of missingW) console.log(`  ${w.title} tmdb=${w.tmdb} slug=${w.slug} plays=${w.plays} last=${(w.last || '').slice(0, 10)}${D.has(w.tmdb) ? '  [TOMBSTONED]' : ''}`);
  if (!missingW.length) console.log('  (none)');
  if (noTmdb.length) console.log(`\nWARNING: ${noTmdb.length} Trakt entries have no TMDB id and cannot be matched: ${noTmdb.map((w) => w.title).join(', ')}`);

  const unpred = local.filter((s) => !s.dropped && s.rating == null && s.pred == null);
  console.log('\n--- Local shows with no rating AND no prediction (non-dropped):');
  for (const s of unpred) console.log(`  ${s.title} tmdb=${s.tmdbId} status=${s.status}`);
  if (!unpred.length) console.log('  (none)');

  const recent = c.watched.filter((w) => (w.last || '') > since).sort((a, b) => b.last.localeCompare(a.last));
  console.log(`\n--- Watched on Trakt since ${since} (${recent.length}):`);
  for (const w of recent) {
    const p = (c.progress || []).find((p) => p.tmdb === w.tmdb);
    const l = L.get(w.tmdb);
    console.log(`  ${w.title} last=${w.last.slice(0, 10)} ${p ? p.completed + '/' + p.aired + (p.nextEp ? ' next ' + p.nextEp : '') : '?'} local=${l?.status ?? 'MISSING'} rating=${l?.rating ?? '-'}`);
  }

  const stalledActive = recent.filter((w) => stalled.has(w.title));
  console.log('\n--- Stalled-list shows with NEW plays (consider removing from data/stalled-shows.json):');
  for (const w of stalledActive) console.log(`  ${w.title} last=${w.last.slice(0, 10)}`);
  if (!stalledActive.length) console.log('  (none)');

  const importable = [...missingWl, ...missingW].filter((w) => !D.has(w.tmdb));
  const tomb = [...missingWl, ...missingW].filter((w) => D.has(w.tmdb));
  console.log(`\nIMPORT_TMDB_IDS: ${JSON.stringify([...new Set(importable.map((w) => w.tmdb))])}`);
  console.log(`SUMMARY: missingWatchlist=${missingWl.length} missingWatched=${missingW.length} tombstoned=${tomb.length} importable=${new Set(importable.map((w) => w.tmdb)).size} unpredicted=${unpred.length} watchedSince=${recent.length} stalledActive=${stalledActive.length}`);
  console.log('RESULT: OK');
}
main().catch((e) => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
