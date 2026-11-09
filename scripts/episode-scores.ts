/**
 * Per-episode TMDB scores — the evidence for a bingeability RAMP clause.
 *
 *   npx tsx scripts/episode-scores.ts <tmdbId>[,<tmdbId>...] [--seasons 1,2]
 *
 * Prints, per season, every episode as `ep:score(votes)/runtime` plus the season
 * mean, so the ramp can be read off the data instead of guessed from the format:
 *   - pilot scores as high as the rest, no dip        → `Grabs from ep 1.`
 *   - early episodes low, a clear step up at ep N     → `Slow open — picks up from ep N; ...`
 *   - a later season's mean clearly below S1's        → `Front-loaded — ... fades from S N.`
 * Votes are thin (often 10-50 per episode), so read the SHAPE, and back it with
 * reviews before changing a clause. Episodes not yet aired are marked `*`.
 * Defaults to the first 3 seasons. Read-only.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true } as never);

const args = process.argv.slice(2);
const ids = (args.find((a) => !a.startsWith('--')) || '').split(',').map(Number).filter(Boolean);
const si = args.indexOf('--seasons');
const wantSeasons = si >= 0 ? args[si + 1].split(',').map(Number).filter(Boolean) : null;

if (!ids.length) {
  console.error('usage: npx tsx scripts/episode-scores.ts <tmdbId>[,<tmdbId>...] [--seasons 1,2]');
  process.exit(1);
}
const key = process.env.TMDB_API_KEY;
if (!key) {
  console.error('RESULT: FAILED — TMDB_API_KEY missing from .env.local');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const get = async (path: string) => {
  const res = await fetch(`https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}api_key=${key}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
};

(async () => {
  let shows = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const show = await get(`/tv/${id}`);
      const seasons: number[] = wantSeasons
        ?? (show.seasons || []).map((s: { season_number: number }) => s.season_number).filter((n: number) => n > 0).slice(0, 3);
      console.log(`\n### ${show.name} (tmdb=${id}) — ${show.status}, ${show.number_of_episodes} eps, TMDB ${show.vote_average?.toFixed(2)} on ${show.vote_count}`);
      for (const s of seasons) {
        const d = await get(`/tv/${id}/season/${s}`);
        const eps = (d.episodes || []) as { episode_number: number; vote_average: number; vote_count: number; runtime: number | null; air_date: string | null }[];
        const aired = eps.filter((e) => e.air_date && e.air_date <= today && e.vote_count > 0);
        const mean = aired.length ? aired.reduce((t, e) => t + e.vote_average, 0) / aired.length : null;
        const cells = eps.map((e) =>
          `${e.episode_number}:${e.vote_average.toFixed(1)}(${e.vote_count})${e.runtime ? `/${e.runtime}m` : ''}${!e.air_date || e.air_date > today ? '*' : ''}`);
        console.log(`S${s} mean=${mean?.toFixed(2) ?? '-'}: ${cells.join(' ')}`);
      }
      shows++;
    } catch (err) {
      failed++;
      console.log(`\n### tmdb=${id} — ERROR ${(err as Error).message}`);
    }
  }
  console.log(`\nSUMMARY: shows=${shows} failed=${failed}`);
  console.log(failed ? 'RESULT: PARTIAL — see ERROR lines' : 'RESULT: OK');
})();
