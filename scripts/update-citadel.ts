// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

async function main() {
  const tmdbId = 114922;
  const existing = await getOverlayByTmdbId(tmdbId);
  if (!existing) { console.log('not in DB'); return; }

  const reason = "Predicted 3★: Russo brothers' globe-trotting spy spectacle (Priyanka Chopra / Richard Madden). Your spy-series base rate is a 3.5★+ floor — Slow Horses 4.5★, Americans 4★, Homeland 4★, Diplomat 4★, Bodyguard 4★ — and that pull keeps this from sinking lower. BUT Citadel is the wrong species: character-driven espionage isn't the genre, it's amnesia-and-action spectacle. No Jackson Lamb anchor, hollow plotting per reviews. Trakt 6.63 across 2,602 votes is a real signal (formula → 2.8★), and Action+Crime is your second-worst combo (2.83★ avg). Together; strict 2-episode test — bail if it feels like Mr. & Mrs. Smith 2★ rather than Slow Horses.";

  await saveOverlay({
    ...existing,
    tmdbId,
    predictedRating: 3,
    predictedRatingReason: reason,
    recommendedWatchPreference: 'together',
    predictionsUpdatedAt: new Date().toISOString(),
  });
  console.log(`✓ Citadel → 3★ together (${reason.length} chars)`);
}
main().catch(e => { console.error(e); process.exit(1); });
