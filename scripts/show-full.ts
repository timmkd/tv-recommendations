// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

async function main() {
  const tmdbId = parseInt(process.argv[2] || '245312');
  const [r] = await db.select().from(shows).where(eq(shows.tmdbId, tmdbId));
  if (!r) { console.log('not found'); return; }
  console.log(`${r.title} (${r.year})  tmdb=${r.tmdbId}  imdbId=${r.imdbId}`);
  console.log(`status=${r.status}  rating=${r.rating}★ ${r.watchPreference}  ratedAt=${r.ratedAt}`);
  console.log(`pred=${r.predictedRating}★ ${r.recommendedWatchPreference}  predUpd=${r.predictionsUpdatedAt}`);
  console.log(`IMDB=${r.imdbRating} (${r.imdbVoteCount}v) | Trakt=${r.traktRating} | TMDB=${r.tmdbRating} | RT=${r.rtCriticsScore}/${r.rtAudienceScore}`);
  console.log(`genres=${(r.genres||[]).join('/')}  seasons=${r.numberOfSeasons}  showStatus=${r.showStatus}`);
  console.log(`\npredReason:\n${r.predictedRatingReason || '(none)'}`);
  console.log(`\nreviewNote:\n${r.reviewNote || '(none)'}`);
  console.log(`\nwatchPrefNote:\n${r.watchPreferenceNote || '(none)'}`);
  console.log(`\noverview:\n${r.overview || '(none)'}`);
}
main().catch(e => { console.error(e); process.exit(1); });
