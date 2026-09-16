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
 * Input: EVERY file matching .trakt-genres*.json in the repo root, merged in
 *        filename order (later files win). Each is a browser-session capture shaped
 *        { "<trakt-slug>": { tmdb, genres: string[], cert } }
 *        or { data: { ... } } / { result: { data: { ... } } } as the devtools
 *        wrapper produces. Reading a glob rather than one fixed file means a
 *        top-up capture can be dropped in as a NEW file without rewriting — or
 *        accidentally clobbering — the existing one.
 *        (Trakt's API is permanently unavailable; see CLAUDE.md.)
 * Run:   npx tsx scripts/merge-trakt-genres.ts [--dry-run] [--touch-updated-at]
 *        npx tsx scripts/merge-trakt-genres.ts --check [--tmdb 123,456]
 *
 * --check writes nothing and reports which in-scope shows are ABSENT from the
 * capture, printing their Trakt slugs so they can be fetched in one browser call.
 * --tmdb restricts the run to specific shows (used by /predict-new-shows, which
 * only cares about the handful it is about to predict).
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

const CAPTURE_GLOB = /^\.trakt-genres.*\.json$/;

// Accept the raw map, or the devtools wrappers ({result:{data}} / {data}).
function unwrap(parsed) {
  let d = parsed;
  if (d && typeof d === 'object' && d.result) d = d.result;
  if (d && typeof d === 'object' && d.data) d = d.data;
  return d && typeof d === 'object' ? d : {};
}

function loadCaptures() {
  const files = fs.readdirSync('.').filter(f => CAPTURE_GLOB.test(f)).sort();
  const merged = {};
  for (const f of files) {
    try {
      const d = unwrap(JSON.parse(fs.readFileSync(f, 'utf8')));
      for (const [slug, v] of Object.entries(d)) {
        if (v && Array.isArray(v.genres) && v.genres.length) merged[slug] = v;
      }
    } catch (e) {
      console.error(`  WARN ignoring unreadable capture ${f}: ${e.message}`);
    }
  }
  return { merged, files };
}

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
  const check = process.argv.includes('--check');

  const tmdbIdx = process.argv.indexOf('--tmdb');
  const scope = tmdbIdx > -1 && process.argv[tmdbIdx + 1]
    ? new Set(process.argv[tmdbIdx + 1].split(',').map(x => Number(x.trim())).filter(Boolean))
    : null;

  const { merged: capture, files } = loadCaptures();
  if (files.length === 0 && !check) {
    console.error('RESULT: FAIL — no .trakt-genres*.json capture found (needs a browser-session capture)');
    process.exit(1);
  }
  console.log(`Captures read (${files.length}): ${files.join(', ') || 'none'} — ${Object.keys(capture).length} slugs\n`);

  const all = await db.select().from(shows);
  const now = new Date().toISOString();

  let changed = 0, unchanged = 0, noCapture = 0, noSlug = 0, unmapped = new Set();
  const addedCounts = {};
  const needCapture = [];

  for (const row of all) {
    if (scope && !scope.has(row.tmdbId)) continue;

    if (!row.traktSlug) {
      noSlug++;
      console.log(`  NO SLUG   ${row.title} (tmdb=${row.tmdbId}) — cannot look up Trakt genres`);
      continue;
    }
    const cap = capture[row.traktSlug];
    if (!cap || !Array.isArray(cap.genres) || cap.genres.length === 0) {
      noCapture++;
      needCapture.push(row.traktSlug);
      console.log(`  NO DATA   ${row.title} — no capture entry for slug "${row.traktSlug}"`);
      continue;
    }

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
    console.log(`  ${dryRun || check ? 'WOULD ADD' : 'ADD'} ${row.title}: +[${additions.join(', ')}]  ->  [${next.join(', ')}]`);

    if (!dryRun && !check) {
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

  if (needCapture.length) {
    console.log(`\nSlugs needing a browser capture (${needCapture.length}) — paste into the snippet:`);
    console.log(JSON.stringify(needCapture));
  }

  console.log(`\nSUMMARY: changed=${changed} unchanged=${unchanged} missingCapture=${noCapture} noSlug=${noSlug} dryRun=${dryRun} check=${check} touchedUpdatedAt=${touch}`);
  if (check) {
    console.log(`RESULT: ${noCapture === 0 ? 'CHECK OK — capture covers every in-scope show' : 'CHECK INCOMPLETE — ' + noCapture + ' show(s) need a capture'}`);
  } else {
    console.log(`RESULT: ${dryRun ? 'DRY-RUN OK' : 'OK'}`);
  }
}

main().catch(e => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
