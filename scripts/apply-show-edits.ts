// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');
const { syncRatingToTrakt } = require('../src/lib/trakt');

const NIGHT_MANAGER = 61859;
const ROSEHAVEN = 68248;

async function main() {
  const now = new Date().toISOString();

  // ---- The Night Manager: 3.5 -> 4 (S2 enjoyed) ----
  const [nm] = await db.select().from(shows).where(eq(shows.tmdbId, NIGHT_MANAGER));
  console.log('=== The Night Manager (before) ===');
  console.log(`rating=${nm.rating}  reviewNote: ${nm.reviewNote}\n`);

  const nmReview = `${(nm.reviewNote || '').trim()}\n\nUpdate (May 2026): Helen and I really enjoyed Season 2 — bumping to 4★. Keenly awaiting Season 3.`;
  await db.update(shows)
    .set({ rating: 4, ratedAt: now, reviewNote: nmReview, updatedAt: now })
    .where(eq(shows.tmdbId, NIGHT_MANAGER));
  console.log('Updated rating -> 4★, appended S2 note.');

  // Push rating to Trakt (4★ -> 8/10). Rating is a two-way sync field.
  const pushed = await syncRatingToTrakt(NIGHT_MANAGER, 4);
  console.log(`Trakt rating push: ${pushed ? 'OK (8/10)' : 'FAILED (check Trakt auth)'}\n`);

  // ---- Rosehaven: -> solo, together rec missed, keep rating null ----
  const [rh] = await db.select().from(shows).where(eq(shows.tmdbId, ROSEHAVEN));
  console.log('=== Rosehaven (before) ===');
  console.log(`watchPref=${rh.watchPreference}  recPref=${rh.recommendedWatchPreference}  rating=${rh.rating}`);
  console.log(`predReason: ${rh.predictedRatingReason}\n`);

  const rhWatchPrefNote = 'Solo. Watched the opening with Helen — she hated it: found it pointless and boring, and the female lead annoying. Together rec missed; this is a solo gentle-comedy. Tim giving it a few more episodes before rating.';
  const rhPredReason = "Predicted 4★: Gentle, quirky Australian small-town comedy (Celia Pacquola, Luke McGregor). Originally recommended TOGETHER — that missed: Helen found it pointless, boring, and the female lead annoying (her together-fail signature: needs momentum + likeable leads). Pure character comedy = SOLO for you, the warm easy-watch lane (cf. Superstore 4★). Australian content is a stated +. Low-stakes, low-commitment. Solo viewing. Tim giving it a few more episodes before rating — prediction held at 4★ pending that.";

  await db.update(shows)
    .set({
      watchPreference: 'solo',
      watchPreferenceNote: rhWatchPrefNote,
      recommendedWatchPreference: 'solo',
      predictedRatingReason: rhPredReason,
      predictionsUpdatedAt: now,
      updatedAt: now,
      // rating intentionally left null
    })
    .where(eq(shows.tmdbId, ROSEHAVEN));
  console.log('Updated Rosehaven -> solo (watchPref + recommended), reason corrected, rating left unrated.');

  // ---- Verify ----
  const [nm2] = await db.select().from(shows).where(eq(shows.tmdbId, NIGHT_MANAGER));
  const [rh2] = await db.select().from(shows).where(eq(shows.tmdbId, ROSEHAVEN));
  console.log('\n=== After ===');
  console.log(`Night Manager: rating=${nm2.rating} ratedAt=${nm2.ratedAt}`);
  console.log(`Rosehaven: watchPref=${rh2.watchPreference} recPref=${rh2.recommendedWatchPreference} rating=${rh2.rating ?? 'null'}`);
}
main().catch(e => { console.error(e); process.exit(1); });
