// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

async function main() {
  const tmdbId = 290724;
  const existing = await getOverlayByTmdbId(tmdbId);
  if (!existing) { console.log('not in DB'); return; }

  const reason = "Predicted 3★: BBC One drama — philosopher leads weekly discussions with prison inmates on dominance, freedom, luck. Cerebral + slow-burn + prison setting + drama-only is the SOLO bucket. Direct comp: Black Bird 3★ solo — prison setting, slow-burn, dark, \"didn't mind it\" energy. The wider slow-burn solo range is 3-4★: Better Call Saul 4★, Pachinko 4★, Dopesick 4★ (prestige/true-story anchors); Shōgun 3.5★, Under the Banner of Heaven 3.5★, Fargo 3.5★ (distinctive style mid-tier); Mindhunter 2.5★ DROP is the negative pole (cerebral but \"too intense and boring\"). The philosophy-in-prison premise is a genuinely distinctive angle (+) but TMDB 4.6 signals execution risk (−). Lands at Black Bird's tier. Solo; commit to 3-4 episodes — slow-burns earn their payoff over time.";

  await saveOverlay({
    ...existing,
    tmdbId,
    predictedRating: 3,
    predictedRatingReason: reason,
    recommendedWatchPreference: 'solo',
    predictionsUpdatedAt: new Date().toISOString(),
  });
  console.log(`✓ Waiting for the Out → 3★ solo (was 2.5★) (${reason.length} chars)`);
}
main().catch(e => { console.error(e); process.exit(1); });
