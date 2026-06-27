// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

async function main() {
  const tmdbId = 290724;
  const existing = await getOverlayByTmdbId(tmdbId);
  if (!existing) { console.log('not in DB'); return; }

  const reason = "Predicted 2.5★: BBC One drama — a philosopher leading weekly philosophy discussions with prison inmates (dominance, freedom, luck). Cerebral + slow-burn discussion format + prison setting + drama-only tag is the SOLO bucket, not together: no comedy buffer, no mystery hook, no period or easy-watch entry point for Helen. Closest comp is Mindhunter 2.5★ SOLO DROP — cerebral, dark, intense, \"too intense and boring.\" Dark-content default rule applies (prison setting). TMDB 4.6 is alarming and Trakt 6.83 from only 41 votes is unreliable. Limited series bonus (+0.3★) offset by new-series volatility (-0.3★). Solo — gives it a fairer test than forcing it on Helen. 2 episodes is enough; expect to bail.";

  await saveOverlay({
    ...existing,
    tmdbId,
    predictedRating: 2.5,
    predictedRatingReason: reason,
    recommendedWatchPreference: 'solo',
    predictionsUpdatedAt: new Date().toISOString(),
  });
  console.log(`✓ Waiting for the Out → 2.5★ SOLO (was 2.5★ together) (${reason.length} chars)`);
}
main().catch(e => { console.error(e); process.exit(1); });
