/**
 * Generate predictions for the 8 newly imported watchlist shows.
 * Each prediction follows docs/taste-profile.md guidelines.
 *
 * Run with: npx tsx scripts/predict-new-imports.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

const predictions = [
  {
    tmdbId: 240740,
    title: 'Scarpetta',
    predictedRating: 3,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 3★: Nicole Kidman as forensic pathologist Kay Scarpetta in Patricia Cornwell adaptation. Crime/Mystery with prestige cast fits Helen's preferences (Slow Horses 4.5★, Sherlock 4.5★), but Nicole Kidman's recent prestige series tend toward polished-but-mid (style-over-substance risk). Trakt 6.98 / TMDB 6.6 suggest mixed reception. Pure crime, no comedy buffer (-0.5★) and serial-killer-adjacent material is Helen's risk zone — TV puts you IN the scene, unlike true-crime podcasts. Returning S1, new-series volatility. Together with strict 2-episode test."
  },
  {
    tmdbId: 114922,
    title: 'Citadel',
    predictedRating: 2.5,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 2.5★: Russo brothers' big-budget Priyanka Chopra / Richard Madden spy series. Spy thriller fits Helen's wheelhouse, but Action+Crime hybrid is one of your worst combos (2.83★ avg) and reviews call out style-over-substance / hollow spectacle. Trakt 6.63 / TMDB 6.88 are middling for a tentpole. No Jackson-Lamb-style anchor character to make the action work. Returning, but S2 retooled — momentum loss signal. Together format. Strict 2-episode test; high drop risk (65% at this tier) — be willing to abandon early."
  },
  {
    tmdbId: 257994,
    title: 'Half Man',
    predictedRating: 4,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 4★: BBC One drama starring Jamie Bell as estranged brothers across decades. Limited prestige format (LIMITED, +0.3★) matches the Chernobyl 5★ / A Small Light 4★ pattern Helen responds to. TMDB 8.9 and Trakt 7.72 are strong, though small sample (126 votes) means volatility (-0.3★). Sibling-relationship drama with momentum is exactly the BBC sweet spot — not dark for darkness' sake. Could hit 4.5★ if it lands. Together; give it 3 episodes given character-driven setup."
  },
  {
    tmdbId: 158756,
    title: 'Shoresy',
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    predictedRatingReason: "Predicted 3.5★: Letterkenny spinoff — Canadian small-town hockey comedy. Pure crude/dialect comedy = solo (Helen dealbreaker). Trakt 7.98 across 741 votes and 5 seasons signal cult longevity (+0.3★). But it's niche — hockey-bro humor without broader franchise hook risks Animation-without-IP territory. If you'd enjoy Letterkenny, this is 4★ comfort viewing like Brooklyn Nine-Nine 4.5★. If hockey-culture doesn't click, drops to 3★. Returning. Solo, 2 episodes is enough to know — easy bail if the dialect rhythm doesn't work."
  },
  {
    tmdbId: 290724,
    title: 'Waiting for the Out',
    predictedRating: 2.5,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 2.5★: BBC One drama with very thin data — Trakt 6.83 from only 41 votes and TMDB 4.6 (concerning low). Drama-only tag with no comedy buffer and no mystery hook is a together weakness — Helen needs momentum + likeable characters. New-series volatility (-0.3★) compounds the small sample. Drop risk is 65% at this tier — only proceed if the first episode shows real character investment. Returning. Together, strict 2-episode test, expect to bail."
  },
  {
    tmdbId: 273866,
    title: 'The Other Bennet Sister',
    predictedRating: 3.5,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 3.5★: BBC period dramedy following Mary Bennet (Pride & Prejudice's overlooked sister). Period drama is a Helen sweet spot — Bridgerton 4★, The Crown 4.5★, A Gentleman in Moscow 4★. Trakt 8.26 / TMDB 8.4 are strong. 30-min episodes signal lower commitment (+0.2★ easy watch). Comedy + Period drama backbone reads together. New-series volatility (-0.3★) with small Trakt sample (174 votes) keeps the ceiling honest — could hit 4★. Returning. Together; give it 3 episodes."
  },
  {
    tmdbId: 245318,
    title: "Margo's Got Money Troubles",
    predictedRating: 3.5,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 3.5★: Apple TV dramedy from Rufi Thorpe's novel — young single mom navigating chaos with her ex-wrestler dad. Character-driven dramedy with Apple TV polish, sits adjacent to Shrinking 4★ and Lessons in Chemistry 4.5★ — both Helen wins. Trakt 7.65 / TMDB 8.07 with healthy 486-vote sample. Light tone + likeable characters + momentum is the Four Seasons 4★ pattern. New-series volatility (-0.3★). Together; give it 3 episodes. Apple TV quality tier (3.55★ avg) bodes well."
  },
  {
    tmdbId: 259909,
    title: 'Dexter: Resurrection',
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    predictedRatingReason: "Predicted 3.5★: Michael C. Hall returns after Dexter: New Blood. Trakt 8.60 across 4,294 votes is notably stronger than Original Sin (3★) or New Blood (3★) predictions — fans say this one recaptures the original's tone. Crime/Mystery with serial-killer-as-protagonist = solo (Helen dealbreaker on serial killer TV, even if she likes true-crime podcasts). 4+ seasons of Dexter universe longevity (+0.3★). Returning S2. Tension with the Dexter franchise — fan ratings are high but your priors on Dexter spinoffs are tepid. Solo; 2 episodes to gauge tonal hit."
  },
];

async function main() {
  const now = new Date().toISOString();
  for (const p of predictions) {
    const existing = await getOverlayByTmdbId(p.tmdbId);
    if (!existing) {
      console.log(`SKIP ${p.title} — not in DB`);
      continue;
    }
    await saveOverlay({
      ...existing,
      tmdbId: p.tmdbId,
      predictedRating: p.predictedRating,
      predictedRatingReason: p.predictedRatingReason,
      recommendedWatchPreference: p.recommendedWatchPreference,
      predictionsUpdatedAt: now,
    });
    console.log(`✓ ${p.title} → ${p.predictedRating}★ ${p.recommendedWatchPreference} (${p.predictedRatingReason.length} chars)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
