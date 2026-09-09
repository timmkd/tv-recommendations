// @ts-nocheck
/**
 * Backfill cached Trakt metadata (slug, community rating, vote count, IMDB id)
 * from a JSON capture, for shows added without a Trakt round-trip.
 *
 * This is the browser-session analogue of enrich-new-show-ratings.ts, which
 * needs a working API credential and skips any show with no traktSlug — the
 * exact gap that leaves manually added shows with no usable rating base.
 *
 * Writes ONLY cached external metadata: traktSlug, traktRating, traktVoteCount,
 * imdbId. Never user fields, never predictions.
 *
 * Input: .trakt-newshows.json  {rows:[{tmdb,slug,imdb,traktRating,traktVotes}]}
 * Run:   npx tsx scripts/backfill-trakt-meta.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const file = '.trakt-newshows.json';
  if (!fs.existsSync(file)) { console.error(`RESULT: FAIL — missing ${file}`); process.exit(1); }
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (d.error) { console.error(`RESULT: FAIL — capture holds an error: ${d.error}`); process.exit(1); }

  let updated = 0, missing = 0;
  for (const r of d.rows || []) {
    const cur = await db.select().from(shows).where(eq(shows.tmdbId, r.tmdb));
    if (!cur.length) { console.log(`  MISS tmdb=${r.tmdb} ${r.title} — not in DB`); missing++; continue; }
    const set = { updatedAt: new Date().toISOString() };
    if (r.slug) set.traktSlug = r.slug;
    if (r.imdb) set.imdbId = r.imdb;
    if (r.traktRating != null) set.traktRating = Math.round(r.traktRating * 100) / 100;
    if (r.traktVotes != null) set.traktVoteCount = r.traktVotes;
    console.log(`  ${dryRun ? 'WOULD SET' : 'SET'} ${r.title}: slug=${set.traktSlug ?? '-'} trakt=${set.traktRating ?? '-'} (${set.traktVoteCount ?? 0} votes) imdb=${set.imdbId ?? '-'}`);
    if (!dryRun) await db.update(shows).set(set).where(eq(shows.tmdbId, r.tmdb));
    updated++;
  }
  console.log(`\nRESULT: ${dryRun ? 'DRY-RUN OK' : 'OK'} (${updated} shows, ${missing} not found)`);
}
main().catch(e => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
