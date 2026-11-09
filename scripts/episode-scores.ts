/**
 * Per-episode TMDB scores — the evidence for a bingeability RAMP clause.
 *
 *   npx tsx scripts/episode-scores.ts <tmdbId>[,<tmdbId>...] [--seasons 1,2] [--all-seasons]
 *   npx tsx scripts/episode-scores.ts --ids-file ids.txt --classify [--quiet]
 *
 * Prints, per season, every episode as `ep:score(votes)/runtime` plus the season
 * mean, so the ramp can be read off the data instead of guessed from the format:
 *   - pilot scores as high as the rest, no dip        → `Grabs from ep 1.`
 *   - early episodes low, a clear step up at ep N     → `Slow open — picks up from ep N; ...`
 *   - a later season's mean clearly below S1's        → `Front-loaded — ... fades from S N.`
 * Votes are thin (often 10-50 per episode), so read the SHAPE, and back it with
 * reviews before changing a clause. Episodes not yet aired are marked `*`.
 * Defaults to the first 3 seasons (`--all-seasons` for every season). Read-only.
 *
 * --classify adds one `CLASSIFY:` line per show with a CANDIDATE ramp. It is a
 * screen, not a verdict: later episodes and seasons are scored mostly by people
 * who stayed, which inflates "picks up" signals, so every non-GRABS candidate must
 * be confirmed with a review search before a clause changes. A FRONT-LOADED signal
 * runs against that bias and is the most reliable. Verdicts:
 *   GRABS            pilot at/above the S1 median, no early sag, no later decline
 *   WEAK-PILOT       pilot >= 0.3 below the S1 median (hook problem)
 *   SLOW-OPEN ep=N   eps 2-4 sag >= 0.3 below the rest of S1, recovering at ep N
 *   SEASON-RAMP S=N  season N's mean >= 0.3 above S1's (S1 is the weak stretch)
 *   FRONT-LOADED S=N season N's mean >= 0.3 below S1's and the run never recovers
 *   THIN             too few votes per episode to read (fewer than 4 usable S1 eps)
 *   PRE-AIR          nothing has aired
 * Means exclude each season's finale (finales score high on survivor votes).
 * `--ids-file` takes one tmdbId per line (anything after the id is ignored).
 */
import { readFileSync } from 'fs';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true } as never);

const MIN_VOTES = 5;
const STEP = 0.3;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const classify = flag('--classify');
const quiet = flag('--quiet');
const allSeasons = flag('--all-seasons') || classify;
const idsFile = opt('--ids-file');
const wantSeasons = opt('--seasons')?.split(',').map(Number).filter(Boolean) ?? null;
const positional = args.filter((a, i) => !a.startsWith('--') && !['--seasons', '--ids-file'].includes(args[i - 1]));
const ids = [
  ...(positional[0] || '').split(',').map(Number).filter(Boolean),
  ...(idsFile ? readFileSync(idsFile, 'utf8').split('\n').map((l) => Number(l.trim().split(/\s+/)[0])).filter(Boolean) : []),
];

if (!ids.length) {
  console.error('usage: npx tsx scripts/episode-scores.ts <tmdbId>[,...] [--seasons 1,2] [--all-seasons] | --ids-file f --classify [--quiet]');
  process.exit(1);
}
const key = process.env.TMDB_API_KEY;
if (!key) {
  console.error('RESULT: FAILED — TMDB_API_KEY missing from .env.local');
  process.exit(1);
}

type Ep = { episode_number: number; vote_average: number; vote_count: number; runtime: number | null; air_date: string | null };

const today = new Date().toISOString().slice(0, 10);
const get = async (path: string) => {
  const res = await fetch(`https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}api_key=${key}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const f = (x: number | null) => (x == null ? '-' : x.toFixed(2));

/** Usable = aired, enough votes. Season mean drops the season finale. */
function seasonStats(eps: Ep[]) {
  const usable = eps.filter((e) => e.air_date && e.air_date <= today && e.vote_count >= MIN_VOTES);
  const lastEp = Math.max(0, ...eps.filter((e) => e.air_date && e.air_date <= today).map((e) => e.episode_number));
  const noFinale = usable.filter((e) => e.episode_number !== lastEp || usable.length < 4);
  return { usable, mean: mean(noFinale.map((e) => e.vote_average)) };
}

function classifyShow(seasons: Map<number, Ep[]>): { verdict: string; evidence: string } {
  const anyAired = [...seasons.values()].some((eps) => eps.some((e) => e.air_date && e.air_date <= today));
  if (!anyAired) return { verdict: 'PRE-AIR', evidence: 'no aired episodes' };
  const s1 = seasons.get(1) || [];
  const st1 = seasonStats(s1);
  if (st1.usable.length < 4 || st1.mean == null) return { verdict: 'THIN', evidence: `${st1.usable.length} S1 eps with >=${MIN_VOTES} votes` };

  // Later-season decline (runs against survivor bias, so the most reliable signal).
  const later = [...seasons.entries()].filter(([n]) => n > 1).map(([n, eps]) => ({ n, ...seasonStats(eps) }))
    .filter((s) => s.usable.length >= 4 && s.mean != null);
  const s1Mean = st1.mean;
  const firstLow = later.find((s) => s1Mean - (s.mean as number) >= STEP);
  if (firstLow) {
    const after = later.filter((s) => s.n >= firstLow.n);
    const recovered = after.some((s) => (s.mean as number) >= s1Mean - 0.1);
    if (!recovered)
      return { verdict: `FRONT-LOADED S=${firstLow.n}`, evidence: `S1 ${f(s1Mean)} → ${after.map((s) => `S${s.n} ${f(s.mean)}`).join(', ')}` };
  }

  const byEp = st1.usable.sort((a, b) => a.episode_number - b.episode_number);
  const pilot = byEp.find((e) => e.episode_number === 1);
  const rest = byEp.filter((e) => e.episode_number !== 1);
  const med = median(rest.map((e) => e.vote_average)) as number;
  const lastEp = Math.max(...s1.filter((e) => e.air_date && e.air_date <= today).map((e) => e.episode_number));
  const early = rest.filter((e) => e.episode_number <= 4);
  const mid = rest.filter((e) => e.episode_number > 4 && e.episode_number !== lastEp);
  const earlyMean = mean(early.map((e) => e.vote_average));
  const midMean = mean(mid.map((e) => e.vote_average));

  if (earlyMean != null && midMean != null && mid.length >= 2 && midMean - earlyMean >= STEP) {
    // Recovery point: first ep N > 2 where the mean of N..N+2 clears the early mean by STEP.
    let n: number | null = null;
    for (let i = 0; i < rest.length - 2; i++) {
      const w = rest.slice(i, i + 3);
      if (w[0].episode_number > 2 && (mean(w.map((e) => e.vote_average)) as number) - earlyMean >= STEP) { n = w[0].episode_number; break; }
    }
    if (n) return { verdict: `SLOW-OPEN ep=${n}`, evidence: `S1 pilot ${pilot ? pilot.vote_average.toFixed(1) : '-'}, eps 2-4 ${f(earlyMean)} → eps 5+ ${f(midMean)}` };
  }
  if (pilot && med - pilot.vote_average >= STEP)
    return { verdict: 'WEAK-PILOT', evidence: `pilot ${pilot.vote_average.toFixed(1)} vs S1 median ${med.toFixed(2)}` };

  const s2 = later.find((s) => s.n === 2);
  if (s2 && (s2.mean as number) - s1Mean >= STEP)
    return { verdict: 'SEASON-RAMP S=2', evidence: `S1 ${f(s1Mean)} → S2 ${f(s2.mean)}` };

  return { verdict: 'GRABS', evidence: `pilot ${pilot ? pilot.vote_average.toFixed(1) : '-'} vs S1 median ${med.toFixed(2)}, S1 ${f(s1Mean)}${later.length ? ', ' + later.map((s) => `S${s.n} ${f(s.mean)}`).join(' ') : ''}` };
}

(async () => {
  let shows = 0;
  let failed = 0;
  const tally: Record<string, number> = {};
  for (const id of ids) {
    try {
      const show = await get(`/tv/${id}`);
      const all: number[] = (show.seasons || []).map((s: { season_number: number }) => s.season_number).filter((n: number) => n > 0);
      const seasonNums = wantSeasons ?? (allSeasons ? all : all.slice(0, 3));
      const seasons = new Map<number, Ep[]>();
      if (!quiet) console.log(`\n### ${show.name} (tmdb=${id}) — ${show.status}, ${show.number_of_episodes} eps, TMDB ${show.vote_average?.toFixed(2)} on ${show.vote_count}`);
      for (const s of seasonNums) {
        const d = await get(`/tv/${id}/season/${s}`);
        const eps = (d.episodes || []) as Ep[];
        seasons.set(s, eps);
        if (!quiet) {
          const cells = eps.map((e) =>
            `${e.episode_number}:${e.vote_average.toFixed(1)}(${e.vote_count})${e.runtime ? `/${e.runtime}m` : ''}${!e.air_date || e.air_date > today ? '*' : ''}`);
          console.log(`S${s} mean=${f(seasonStats(eps).mean)}: ${cells.join(' ')}`);
        }
      }
      if (classify) {
        const { verdict, evidence } = classifyShow(seasons);
        const kind = verdict.split(' ')[0];
        tally[kind] = (tally[kind] || 0) + 1;
        const rt = mean([...seasons.values()].flat().map((e) => e.runtime).filter((r): r is number => !!r));
        console.log(`CLASSIFY: tmdb=${id} | ${show.name} | ${verdict} | ${evidence} | runtime~${rt ? Math.round(rt) : '-'}m | seasons=${all.length}`);
      }
      shows++;
    } catch (err) {
      failed++;
      console.log(`\n### tmdb=${id} — ERROR ${(err as Error).message}`);
    }
  }
  const t = Object.entries(tally).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`\nSUMMARY: shows=${shows} failed=${failed}${t ? ' ' + t : ''}`);
  console.log(failed ? 'RESULT: PARTIAL — see ERROR lines' : 'RESULT: OK');
})();
