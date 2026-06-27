// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');
const { enrichShowWithTMDB } = require('../src/lib/tmdb');
const { syncRatingToTrakt } = require('../src/lib/trakt');

const TMDB = 79299; // A Very English Scandal (2018)

async function main() {
  const now = new Date().toISOString();
  const existing = await db.select().from(shows).where(eq(shows.tmdbId, TMDB));
  if (existing.length) { console.log('Already in library — updating instead.'); }

  let tmdbData = {};
  try { tmdbData = await enrichShowWithTMDB(TMDB); } catch (e) { console.log('enrich failed:', e.message); }

  const row = {
    tmdbId: TMDB,
    traktSlug: 'a-very-english-scandal',
    title: 'A Very English Scandal',
    year: 2018,
    status: 'watching',
    dropped: true,
    rating: 2,
    ratedAt: now,
    watchPreference: 'together',
    reviewNote: 'Hated it — same problem as A Very British Scandal: no one to root for, unlikeable real people, nothing redeeming about the characters. Dropped.',
    watchPreferenceNote: 'Together, but a character-investment failure — same reason we bailed on A Very British Scandal.',
    posterPath: tmdbData.posterPath ?? null,
    overview: tmdbData.overview ?? null,
    genres: tmdbData.genres ?? ['Drama'],
    numberOfSeasons: tmdbData.numberOfSeasons ?? 1,
    showStatus: tmdbData.showStatus ?? 'Ended',
    tmdbRating: tmdbData.tmdbRating ?? null,
    tmdbVoteCount: tmdbData.tmdbVoteCount ?? null,
    updatedAt: now,
  };

  if (existing.length) {
    await db.update(shows).set(row).where(eq(shows.tmdbId, TMDB));
  } else {
    await db.insert(shows).values({ ...row, createdAt: now });
  }
  const pushed = await syncRatingToTrakt(TMDB, 2);
  console.log(`A Very English Scandal added: 2★ together, dropped. Trakt rating push: ${pushed ? 'OK (4/10)' : 'FAILED'}`);

  // ---- Re-flag the clearest other 'unlikeable real person' trap: Apple Cider Vinegar ----
  const acv = await db.select().from(shows).where(eq(shows.title, 'Apple Cider Vinegar'));
  if (acv.length === 1) {
    await db.update(shows).set({
      predictedRating: 3.5,
      predictedRatingReason: `Predicted 3.5★ (lowered from 4★): Australian true story (+0.5★ Australian) about wellness con-artist Belle Gibson who faked cancer — Kaitlyn Dever excellent. The draw isn't the characters (Gibson is unlikeable) but the cultural-moment unravelling of the fraud — which engages you when it's PROPULSIVE (American Crime Story 3.5★, Quiz 3.5★ "watching a cultural moment unfold", The Dropout 3.5★) and fails when it's a slow chamber-piece about awful people (A Very British/English Scandal 2★). Closest comp The Dropout 3.5★ caps it here. Together — strict 2-ep test: needs to stay a propulsive exposé, not become a character study of someone insufferable.`,
      predictionsUpdatedAt: now,
      updatedAt: now,
    }).where(eq(shows.tmdbId, acv[0].tmdbId));
    console.log('Apple Cider Vinegar: lowered 4★ -> 3.5★ with Scandal-trap flag.');
  } else {
    console.log(`Apple Cider Vinegar: ${acv.length} matches, skipped.`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
