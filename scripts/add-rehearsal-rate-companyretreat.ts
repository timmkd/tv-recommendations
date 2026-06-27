// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');
const { enrichShowWithTMDB } = require('../src/lib/tmdb');
const { syncRatingToTrakt } = require('../src/lib/trakt');

const REHEARSAL = 204284;
const COMPANY_RETREAT = 312697;

async function main() {
  const now = new Date().toISOString();

  // 1) Add The Rehearsal to the watchlist with a full prediction
  const reason = "Predicted 4★: Nathan Fielder's HBO constructed-reality comedy — elaborately staged 'rehearsals' of real-life situations (S2's aviation swing is the acclaimed peak). SOLO: cerebral, cringe and slow-by-design = every Helen dislike. The Jury Duty 4★ anchor firms this up — you engage with the constructed-reality conceit and aren't cringe-averse — but the register runs colder than Jury Duty's warm belly-laughs (more fascinated than laughing). High-variance: 4.5★ if the cerebral discomfort clicks, ~3.5★ if you just want to laugh or it reads as 'felt pointless'. Conceptual ambition is your lane (Atlanta 3.5★). Give it 2 episodes.";
  const existing = await db.select().from(shows).where(eq(shows.tmdbId, REHEARSAL));
  let tmdb = {};
  try { tmdb = await enrichShowWithTMDB(REHEARSAL); } catch (e) { console.log('enrich failed:', e.message); }
  const row = {
    tmdbId: REHEARSAL,
    traktSlug: 'the-rehearsal',
    title: 'The Rehearsal',
    year: 2022,
    status: 'watchlist',
    dropped: false,
    rating: null,                       // unwatched
    watchPreference: null,              // actual pref not set yet
    predictedRating: 4,
    recommendedWatchPreference: 'solo',
    predictedRatingReason: reason,
    predictionsUpdatedAt: now,
    streamingServices: ['max', 'foxtel-now'],
    streamingFetchedAt: now,
    posterPath: tmdb.posterPath ?? null,
    overview: tmdb.overview ?? null,
    genres: tmdb.genres ?? ['Comedy'],
    numberOfSeasons: tmdb.numberOfSeasons ?? null,
    showStatus: tmdb.showStatus ?? null,
    tmdbRating: tmdb.tmdbRating ?? null,
    tmdbVoteCount: tmdb.tmdbVoteCount ?? null,
    updatedAt: now,
  };
  if (existing.length) await db.update(shows).set(row).where(eq(shows.tmdbId, REHEARSAL));
  else await db.insert(shows).values({ ...row, createdAt: now });
  console.log('The Rehearsal: added to watchlist (Max · solo · predicted 4★).');

  // 2) Company Retreat — assign 2★ (clear "avoid"), push to Trakt
  await db.update(shows).set({
    rating: 2,
    ratedAt: now,
    reviewNote: "Dropped after 2 episodes — unoriginal and not funny, a pale follow-up to Jury Duty. Scored 2★ as a clear avoid (didn't finish, but seen enough).",
    updatedAt: now,
  }).where(eq(shows.tmdbId, COMPANY_RETREAT));
  const pushed = await syncRatingToTrakt(COMPANY_RETREAT, 2);
  console.log(`Company Retreat: rated 2★ (avoid). Trakt push: ${pushed ? 'OK (4/10)' : 'FAILED'}`);

  const [r] = await db.select().from(shows).where(eq(shows.tmdbId, REHEARSAL));
  const [c] = await db.select().from(shows).where(eq(shows.tmdbId, COMPANY_RETREAT));
  console.log(`\nVerify — The Rehearsal: status=${r.status} pred=${r.predictedRating}★/${r.recommendedWatchPreference} stream=[${(r.streamingServices||[]).join(',')}]`);
  console.log(`Company Retreat: rating=${c.rating}★ dropped=${c.dropped}`);
}
main().catch(e => { console.error(e); process.exit(1); });
