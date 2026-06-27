/**
 * Predictions for the 11 watchlist shows imported 2026-06-27 (the batch that was
 * being silently dropped by the watchlist pagination bug). Follows docs/taste-profile.md.
 *
 * Run with: npx tsx scripts/predict-new-watchlist-jun27.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

const predictions = [
  {
    tmdbId: 134095,
    title: 'A Murder at the End of the World',
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    predictedRatingReason:
      "Predicted 3.5★: From Brit Marling & Zal Batmanglij (The OA) — a Gen-Z amateur sleuth solving a remote-retreat murder with an AI thread. Cerebral psychological sci-fi mystery = SOLO, your wheelhouse (Dark 4.5★, Severance 5★); slow-burn + sci-fi rules it out for Helen. LIMITED/COMPLETE (+0.3★), so no unresolved risk. Trakt 6.9 is middling — the talky, atmospheric pace and a divisive resolution are the style-over-substance risk (-0.5★) Marling courts. Real jaw-drop potential if the reveal lands. Solo; commit 4-5 episodes, it's a slow-burn.",
  },
  {
    tmdbId: 273247,
    title: 'The Lowdown',
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    predictedRatingReason:
      "Predicted 3.5★: Sterlin Harjo's (Reservation Dogs) FX neo-noir — Ethan Hawke as an obsessive 'citizen historian' digging into a Tulsa death. Quirky, character-driven prestige crime = SOLO: an eccentric-character study, not the propulsive case-of-the-week Helen needs (meandering Reservation Dogs DNA). Trakt 7.22 and strong reviews for Hawke + Harjo's voice. Crime/Drama, RETURNING. Risk is pacing — these idiosyncratic shows can drift. Solo; give it 3 episodes for the tone to settle.",
  },
  {
    tmdbId: 287527,
    title: 'The Testaments',
    predictedRating: 4,
    recommendedWatchPreference: 'together',
    predictedRatingReason:
      "Predicted 4★: Sequel to The Handmaid's Tale — your direct comp, which you rated 4★ TOGETHER ('dark but engaging with purpose'). Atwood's dystopia has a systemic villain + cultural resonance = purposeful difficulty (+0.3★), the kind of dark that works together for you. Trakt 8.36 over 1,142 votes is strong, and a next-generation reset dodges late-Handmaid's fatigue. Drama, RETURNING (S2 ordered). Together — Handmaid's already proved together-viable; strict-ish 2-ep test if bleakness outweighs propulsion.",
  },
  {
    tmdbId: 279471,
    title: "Malcolm in the Middle: Life's Still Unfair",
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    predictedRatingReason:
      "Predicted 3.5★: 4-episode nostalgia revival of the madcap family sitcom. Genuine watch-mode tension: family-sitcom format argues TOGETHER (Modern Family 3.5★, Big Bang 3.5★), but Malcolm's zany/chaotic register sits on the SOLO side of Helen's silliness dial. I lean SOLO on the silliness rule — flip to together if you share nostalgia for the original (still ~3.5★ either way). Trakt 7.26 / TMDB 8.1. Short + low-commitment (+0.2★), COMPLETE revival. 2 episodes is enough to know.",
  },
  {
    tmdbId: 198178,
    title: 'Wonder Man',
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    predictedRatingReason:
      "Predicted 3.5★: MCU comedy-drama (Yahya Abdul-Mateen II) — a Hollywood-set satire about an actor chasing the Wonder Man role, from Destin Daniel Cretton. SOLO: you're an MCU completionist (Loki 4.5★, WandaVision 4★) and superhero is Helen's dislike. Trakt 7.38 / TMDB 7 is mid-tier MCU — above the recent weak ones (Secret Invasion, Echo), below the Loki/WandaVision peak. The breezy showbiz-satire angle could lift it to 4★ if the comedy lands. Comedy+superhero, RETURNING. Solo; 2 episodes to gauge.",
  },
  {
    tmdbId: 207411,
    title: 'Good American Family',
    predictedRating: 3.5,
    recommendedWatchPreference: 'together',
    predictedRatingReason:
      "Predicted 3.5★: Limited true-crime drama on the Natalia Grace case (Ellen Pompeo), built on a perspective-flipping 'who's telling the truth' structure. True-crime/scandal works TOGETHER for you when propulsive (American Crime Story 3.5★, The Dropout 3.5★) — the courtroom/mystery engine + cultural-moment hook supplies that. True story +0.3★, LIMITED +0.3★. Trakt 7.15. Risk: child-in-jeopardy content could tip from propulsive to punishing — strict 2-episode test, bail if disturbing rather than gripping. Together.",
  },
  {
    tmdbId: 258742,
    title: "All's Fair",
    predictedRating: 2.5,
    recommendedWatchPreference: 'together',
    predictedRatingReason:
      "Predicted 2.5★: Ryan Murphy glam legal drama (Kim Kardashian, Naomi Watts, Glenn Close). Genre leans TOGETHER (glossy legal soap), but the quality signal is alarming — Trakt 5.63, TMDB 4.84, brutal reviews. Base calc lands ~2.3★, squarely in drop territory (65% drop risk at this tier). The all-star cast makes it a possible guilty-pleasure hate-watch, but don't expect more. RETURNING. Together, strict 2-episode test — fully expect to bail. Only worth it as a trashy curiosity.",
  },
  {
    tmdbId: 247168,
    title: 'Chad Powers',
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    predictedRatingReason:
      "Predicted 3.5★: Glen Powell sports comedy — a disgraced QB dons a disguise to walk onto a college team (from the Eli Manning bit). Pure broad comedy = SOLO; the silly disguise-farce + sports-bro register isn't Helen's lane. Powell's charisma + an underdog-redemption heart carry it; Trakt 7.38 / TMDB 8.0 are solid for a comedy. RETURNING (S1). Floor 3★ if the one-joke premise thins, 4★ if the warmth lands — could flip TOGETHER if you want a light feel-good shared watch. Solo; 2 episodes is enough.",
  },
  {
    tmdbId: 211178,
    title: 'The Gray House',
    predictedRating: 3,
    recommendedWatchPreference: 'together',
    predictedRatingReason:
      "Predicted 3★: Civil War spy drama about a real female Union spy ring (Prime Video). Period + war/politics + true-story spy is Helen-adjacent = TOGETHER (cf. A Small Light 4★, The Crown 4.5★), and War&Politics is one of your stronger combos (3.86★). True story +0.3★. But the data is thin and yellow-flagged: Trakt 6.5 on just 56 votes, TMDB 4.3. New-series volatility (-0.3★). Together, strict 2-episode test — proceed only if the period craft holds; real drop risk given the weak early signal.",
  },
  {
    tmdbId: 124364,
    title: 'FROM',
    predictedRating: 4,
    recommendedWatchPreference: 'solo',
    predictedRatingReason:
      "Predicted 4★: Horror mystery-box — a town that traps everyone who enters, with monsters at night (MGM+). Sci-fi/horror/mystery = SOLO, your wheelhouse (Silo 4.5★, Dark 4.5★, Stranger Things 4.5★); not Helen's (sci-fi/fantasy dislike). Trakt 8.02 over 10,421 votes is robust, and 4 seasons signal staying power (+0.3★). Addictive and twist-driven. Capped at 4★ (not 4.5★) by the Lost-style payoff risk — it's RETURNING/unresolved and you hate when mystery-boxes don't land. Solo; commit ~4 episodes for the hook to set in.",
  },
  {
    tmdbId: 257519,
    title: 'Bait',
    predictedRating: 3,
    recommendedWatchPreference: 'solo',
    predictedRatingReason:
      "Predicted 3★ (low confidence — thin data): Short-form (25-min) sci-fi dramedy, COMPLETE limited series on Prime Video, so no unresolved risk. Sci-Fi + Comedy = SOLO by default. Trakt 6.47 / TMDB 6.67 across few votes are middling, so this is a tentative read — limited length (+0.3★) keeps it low-commitment. Solo; 2 episodes is enough to know, easy bail. I'll sharpen this once it has more ratings or you've sampled an episode.",
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
    const len = p.predictedRatingReason.length;
    const flag = len < 400 || len > 600 ? ` ⚠️${len}` : ` (${len})`;
    console.log(`✓ ${p.title} → ${p.predictedRating}★ ${p.recommendedWatchPreference}${flag}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
