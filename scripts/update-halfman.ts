// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

async function main() {
  const tmdbId = 257994;
  const existing = await getOverlayByTmdbId(tmdbId);
  if (!existing) { console.log('not in DB'); return; }

  const reason = "Predicted 4★: Richard Gadd's follow-up to Baby Reindeer 4★ — Jamie Bell and Lyndsey Marshal as estranged brothers reckoning with old trauma. Same-writer signal is the dominant priors here: Gadd's voice is dark psychological character study, purposeful difficulty, cultural-moment quality. That's your solo sweet spot (+0.3★ for purposeful difficulty), but Helen would hate it — same reason Baby Reindeer was solo. TMDB 8.9 / Trakt 7.72 (small 126-vote sample, -0.3★) suggest it's landing in the same prestige register. Limited BBC One drama (+0.3★). SOLO, give it 3-4 episodes — Gadd builds slowly into the reckoning.";

  await saveOverlay({
    ...existing,
    tmdbId,
    predictedRating: 4,
    predictedRatingReason: reason,
    recommendedWatchPreference: 'solo',
    predictionsUpdatedAt: new Date().toISOString(),
  });
  console.log(`✓ Half Man → 4★ SOLO (was 4★ together) (${reason.length} chars)`);
}
main().catch(e => { console.error(e); process.exit(1); });
