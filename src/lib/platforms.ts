/**
 * Platform report logic — the single definition of "worth it", watch
 * categories, per-platform summary numbers and the letter grade.
 *
 * Pure functions, no DB access, so the same code serves the /platforms page
 * and scripts/export-chatgpt-package.ts (platform_shows.csv /
 * platform_summary.csv). Grading rubric mirrors the export-chatgpt-package
 * skill's report-card step.
 *
 * Episode progress (aired/completed/next episode) is optional: it only exists
 * in the local Trakt browser capture today. Without it, every watching show is
 * categorised as `mid-season` ("in progress"), which is still enough for the
 * live/cold split the grade turns on.
 */
import stalledFile from '../../data/stalled-shows.json';

export type WatchCategory =
  | 'dropped' | 'completed' | 'stalled' | 'new-season-waiting' | 'caught-up' | 'mid-season' | 'not-started';

export interface ProgressInfo {
  aired: number;
  completed: number;
  lastEp?: string | null; // "SxE"
  nextEp?: string | null;
}

/** The subset of a show row the report needs. */
export interface ReportShow {
  tmdbId: number;
  title: string | null;
  year?: number | null;
  posterPath?: string | null;
  status?: 'watching' | 'completed' | 'watchlist' | null;
  dropped?: boolean | null;
  rating?: number | null;
  predictedRating?: number | null;
  watchPreference?: 'solo' | 'together' | null;
  recommendedWatchPreference?: 'solo' | 'together' | null;
  numberOfSeasons?: number | null;
  showStatus?: string | null;
  genres?: string[] | null;
  streamingServices?: string[] | null;
  justWatchUrl?: string | null;
}

export interface PlatformShowRow {
  platform: string;
  platformAlias: string;
  subscribed: boolean;
  tmdbId: number;
  title: string | null;
  year: number | null;
  posterPath: string | null;
  watchCategory: WatchCategory;
  watchMode: 'solo' | 'together' | '';
  rating: number | null;
  predictedRating: number | null;
  qualityScore: number | null;
  worthIt4plus: boolean;
  exclusiveToPlatform: boolean;
  numberOfSeasons: number | null;
  showStatus: string | null;
  genres: string[] | null;
  traktCompleted: number | null;
  traktAired: number | null;
  traktNextEpisode: string | null;
  justWatchUrl: string | null;
}

export interface PlatformSummary {
  platform: string;
  subscribed: boolean;
  aliasOfMax: boolean;
  totalInLibrary: number;
  completed: number;
  dropped: number;
  unfinished: number;
  newSeasonWaiting: number;
  midSeason: number;
  stalled: number;
  notStarted: number;
  worthIt4plus: number;
  worthIt45plus: number;
  worthIt4only: number;
  tier35: number;
  worthItExclusive: number;
  worthItLive: number;
  worthItSolo: number;
  worthItTogether: number;
  worthItSingleSeason: number;
  worthItSeasonsTotal: number;
  weightedScore: number;
  grade: Grade;
  gradeReason: string;
}

export type Grade = 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D';
const GRADE_SCALE: Grade[] = ['D', 'D+', 'C', 'C+', 'B', 'B+', 'A-', 'A'];

/**
 * JustWatch still maps HBO titles to Foxtel Now (Max in Australia since 2026),
 * and Foxtel Now also carries Foxtel's non-HBO channels. It is not a platform
 * the user would subscribe to, so it is excluded from exclusivity, from the
 * grade table and from watch-next — but its rows stay in platform_shows.csv.
 */
export const MAX_ALIAS = 'foxtel-now';
export const FREE_PLATFORMS = new Set(['abc-iview', 'sbs-on-demand', 'ten-play']);
export const LIVE_CATEGORIES: WatchCategory[] = ['new-season-waiting', 'mid-season', 'caught-up'];

export const STALLED_TITLES: Set<string> = new Set((stalledFile as { titles: string[] }).titles);

export function categorise(s: ReportShow, progress?: ProgressInfo | null): WatchCategory {
  if (s.dropped) return 'dropped';
  if (s.status === 'completed') return 'completed';
  if (s.status === 'watching') {
    if (s.title && STALLED_TITLES.has(s.title)) return 'stalled';
    const p = progress;
    if (p && p.lastEp && p.nextEp && +p.nextEp.split('x')[0] > +p.lastEp.split('x')[0]) return 'new-season-waiting';
    if (p && p.aired > 0 && p.completed >= p.aired) return 'caught-up';
    return 'mid-season';
  }
  return 'not-started';
}

export function qualityScore(s: ReportShow): number | null {
  return s.rating ?? s.predictedRating ?? null;
}

export function isWorthIt(category: WatchCategory, quality: number | null): boolean {
  return category !== 'completed' && category !== 'dropped' && category !== 'stalled' && quality != null && quality >= 4;
}

export function buildPlatformRows(
  shows: ReportShow[],
  subscribed: Set<string>,
  progress: Map<number, ProgressInfo> = new Map(),
): PlatformShowRow[] {
  const rows: PlatformShowRow[] = [];
  for (const s of shows) {
    const services = s.streamingServices || [];
    if (!services.length) continue;
    const p = progress.get(s.tmdbId) ?? null;
    const category = categorise(s, p);
    const quality = qualityScore(s);
    const exclusive = services.filter((x) => x !== MAX_ALIAS).length === 1;
    for (const sv of services) {
      rows.push({
        platform: sv,
        platformAlias: sv === MAX_ALIAS ? 'alias-of-max (JustWatch legacy HBO mapping)' : '',
        subscribed: subscribed.has(sv),
        tmdbId: s.tmdbId, title: s.title, year: s.year ?? null, posterPath: s.posterPath ?? null,
        watchCategory: category,
        watchMode: s.watchPreference || s.recommendedWatchPreference || '',
        rating: s.rating ?? null, predictedRating: s.predictedRating ?? null, qualityScore: quality,
        worthIt4plus: isWorthIt(category, quality),
        exclusiveToPlatform: exclusive,
        numberOfSeasons: s.numberOfSeasons ?? null, showStatus: s.showStatus ?? null, genres: s.genres ?? null,
        traktCompleted: p?.completed ?? null, traktAired: p?.aired ?? null, traktNextEpisode: p?.nextEp ?? null,
        justWatchUrl: s.justWatchUrl ?? null,
      });
    }
  }
  return rows;
}

/**
 * Letter grade per the report-card rubric: a base from the 4★+ count, then a
 * single step of adjustment. When more than one adjustment applies they net
 * out, clamped to one step either way.
 */
export function gradePlatform(s: Omit<PlatformSummary, 'grade' | 'gradeReason'>): { grade: Grade; reason: string } {
  const w = s.worthIt4plus;
  const base: Grade = w >= 20 ? 'A' : w >= 15 ? 'A-' : w >= 11 ? 'B+' : w >= 8 ? 'B' : w >= 6 ? 'C+' : w >= 4 ? 'C' : w >= 2 ? 'D+' : 'D';
  let delta = 0;
  const reasons: string[] = [];
  if (w > 0 && s.worthItExclusive / w < 0.3) { delta -= 1; reasons.push('most of the shelf exists elsewhere'); }
  if (w > 0 && s.worthItLive / w >= 0.5) { delta += 1; reasons.push('the queue is already in motion'); }
  if (s.worthItLive === 0 && s.subscribed) { delta -= 1; reasons.push('paying for cold starts only'); }
  delta = Math.max(-1, Math.min(1, delta));
  const idx = Math.max(0, Math.min(GRADE_SCALE.length - 1, GRADE_SCALE.indexOf(base) + delta));
  const grade = GRADE_SCALE[idx];
  const reason = grade !== base
    ? `${base} → ${grade}: ${reasons.join('; ')}`
    : delta !== 0
      ? `${base}, already at the end of the scale (${reasons.join('; ')})`
      : reasons.length
        ? `${base}: adjustments cancel out (${reasons.join('; ')})`
        : `${base} on ${w} shows at 4★+`;
  return { grade, reason };
}

/** Unfinished rows (anything not completed/dropped). */
export function unfinishedRows(rows: PlatformShowRow[]): PlatformShowRow[] {
  return rows.filter((r) => r.watchCategory !== 'completed' && r.watchCategory !== 'dropped');
}

/** Worth-it rows, best first (quality desc, then title). */
export function worthItRows(rows: PlatformShowRow[]): PlatformShowRow[] {
  return rows.filter((r) => r.worthIt4plus).sort(byQualityThenTitle);
}

/** The 3.5★ tail: unfinished, not stalled, 3.5 ≤ quality < 4. */
export function tier35Rows(rows: PlatformShowRow[]): PlatformShowRow[] {
  return unfinishedRows(rows)
    .filter((r) => r.watchCategory !== 'stalled' && r.qualityScore != null && r.qualityScore >= 3.5 && r.qualityScore < 4)
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

function byQualityThenTitle(a: PlatformShowRow, b: PlatformShowRow): number {
  return (b.qualityScore ?? 0) - (a.qualityScore ?? 0) || (a.title || '').localeCompare(b.title || '');
}

/** Column order for platform_summary.csv — a contract, not an implementation detail. */
export const PLATFORM_SUMMARY_COLUMNS: (keyof PlatformSummary)[] = [
  'platform', 'subscribed', 'aliasOfMax', 'totalInLibrary', 'completed', 'dropped', 'unfinished',
  'newSeasonWaiting', 'midSeason', 'stalled', 'notStarted', 'worthIt4plus', 'worthIt45plus', 'worthIt4only',
  'tier35', 'worthItExclusive', 'worthItLive', 'worthItSolo', 'worthItTogether', 'worthItSingleSeason',
  'worthItSeasonsTotal', 'weightedScore', 'grade', 'gradeReason',
];

export function summarisePlatforms(rows: PlatformShowRow[], subscribed: Set<string>): PlatformSummary[] {
  const plats = [...new Set(rows.map((r) => r.platform))];
  return plats.map((pl) => {
    const prows = rows.filter((r) => r.platform === pl);
    const live = unfinishedRows(prows);
    const worth = worthItRows(live);
    const n = (f: (r: PlatformShowRow) => boolean) => live.filter(f).length;
    const tier35 = tier35Rows(prows).length;
    const base = {
      platform: pl, subscribed: subscribed.has(pl), aliasOfMax: pl === MAX_ALIAS,
      totalInLibrary: prows.length,
      completed: prows.filter((r) => r.watchCategory === 'completed').length,
      dropped: prows.filter((r) => r.watchCategory === 'dropped').length,
      unfinished: live.length,
      newSeasonWaiting: n((r) => r.watchCategory === 'new-season-waiting'),
      midSeason: n((r) => r.watchCategory === 'mid-season'),
      stalled: n((r) => r.watchCategory === 'stalled'),
      notStarted: n((r) => r.watchCategory === 'not-started'),
      worthIt4plus: worth.length,
      worthIt45plus: worth.filter((r) => (r.qualityScore ?? 0) >= 4.5).length,
      worthIt4only: worth.filter((r) => (r.qualityScore ?? 0) >= 4 && (r.qualityScore ?? 0) < 4.5).length,
      tier35,
      worthItExclusive: worth.filter((r) => r.exclusiveToPlatform).length,
      worthItLive: worth.filter((r) => LIVE_CATEGORIES.includes(r.watchCategory)).length,
      worthItSolo: worth.filter((r) => r.watchMode === 'solo').length,
      worthItTogether: worth.filter((r) => r.watchMode === 'together').length,
      worthItSingleSeason: worth.filter((r) => (r.numberOfSeasons || 1) <= 1).length,
      worthItSeasonsTotal: worth.reduce((a, r) => a + (r.numberOfSeasons || 1), 0),
      weightedScore: worth.reduce((a, r) => a + ((r.qualityScore ?? 0) >= 4.5 ? 3 : 2), 0) + tier35,
    };
    const { grade, reason } = gradePlatform(base);
    return { ...base, grade, gradeReason: reason };
  }).sort((a, b) => b.weightedScore - a.weightedScore);
}

/**
 * The "what to watch next" list: worth-it shows on subscribed platforms,
 * one entry per show, live shows first, then by quality (rated before
 * predicted at the same score).
 */
export function watchNext(rows: PlatformShowRow[], subscribed: Set<string>): PlatformShowRow[] {
  const byShow = new Map<number, PlatformShowRow>();
  for (const r of rows) {
    if (!r.worthIt4plus || !subscribed.has(r.platform) || r.platform === MAX_ALIAS) continue;
    if (!byShow.has(r.tmdbId)) byShow.set(r.tmdbId, r);
  }
  const liveRank = (r: PlatformShowRow) => (LIVE_CATEGORIES.includes(r.watchCategory) ? 0 : 1);
  return [...byShow.values()].sort((a, b) =>
    liveRank(a) - liveRank(b)
    || (b.qualityScore ?? 0) - (a.qualityScore ?? 0)
    || (a.rating != null ? 0 : 1) - (b.rating != null ? 0 : 1)
    || (a.title || '').localeCompare(b.title || ''));
}

/** tmdbId → platforms the show sits on (Max alias dropped), built once for the "also on" notes. */
export function platformsByShow(rows: PlatformShowRow[]): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const r of rows) {
    if (r.platform === MAX_ALIAS) continue;
    (out[r.tmdbId] ??= []).push(r.platform);
  }
  return out;
}
