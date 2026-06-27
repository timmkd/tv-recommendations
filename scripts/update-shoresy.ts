// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

async function main() {
  const tmdbId = 158756;
  const existing = await getOverlayByTmdbId(tmdbId);
  if (!existing) { console.log('not in DB'); return; }

  const reason = "Predicted 3.5★: Letterkenny spinoff — Canadian small-town hockey comedy. Schitt's Creek 4★ solo (rewatched twice) confirms you invest in Canadian comedy worlds when the voice clicks — that's the floor lift. But Schitt's Creek is gentle fish-out-of-water character comedy; Shoresy is crude dialect hockey-bro humor, a genuinely different subgenre. 5 seasons + Trakt 7.98 across 741 votes is real cult longevity (+0.3★) and pure-comedy bonus (+0.2★). Risk: niche hockey-culture humor without a workplace-ensemble structure your solo comedy wins share (Parks 5★, Office 5★, B99 4.5★, Superstore 4★). Solo (crude humor is Helen dealbreaker); 2 episodes is enough to know if the rhythm clicks.";

  await saveOverlay({
    ...existing,
    tmdbId,
    predictedRating: 3.5,
    predictedRatingReason: reason,
    recommendedWatchPreference: 'solo',
    predictionsUpdatedAt: new Date().toISOString(),
  });
  console.log(`✓ Shoresy → 3.5★ solo (was 3★) (${reason.length} chars)`);
}
main().catch(e => { console.error(e); process.exit(1); });
