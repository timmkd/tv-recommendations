// @ts-nocheck
/**
 * Merge Trakt genre tags into the local genre list.
 *
 * WHY: local genres come from TMDB, whose TV genre set cannot express Horror,
 * Thriller, Romance, Superhero, History or Musical at all. That gap caused a
 * real mis-prediction — Widow's Bay was stored Drama/Mystery/Comedy while Trakt
 * had `horror`, and horror is what flips it from a together watch to solo.
 * Several of these missing tags map straight onto Helen's canonical dislikes
 * (sci-fi/fantasy, superhero) or the user's stated likes (musical theatre).
 *
 * ADDITIVE ONLY. An existing local genre is never removed or renamed, so a
 * disagreement between TMDB and Trakt widens the list rather than losing data.
 *
 * Input: .trakt-genres-merged.json — a browser-session capture, shaped
 *        { "<trakt-slug>": { tmdb, genres: string[], cert } }
 *        (Trakt's API is permanently unavailable; see CLAUDE.md.)
 * Run:   npx tsx scripts/merge-trakt-genres.ts [--dry-run] [--touch-updated-at]
 *
 * By default this does NOT bump `updatedAt`. A bulk metadata backfill is not a
 * user-meaningful edit, and touching ~90 rows would bury real prediction changes
 * in the app's "Recently Updated" sort. Pass --touch-updated-at to override.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

const CAPTURE = '.trakt-genres-merged.json';

// Trakt tag -> the equivalent label already used in the local (TMDB) vocabulary.
// Only added when that label is missing locally, so nothing is duplicated.
const EQUIVALENT = {
  drama: 'Drama',
  comedy: 'Comedy',
  crime: 'Crime',
  mystery: 'Mystery',
  'science-fiction': 'Sci-Fi & Fantasy',
  fantasy: 'Sci-Fi & Fantasy',
  action: 'Action & Adventure',
  adventure: 'Action & Adventure',
  war: 'War & Politics',
  animation: 'Animation',
  western: 'Western',
  family: 'Family',
  children: 'Kids',
  documentary: 'Documentary',
  reality: 'Reality',
  'game-show': 'Reality'
};

// Trakt tags TMDB's TV genre set has no way to express. These are the whole
// point of the merge.
const NEW_LABEL = {
  horror: 'Horror',
  thriller: 'Thriller',
  suspense: 'Thriller', // treat as thriller rather than inventing a second label
  romance: 'Romance',
  superhero: 'Superhero',
  history: 'History',
  musical: 'Musical',
  music: 'Music',
  holiday: 'Holiday'
};

function labelFor(traktGenre) {
  return NEW_LABEL[traktGenre] || EQUIVALENT[traktGenre] || null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const touch = process.argv.includes('--touch-updated-at');

  if (!fs.existsSync(CAPTURE)) {
    console.error(`RESULT: FAIL — missing ${CAPTURE} (needs a browser-session capture)`);
    process.exit(1);
  }
  const capture = JSON.parse(fs.readFileSync(CAPTURE, 'utf8'));

  const all = await db.select().from(shows);
  const now = new Date().toISOString();

  let changed = 0, unchanged = 0, noCapture = 0, unmapped = new Set();
  const addedCounts = {};

  for (const row of all) {
    const cap = row.traktSlug ? capture[row.traktSlug] : null;
    if (!cap || !Array.isArray(cap.genres) || cap.genres.length === 0) { noCapture++; continue; }

    const existing = Array.isArray(row.genres) ? row.genres : [];
    const lower = new Set(existing.map(g => g.toLowerCase()));
    const additions = [];

    for (const g of cap.genres) {
      const label = labelFor(g);
      if (!label) { unmapped.add(g); continue; }
      if (lower.has(label.toLowerCase())) continue;
      if (additions.some(a => a.toLowerCase() === label.toLowerCase())) continue;
      additions.push(label);
    }

    if (additions.length === 0) { unchanged++; continue; }

    const next = [...existing, ...additions];
    for (const a of additions) addedCounts[a] = (addedCounts[a] || 0) + 1;
    changed++;
    console.log(`  ${dryRun ? 'WOULD ADD' : 'ADD'} ${row.title}: +[${additions.join(', ')}]  ->  [${next.join(', ')}]`);

    if (!dryRun) {
      await db.update(shows)
        .set({ genres: next, ...(touch ? { updatedAt: now } : {}) })
        .where(eq(shows.tmdbId, row.tmdbId));
    }
  }

  console.log('\nAdded by label:');
  for (const [label, n] of Object.entries(addedCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${label}`);
  }
  if (unmapped.size) console.log(`\nUnmapped Trakt tags (ignored): ${[...unmapped].join(', ')}`);

  console.log(`\nSUMMARY: changed=${changed} unchanged=${unchanged} noCapture=${noCapture} dryRun=${dryRun} touchedUpdatedAt=${touch}`);
  console.log(`RESULT: ${dryRun ? 'DRY-RUN OK' : 'OK'}`);
}

main().catch(e => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
