// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');
const { syncRatingToTrakt } = require('../src/lib/trakt');

const TIME = 126116;

async function main() {
  const now = new Date().toISOString();
  const [cur] = await db.select().from(shows).where(eq(shows.tmdbId, TIME));
  console.log(`Time (before): rating=${cur.rating} watchPref=${cur.watchPreference} rec=${cur.recommendedWatchPreference} pred=${cur.predictedRating}`);

  await db.update(shows).set({
    rating: 3.5,
    ratedAt: now,
    watchPreference: 'together',
    recommendedWatchPreference: 'together', // correcting my wrong solo flip — it worked together
    reviewNote: "Watched together with Helen — 3.5★. The characters were enjoyable, and although the pace is slow, it's a short series so we didn't have to over-commit. Haven't watched Season 2 yet.",
    watchPreferenceNote: "Together. The short 3-episode run kept this slow, bleak prison drama low-commitment enough to enjoy as a couple.",
    predictedRatingReason: "Predicted 3.5★ — EXACT hit (rated 3.5★ together). Jimmy McGovern British prison drama (Sean Bean, Stephen Graham). Note: I'd flipped this to SOLO on bleak-drop-risk grounds (Happy Valley), but it landed TOGETHER — the 3-episode length kept it low-commitment and the characters carried the slow, bleak tone. Watch-mode corrected to together. Lesson: short/low-commitment limited series can buffer bleak content for together viewing.",
    predictionsUpdatedAt: now,
    updatedAt: now,
  }).where(eq(shows.tmdbId, TIME));

  const pushed = await syncRatingToTrakt(TIME, 3.5);
  console.log(`Trakt rating push: ${pushed ? 'OK (7/10)' : 'FAILED'}`);

  const [after] = await db.select().from(shows).where(eq(shows.tmdbId, TIME));
  console.log(`Time (after): rating=${after.rating} watchPref=${after.watchPreference} rec=${after.recommendedWatchPreference} ratedAt=${after.ratedAt}`);
}
main().catch(e => { console.error(e); process.exit(1); });
