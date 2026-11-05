// @ts-nocheck
/**
 * Write Trakt episode progress from the browser capture into the shows table:
 * traktAired / traktCompleted / traktLastEpisode / traktNextEpisode / traktProgressAt.
 *
 * The /platforms page reads these to know which SEASON you need next, and keeps
 * a show off "Watch next" when none of your services carries that season.
 *
 * Input: .trakt-progress.json  {capturedAt, rows:[{tmdb,title,aired,completed,lastEp,nextEp}]}
 *        (written by scripts/split-trakt-capture.ts in /sync-library Step 2)
 *
 * Least-assuming: a show with no progress row is LEFT ALONE — absence from the
 * capture is not evidence of anything. Only these five columns are written.
 *
 * Run: npx tsx scripts/sync-progress.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

const FILE = '.trakt-progress.json';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(FILE)) { console.error(`RESULT: FAIL — missing ${FILE}; run /sync-library Step 2 first`); process.exit(1); }
  const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (d.error) { console.error(`RESULT: FAIL — ${FILE} holds an error: ${d.error}`); process.exit(1); }
  const capturedAt = d.capturedAt || new Date(fs.statSync(FILE).mtime).toISOString();
  const rows = (d.rows || []).filter((r) => r.tmdb != null && typeof r.aired === 'number');

  const local = await db.select({
    tmdbId: shows.tmdbId, title: shows.title,
    traktAired: shows.traktAired, traktCompleted: shows.traktCompleted, traktNextEpisode: shows.traktNextEpisode,
  }).from(shows);
  const byId = new Map(local.map((s) => [s.tmdbId, s]));

  let changed = 0, same = 0, notLocal = 0;
  const lines = [];
  for (const r of rows) {
    const s = byId.get(r.tmdb);
    if (!s) { notLocal++; continue; }
    const next = r.nextEp ?? null;
    if (s.traktAired === r.aired && s.traktCompleted === r.completed && (s.traktNextEpisode ?? null) === next) { same++; continue; }
    changed++;
    lines.push(`  ${s.title}: ${s.traktCompleted ?? '-'}/${s.traktAired ?? '-'} next ${s.traktNextEpisode ?? '-'}  ->  ${r.completed}/${r.aired} next ${next ?? '(none)'}`);
    if (!dryRun) {
      await db.update(shows).set({
        traktAired: r.aired, traktCompleted: r.completed,
        traktLastEpisode: r.lastEp ?? null, traktNextEpisode: next,
        traktProgressAt: capturedAt,
      }).where(eq(shows.tmdbId, r.tmdb));
    }
  }
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (lines.length > 40) console.log(`  ...and ${lines.length - 40} more`);
  console.log(`\nSUMMARY: captureRows=${rows.length} changed=${changed} unchanged=${same} notInLocalDb=${notLocal} capturedAt=${capturedAt.slice(0, 10)}`);
  console.log(`RESULT: ${dryRun ? 'DRY-RUN OK' : 'OK'} (${changed} ${dryRun ? 'would be written' : 'written'})`);
}
main().catch((e) => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
