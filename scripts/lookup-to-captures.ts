// @ts-nocheck
/**
 * Convert a Trakt browser-session LOOKUP capture (one entry per TMDB id from
 * /search/tmdb/{id}?type=show&extended=full) into the two capture files the
 * backfill scripts consume. Pure file I/O — never touches the DB.
 *
 * Input:  .trakt-lookup-<date>.json  { count, errs, data: { "<tmdbId>": { slug, trakt, imdb,
 *           title, year, rating, votes, genres, cert, status, aired, ... } | { err } } }
 *         (Chrome DevTools wrapper unwrapped automatically)
 * Output: .trakt-genres-<date>.json   { count, errs, data: { "<slug>": { tmdb, genres, cert } } }
 *           -> read by merge-trakt-genres.ts (every .trakt-genres*.json is merged)
 *         .trakt-newshows.json         { rows: [{ tmdb, title, slug, imdb, traktRating, traktVotes }] }
 *           -> read by backfill-trakt-meta.ts
 *
 * Run: npx tsx scripts/lookup-to-captures.ts [.trakt-lookup-<date>.json]
 *      (defaults to the newest .trakt-lookup-*.json)
 */
import fs from 'fs';

function unwrap(d) {
  let x = d;
  for (let i = 0; i < 3 && x && typeof x === 'object' && !x.data; i++) x = x.result ?? x.value ?? x;
  return x;
}
const arg = process.argv[2];
const file = arg || fs.readdirSync('.').filter((f) => /^\.trakt-lookup-.*\.json$/.test(f)).sort().pop();
if (!file || !fs.existsSync(file)) { console.error('RESULT: FAIL — no lookup file (.trakt-lookup-<date>.json)'); process.exit(1); }
const d = unwrap(JSON.parse(fs.readFileSync(file, 'utf8')));
if (!d?.data || typeof d.data !== 'object') { console.error(`RESULT: FAIL — ${file} has no data map`); process.exit(1); }
const date = (file.match(/(\d{4}-\d{2}-\d{2})/) || [, new Date().toISOString().slice(0, 10)])[1];

const genres = {}; const rows = []; const failed = [];
for (const [id, s] of Object.entries(d.data)) {
  if (!s || s.err || !s.slug) { failed.push(`${id}: ${s?.err ?? 'no slug'}`); continue; }
  console.log(`  ${id} ${s.title} (${s.year}) slug=${s.slug} imdb=${s.imdb ?? '-'} trakt=${s.rating ?? '-'} votes=${s.votes ?? '-'} status=${s.status ?? '-'} aired=${s.aired ?? '-'} net=${s.network ?? '-'} first=${(s.first || '').slice(0, 10)} cert=${s.cert ?? '-'} genres=${JSON.stringify(s.genres || [])}`);
  genres[s.slug] = { tmdb: +id, genres: s.genres || [], cert: s.cert || null };
  rows.push({ tmdb: +id, title: s.title, slug: s.slug, imdb: s.imdb || null, traktRating: s.rating != null ? Math.round(s.rating * 100) / 100 : null, traktVotes: s.votes ?? null });
}
const gfile = `.trakt-genres-${date}.json`;
if (fs.existsSync(gfile)) {
  // never clobber an earlier capture from the same day — merge into it
  const prev = JSON.parse(fs.readFileSync(gfile, 'utf8'));
  const prevData = prev.data || prev;
  Object.assign(prevData, genres);
  fs.writeFileSync(gfile, JSON.stringify({ count: Object.keys(prevData).length, errs: 0, data: prevData }));
  console.log(`Merged ${Object.keys(genres).length} slug(s) into existing ${gfile}`);
} else {
  fs.writeFileSync(gfile, JSON.stringify({ count: Object.keys(genres).length, errs: 0, data: genres }));
  console.log(`Wrote ${gfile}`);
}
fs.writeFileSync('.trakt-newshows.json', JSON.stringify({ rows }));
console.log('Wrote .trakt-newshows.json');
if (failed.length) console.log(`WARNING: ${failed.length} lookup(s) unusable: ${failed.join('; ')}`);
console.log(`SUMMARY: shows=${rows.length} failed=${failed.length} genresFile=${gfile}`);
console.log(`RESULT: ${rows.length ? 'OK' : 'FAIL — nothing usable'}`);
if (!rows.length) process.exit(1);
