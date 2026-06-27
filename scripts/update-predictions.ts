import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });

const updates = [
  {
    title: 'The Sopranos',
    predictedRating: 4,
    recommendedWatchPreference: 'solo',
    reason: `Predicted 4★: GOAT-tier prestige drama, IMDB 9.2. Complete 6 seasons. But this is the original antihero misery show — Tony Soprano is a dark character study, same logic that downgraded Succession from 4.5→4★. Dark without comedy buffer → solo default. Over-prediction bias correction applies. You'll appreciate the craft and influence, but the relentless darkness and moral decay is exhausting viewing. Similar to Ozark 4★ (dark prestige crime). The cultural importance is undeniable but antihero fatigue is real. Commit to 4-5 episodes — the pilot is one of TV's best.`,
  },
  {
    title: 'Rosehaven',
    predictedRating: 4,
    recommendedWatchPreference: 'together',
    reason: `Predicted 4★: Australian workplace comedy, IMDB 7.9. Australian content is a stated preference but data only supports 3.67★ avg across 3 shows — not enough to justify 4.5★. Together shows are systematically over-predicted (7/9 over-predicted in accuracy check). Workplace comedy is a core solo preference (Parks & Rec 5★, The Office 5★) but Australian + light tone could work together. Similar to Newsreader 3.5★ (Australian, good acting) but comedy format is more accessible. Complete series (4 seasons). Give it 2-3 episodes.`,
  },
  {
    title: 'Masters of the Air',
    predictedRating: 4,
    recommendedWatchPreference: 'together',
    reason: `Predicted 4★: WWII + True Story + Band of Brothers companion piece. IMDB 7.8 → base 3.6. WWII true story is near-guaranteed together hit (Chernobyl 5★, A Small Light 4★, All the Light We Cannot See 4★). But IMDB 7.8 is notably lower than Band of Brothers 9.4 — reviews were more mixed, citing pacing issues and less character depth. Together over-prediction bias correction applies. Apple TV+ limited series. Still strong together material but not in the same league as Band of Brothers. The aerial sequences are stunning.`,
  },
  {
    title: 'The Tattooist of Auschwitz',
    predictedRating: 3.5,
    recommendedWatchPreference: 'together',
    reason: `Predicted 3.5★: WWII + True Story + Love Story, IMDB 8.0. WWII together modifiers apply (+0.3 each) but this is heavy Holocaust content — already flagged as "heavy for together" in original prediction. Mixed critical reception. Together over-prediction bias applies. Similar to All the Light We Cannot See 4★ but more directly confronting Holocaust horrors. The love story element adds hope but the setting demands emotional endurance. A Small Light 4★ worked because it focused on resistance/agency, not captivity. Low-commitment limited series (6 episodes). Give it 2 episodes.`,
  },
  {
    title: 'The Gold',
    predictedRating: 3.5,
    recommendedWatchPreference: 'together',
    reason: `Predicted 3.5★: British true crime heist drama, IMDB 7.4 → base 3.4. True story +0.3 gets to 3.7 but together over-prediction bias rounds down. British crime drama without comedy buffer is a risk (Peaky Blinders 3.5★ territory). The heist element adds fun but IMDB 7.4 is moderate — not in the prestige tier. 6 episodes, low commitment. Together potential for the heist fun factor but temper expectations.`,
  },
  {
    title: 'Detectorists',
    predictedRating: 3.5,
    recommendedWatchPreference: 'solo',
    reason: `Predicted 3.5★: BAFTA-winning gentle British comedy, IMDB 8.5 → base 3.95. But this is an extremely slow, quiet, contemplative show — the antithesis of momentum-driven TV. Slow-burn modifier -0.5★ applies hard here. If Severance is "too slow for Helen" then Detectorists is in another league of gentle pacing. Solo default for slow content. Critically adored but the pace is a real risk for someone who drops shows when "nothing happens." Give it 3 episodes — if the gentle charm hooks you, it's special.`,
  },
  {
    title: 'The Alienist',
    predictedRating: 3,
    recommendedWatchPreference: 'solo',
    reason: `Predicted 3★: Period serial killer procedural set in 1890s New York, IMDB 7.7 → base 3.55. "Serial killer / studying evil individuals" modifier -0.5★ for together, should consider solo. Helen's True Crime Paradox applies — she likes true crime podcasts but TV serial killer content forces you to LOOK at the evil, which is visceral. Similar to Mindhunter 2.5★ (studying serial killers) but with period drama dressing. Dark character study risk. Cancelled after 2 seasons adds further risk. Moving to solo and downgrading. Give it 2-3 episodes.`,
  },
  {
    title: 'Rectify',
    predictedRating: 3,
    recommendedWatchPreference: 'solo',
    reason: `Predicted 3★: Slow-burn prestige drama about a man released from death row, IMDB 8.3 → base 3.85. But double negative modifiers apply: slow-burn/experimental -0.5★ AND dark without hope -0.5★. Already flagged "Happy Valley effect risk" in original prediction — now that Happy Valley has validated at 2★, this risk is real. Extremely contemplative, meditative pacing. If you drop shows when "nothing happens" (Artful Dodger 2.5★, Home Before Dark 2.5★), Rectify's deliberate pace is a genuine concern. Complete series (4 seasons) is a positive. Give it 3-4 episodes but be honest if it feels like nothing is happening.`,
  },
];

async function main() {
  const now = new Date().toISOString();
  for (const u of updates) {
    const result = await client.execute({
      sql: 'UPDATE shows SET predicted_rating = ?, predicted_rating_reason = ?, recommended_watch_preference = ?, predictions_updated_at = ? WHERE title = ?',
      args: [u.predictedRating, u.reason, u.recommendedWatchPreference, now, u.title],
    });
    console.log(u.title + ': ' + result.rowsAffected + ' row(s) updated');
  }
  console.log('Done!');
}

main().catch(console.error);
