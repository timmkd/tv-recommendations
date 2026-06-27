// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');

const TITLES = [
  'Breaking Bad','Mare of Easttown','Watchmen','House of the Dragon','Catherine the Great',
  'Star Wars: The Clone Wars','KEVIN CAN F**K HIMSELF','Time','Wednesday','SS-GB',
  'Poker Face','Am I Being Unreasonable?','1923','Blue Lights','Reservation Dogs',
  'Dear Mama','The Gentlemen','Modern Love Tokyo','Wellington Paranormal','Roseanne',
  'Monsters at Work','Dream Productions','Secret Level','Invasion','Here We Go',
  'Dying for Sex','Girls5eva','Maestro in Blue','Landman'
];

async function main() {
  const all = await db.select().from(shows);
  for (const t of TITLES) {
    const s = all.find(x => x.title === t);
    if (!s) { console.log(`\n### ${t} — NOT FOUND`); continue; }
    console.log(`\n### ${s.title} (${s.year}) tmdb=${s.tmdbId}`);
    console.log(`  pred=${s.predictedRating}★/${s.recommendedWatchPreference}  IMDB=${s.imdbRating}(${s.imdbVoteCount}v) TMDB=${s.tmdbRating} Trakt=${s.traktRating}`);
    console.log(`  genres=[${(s.genres||[]).join(', ')}]  seasons=${s.numberOfSeasons}  showStatus=${s.showStatus}  origin=${s.origin} format=${s.format}`);
    console.log(`  overview: ${(s.overview||'').replace(/\s+/g,' ').slice(0,200)}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
