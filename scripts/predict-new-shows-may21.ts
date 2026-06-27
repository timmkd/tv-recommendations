/**
 * One-off predictions for the 3 watchlist shows added 2026-05-21.
 * Run: npx tsx scripts/predict-new-shows-may21.ts
 */
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const updates = [
  {
    tmdbId: 270476, // Widow's Bay (2026)
    predictedRating: 3.5,
    recommendedWatchPreference: 'together' as const,
    reason: `Predicted 3.5★: Cozy mystery-comedy set in a "cursed" New England town, TMDB 8.3 (no IMDB/RT yet — new-series volatility -0.3★). Mystery + Comedy backbone defaults to together (+0.2★) and the format echoes Only Murders 4★ and Deadloch — light tone with a hook. RISK: the supernatural "cursed town" angle is sci-fi/fantasy-adjacent, which is firmly on Helen's dislike list (Severance was "too slow", The OA didn't land). If it plays the curse for whimsy (Wellington Paranormal-style) it works; if it leans mythology it's solo. Together procedural ceiling 4★, no buzz yet, so 3.5★. Returning Series, S1. Strict 2-episode test — if the supernatural angle is dominant, switch to solo.`,
  },
  {
    tmdbId: 131927, // Dexter: New Blood (2021)
    predictedRating: 3,
    recommendedWatchPreference: 'solo' as const,
    reason: `Predicted 3★: 10-episode revival/limited continuation of Dexter, TMDB 7.9, IMDB ~7.4 → base 3.2. Limited series +0.3 but two big negatives: serial killer / studying evil -0.5★ AND Helen's True Crime Paradox makes this a hard solo (she loves true crime podcasts but Mindhunter 2.5★ proved TV serial-killer-POV doesn't work for her). Dark prestige antihero → solo by default. Reviews were "better than late-original-Dexter" but the finale was divisive and many fans hated it — weak payoff risk -0.5★. You haven't watched original Dexter yet so this is out of order anyway; flag to watch the original first. Commit to 3 episodes once you've seen the original.`,
  },
  {
    tmdbId: 219937, // Dexter: Original Sin (2024)
    predictedRating: 3,
    recommendedWatchPreference: 'solo' as const,
    reason: `Predicted 3★: Young-Dexter prequel set in 1991 Miami, TMDB 8.1, IMDB ~7.5 → base 3.25. Same franchise pattern as New Blood — serial killer content -0.5★, solo only (Helen's True Crime Paradox). Prequel/origin stories often coast on franchise affection rather than standing alone (similar territory to Better Call Saul 4.5★ at the top of the genre, but Dexter's writing has never reached that tier). Cancelled after 1 season -0.5★ — you hate cancelled/unresolved (Big Door Prize 2.5★, Sunny 2.5★). The cancellation makes this a low-priority recommendation even within solo viewing. Coming-of-age serial killer angle has cult appeal but limited range. Solo. Give it 2 episodes — if the young-Dexter framing doesn't grab you, skip.`,
  },
];

async function main() {
  const now = new Date().toISOString();
  for (const u of updates) {
    const result = await client.execute({
      sql: `UPDATE shows
            SET predicted_rating = ?,
                predicted_rating_reason = ?,
                recommended_watch_preference = ?,
                predictions_updated_at = ?,
                updated_at = ?
            WHERE tmdb_id = ?`,
      args: [
        u.predictedRating,
        u.reason,
        u.recommendedWatchPreference,
        now,
        now,
        u.tmdbId,
      ],
    });
    console.log(`tmdb=${u.tmdbId}: ${result.rowsAffected} row(s) updated → ${u.predictedRating}★ ${u.recommendedWatchPreference}`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
