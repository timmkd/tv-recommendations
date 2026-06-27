// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

const revisions = [
  {
    tmdbId: 240740,
    title: 'Scarpetta',
    predictedRating: 3.5,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 3.5★: Nicole Kidman as forensic pathologist Kay Scarpetta. Direct empirical comps in your DB: Big Little Lies 3.5★ together and The Undoing 3.5★ together — both are exactly this pattern (Nicole Kidman prestige crime/mystery together). That's a tight 3.5★ floor and ceiling. Your crime/mystery together average is 3.15★, but the Nicole Kidman cluster sits half a star above that. Patricia Cornwell source material has more plotting muscle than The Undoing's twist-reveal structure. Prime Video tier (3.31★ avg) is a slight headwind. Returning S1, new-series volatility. Together; 2-episode test."
  },
  {
    tmdbId: 114922,
    title: 'Citadel',
    predictedRating: 3,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 3★: Russo brothers' Priyanka Chopra / Richard Madden spy spectacle. Your spy-series cluster averages 3.78★ — but that's character-driven espionage (Slow Horses 4.5★, Americans 4★, Diplomat 4★). The right comp is Mr. & Mrs. Smith 2★ DROP (\"slow pacing and not really funny\") — glossy star-couple action-spy spectacle, exactly Citadel's species. Tehran 3★ DROP and Night Agent 3★ DROP also fit the action-spy fizzle pattern. Trakt 6.63 / 2,602 votes is a real signal (formula → 2.8★). Spy-genre base rate keeps the floor from sinking lower. Together; strict 2-episode test — bail if it feels like M&MS."
  },
  {
    tmdbId: 257994,
    title: 'Half Man',
    predictedRating: 4,
    recommendedWatchPreference: 'solo',
    predictedRatingReason: "Predicted 4★: Richard Gadd's follow-up to Baby Reindeer 4★ solo — same-writer signal is the dominant anchor. Jamie Bell and Lyndsey Marshal as estranged brothers reckoning with old trauma. Gadd's voice = dark psychological character study with purposeful difficulty and cultural-moment quality — that's your solo sweet spot but Helen's no-go zone (same call as Baby Reindeer). Fleabag 4★ solo is the other limited-character-study comp. TMDB 8.9 / Trakt 7.72 (small 126-vote sample, -0.3★) suggest it's landing in the same prestige register. Limited BBC One drama (+0.3★). Solo; commit to 3-4 episodes."
  },
  {
    tmdbId: 158756,
    title: 'Shoresy',
    predictedRating: 3,
    recommendedWatchPreference: 'solo',
    predictedRatingReason: "Predicted 3★: Letterkenny spinoff — Canadian small-town hockey comedy. Critical data point: you have ZERO Canadian niche/crude comedies in your rated DB, and no Letterkenny rating to anchor the spinoff. Your solo comedy wins are workplace-ensemble (Parks 5★, Office 5★, B99 4.5★, Superstore 4★) — Shoresy is well outside that family. Pure crude/dialect humor without franchise hook for you = animation-without-IP equivalent (-0.5★). 5 seasons + Trakt 7.98 across 741 votes signal cult longevity (+0.3★) but only if the dialect rhythm clicks. Solo; 2 episodes is enough — easy bail if the hockey-bro voice doesn't land."
  },
  {
    tmdbId: 290724,
    title: 'Waiting for the Out',
    predictedRating: 2.5,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 2.5★: BBC One drama with concerning data — Trakt 6.83 from only 41 votes and TMDB 4.6 (very low). The empirical danger zone in your recent together dramas: MobLand 2.5★ DROP, Disclaimer 2.5★ DROP, Sunny 2.5★ DROP, Buccaneers 2.5★ DROP (\"so badly written\"), Happy Valley 2★ DROP (\"too dark and bleak\"). Drama-only tag with no comedy buffer / no mystery hook is the together failure pattern — Helen needs momentum + likeable characters. TMDB 4.6 specifically points at character/writing weakness. Together; strict 2-episode test, expect to bail. Drop risk genuinely high (65% at this tier)."
  },
  {
    tmdbId: 273866,
    title: 'The Other Bennet Sister',
    predictedRating: 4,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 4★: BBC period dramedy following Mary Bennet (Pride & Prejudice's overlooked sister). Period drama is your strongest together genre — avg 4.20★ across The Crown 4.5★, The Great 4.5★ (solo), Gilded Age 4★, Bridgerton 4★, A Gentleman in Moscow 4★. Bridgerton is the direct tonal comp: Austen-adjacent, witty, romantic, Helen-friendly. Trakt 8.26 / TMDB 8.4 with healthy 174-vote sample. 30-min episodes are low-commitment easy-watch territory (+0.2★). New-series volatility (-0.3★) keeps it at 4★ not 4.5★. Returning. Together; give it 3 episodes."
  },
  {
    tmdbId: 245318,
    title: "Margo's Got Money Troubles",
    predictedRating: 4,
    recommendedWatchPreference: 'together',
    predictedRatingReason: "Predicted 4★: Apple TV dramedy from Rufi Thorpe's novel — young single mom navigating chaos with her ex-wrestler dad. Apple TV character dramedy is one of your highest-yielding categories (avg 4.07★): Lessons in Chemistry 4.5★, Shrinking 4★ (\"high laugh count\"), The Morning Show 4★, Pachinko 4★. Shrinking is the direct tonal comp — light-touch character dramedy with momentum and likeable people. Trakt 7.65 / 486 votes is solid. Light tone + likeable characters + Apple-TV polish = the Four Seasons 4★ pattern. New-series volatility (-0.3★) keeps the ceiling at 4★. Together; 3 episodes."
  },
  {
    tmdbId: 259909,
    title: 'Dexter: Resurrection',
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    predictedRatingReason: "Predicted 3.5★: Michael C. Hall returns. You have ZERO Dexter ratings in your DB (original is hidden) — empirical comps are limited to serial-killer adjacents, all of which underperformed: Mindhunter 2.5★ SOLO DROP (\"too intense and boring\"), Killing Eve 3★ DROP (\"fizzled out\"). That pattern argues for 3★. Counterweight: Trakt 8.60 across 4,294 votes is the strongest \"this one landed\" signal of all 8 imports — fans say it recaptures the original's tone. Splitting at 3.5★. Serial-killer-as-protagonist = solo (Helen true-crime-paradox dealbreaker). Returning S2. Solo; 2 episodes to gauge whether it transcends the Dexter-spinoff pattern."
  },
];

async function main() {
  const now = new Date().toISOString();
  for (const p of revisions) {
    const existing = await getOverlayByTmdbId(p.tmdbId);
    if (!existing) {
      console.log(`SKIP ${p.title}`);
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
