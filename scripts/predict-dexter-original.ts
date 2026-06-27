/**
 * Add the missing prediction for the original Dexter (2006) — the franchise
 * anchor was skipped while all three spinoffs got predictions.
 *
 * Run with: npx tsx scripts/predict-dexter-original.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

const prediction = {
  tmdbId: 1405,
  title: 'Dexter',
  predictedRating: 4,
  recommendedWatchPreference: 'solo',
  predictedRatingReason:
    "Predicted 4★: The original — Michael C. Hall as a blood-spatter analyst secretly a vigilante serial killer. Dark psychological antihero drama = SOLO (serial-killer/studying-evil is Helen's dealbreaker; TV puts you IN the scene). Propulsive case engine dodges Mindhunter's 2.5★ 'too slow' trap. S4's Trinity arc is a jaw-drop payoff — your stated favourite thing in TV. Capped at 4★ (not 4.5★) by the infamous back-half decline + weak finale (fizzle/weak-payoff allergy, cf. Travelers 3★). Well above the spinoffs (New Blood/Original Sin 3★, Resurrection 3.5★). ENDED. Solo; commit through S4, expect a sag after.",
};

async function main() {
  const now = new Date().toISOString();
  const existing = await getOverlayByTmdbId(prediction.tmdbId);
  if (!existing) {
    console.log(`SKIP ${prediction.title} — not in DB`);
    return;
  }
  await saveOverlay({
    ...existing,
    tmdbId: prediction.tmdbId,
    predictedRating: prediction.predictedRating,
    predictedRatingReason: prediction.predictedRatingReason,
    recommendedWatchPreference: prediction.recommendedWatchPreference,
    predictionsUpdatedAt: now,
  });
  console.log(
    `✓ ${prediction.title} → ${prediction.predictedRating}★ ${prediction.recommendedWatchPreference} (${prediction.predictedRatingReason.length} chars)`
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
