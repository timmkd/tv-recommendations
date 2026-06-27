// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');
const { enrichShowWithTMDB } = require('../src/lib/tmdb');

const JURY_DUTY = 222023;
const COMPANY_RETREAT = 312697;

async function main() {
  const now = new Date().toISOString();

  // 1) Jury Duty — enrich the notes (rating stays 4★ solo)
  await db.update(shows).set({
    reviewNote: "Loved it — laughed my head off (4★). Semi-scripted 'constructed reality' format: one real guy (Ronald) surrounded by actors, but warm and feel-good with a sweet mark you genuinely root for.",
    watchPreferenceNote: "Solo — showed Helen briefly and she didn't find it funny (a vague chuckle at most). This humour is my register, not hers.",
    updatedAt: now,
  }).where(eq(shows.tmdbId, JURY_DUTY));
  console.log('Jury Duty: notes enriched (4★/solo unchanged).');

  // 2) Company Retreat — dropped after 2 eps, intentionally UNRATED (user didn't get far enough)
  const existing = await db.select().from(shows).where(eq(shows.tmdbId, COMPANY_RETREAT));
  let tmdb = {};
  try { tmdb = await enrichShowWithTMDB(COMPANY_RETREAT); } catch (e) { console.log('enrich failed:', e.message); }
  const row = {
    tmdbId: COMPANY_RETREAT,
    traktSlug: 'jury-duty-presents-company-retreat',
    title: 'Jury Duty Presents: Company Retreat',
    year: 2026,
    status: 'watching',
    dropped: true,
    rating: null, // user: "I don't even know how to rate it" — left unrated
    watchPreference: 'solo',
    reviewNote: "Dropped after 2 episodes — found it unoriginal and not funny, a pale follow-up to Jury Duty. Didn't get far enough to fairly rate (maybe it improved, but I bailed). Left unrated.",
    watchPreferenceNote: "Solo (same register as Jury Duty).",
    posterPath: tmdb.posterPath ?? null,
    overview: tmdb.overview ?? null,
    genres: tmdb.genres ?? ['Comedy'],
    numberOfSeasons: tmdb.numberOfSeasons ?? 1,
    showStatus: tmdb.showStatus ?? null,
    tmdbRating: tmdb.tmdbRating ?? null,
    tmdbVoteCount: tmdb.tmdbVoteCount ?? null,
    updatedAt: now,
  };
  if (existing.length) await db.update(shows).set(row).where(eq(shows.tmdbId, COMPANY_RETREAT));
  else await db.insert(shows).values({ ...row, createdAt: now });
  console.log('Company Retreat: added as dropped (unrated, solo).');

  const [jd] = await db.select().from(shows).where(eq(shows.tmdbId, JURY_DUTY));
  const [cr] = await db.select().from(shows).where(eq(shows.tmdbId, COMPANY_RETREAT));
  console.log(`\nVerify — Jury Duty: ${jd.rating}★/${jd.watchPreference}; Company Retreat: rating=${cr.rating ?? 'unrated'} dropped=${cr.dropped}`);
}
main().catch(e => { console.error(e); process.exit(1); });
