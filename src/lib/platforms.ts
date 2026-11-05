/**
 * Platform report logic — the single definition of "worth it", watch
 * categories, per-platform summary numbers and the letter grade.
 *
 * Pure functions, no DB access, so the same code serves the /platforms page
 * and scripts/export-chatgpt-package.ts (platform_shows.csv /
 * platform_summary.csv). Grading rubric mirrors the export-chatgpt-package
 * skill's report-card step.
 *
 * Episode progress (aired/completed/next episode) comes from the Trakt browser
 * capture — passed in by the exporter, or read from the shows.trakt* columns
 * that scripts/sync-progress.ts writes (the /platforms page). Without it, every
 * watching show is categorised as `mid-season` ("in progress").
 *
 * Season availability: a show only counts as watchable on a platform when that
 * platform carries the season you need NEXT (season 1 for a cold start, the
 * season of the next episode for a show in progress), per shows.seasonStreaming
 * from JustWatch. Unknown availability counts as available — never drop a show
 * on missing data. Shows filtered out this way land in waitingRows().
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
  bingeability?: number | null;
  predictedBingeability?: number | null;
  predictedBingeabilityReason?: string | null;
  watchPreference?: 'solo' | 'together' | null;
  recommendedWatchPreference?: 'solo' | 'together' | null;
  numberOfSeasons?: number | null;
  showStatus?: string | null;
  genres?: string[] | null;
  streamingServices?: string[] | null;
  justWatchUrl?: string | null;
  seasonStreaming?: Record<string, string[]> | null;
  traktAired?: number | null;
  traktCompleted?: number | null;
  traktLastEpisode?: string | null;
  traktNextEpisode?: string | null;
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
  bingeability: number | null;
  predictedBingeability: number | null;
  /** The ramp clause that ends every bingeability reason ("Slow open — picks up from ep 3; worth it."). */
  bingeRamp: string | null;
  worthIt4plus: boolean;
  exclusiveToPlatform: boolean;
  numberOfSeasons: number | null;
  showStatus: string | null;
  genres: string[] | null;
  traktCompleted: number | null;
  traktAired: number | null;
  traktNextEpisode: string | null;
  justWatchUrl: string | null;
  /** The season you need next: 1 for a cold start, the next episode's season when in progress; null = nothing to watch / unknown. */
  nextSeason: number | null;
  /** Services carrying nextSeason (Max alias included); null = unknown. */
  nextSeasonOn: string[] | null;
  /** Whether THIS platform carries nextSeason (true when unknown). */
  availableHere: boolean;
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
export const FREE_PLATFORMS = new Set(['abc-iview', 'sbs-on-demand', 'ten-play', '7plus', '9now']);
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

/** Progress from the shows.trakt* columns (written by scripts/sync-progress.ts). */
export function progressFromShow(s: ReportShow): ProgressInfo | null {
  if (s.traktAired == null || s.traktCompleted == null) return null;
  return { aired: s.traktAired, completed: s.traktCompleted, lastEp: s.traktLastEpisode ?? null, nextEp: s.traktNextEpisode ?? null };
}

/** The season the user needs next, or null when there is nothing to watch (caught up) or it is unknown. */
export function nextSeasonFor(category: WatchCategory, p: ProgressInfo | null): number | null {
  if (category === 'not-started') return 1;
  if (category === 'caught-up') return null;
  if (category === 'mid-season' || category === 'new-season-waiting') {
    const n = p?.nextEp ? parseInt(p.nextEp.split('x')[0], 10) : NaN;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Which services carry `season`, from JustWatch's per-season offers. Only an
 * explicitly listed season counts: [] means JustWatch lists the season with no
 * AU offers ("not in AU yet" — Abbott S6, The Paper S2). A season JustWatch does
 * not list at all is null = unknown, because Trakt/TMDB and JustWatch number
 * seasons differently (Twin Peaks: The Return is S3 on Trakt but a separate
 * JustWatch title; Bluey runs one season ahead). Never remove a show on that.
 */
export function servicesForSeason(seasonStreaming: Record<string, string[]> | null | undefined, season: number | null): string[] | null {
  if (season == null || !seasonStreaming) return null;
  return seasonStreaming[String(season)] ?? null;
}

/**
 * Season data is only trusted when it agrees with the show-level list: every
 * platform the show is on must appear in at least one season. A platform in
 * no season list means streamingServices was refreshed by a path that did not
 * refresh seasonStreaming (drift) — ignore the season data, i.e. "unknown".
 */
export function seasonDataInSync(seasonStreaming: Record<string, string[]> | null | undefined, services: string[]): boolean {
  if (!seasonStreaming) return false;
  const inSeasons = new Set(Object.values(seasonStreaming).flat());
  return services.every((sv) => inSeasons.has(sv));
}

/** The fixed-form ramp clause at the end of a bingeability reason, or null. */
export function rampClause(reason: string | null | undefined): string | null {
  const m = reason?.match(/(Grabs from ep 1\.|Slow open — .*|Front-loaded — .*)$/);
  return m ? m[1].trim() : null;
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
    const p = progress.get(s.tmdbId) ?? progressFromShow(s);
    const category = categorise(s, p);
    const quality = qualityScore(s);
    const exclusive = services.filter((x) => x !== MAX_ALIAS).length === 1;
    const nextSeason = nextSeasonFor(category, p);
    const nextSeasonOn = seasonDataInSync(s.seasonStreaming, services) ? servicesForSeason(s.seasonStreaming, nextSeason) : null;
    for (const sv of services) {
      // Caught up = nothing to watch anywhere until a new season airs.
      const availableHere = category === 'caught-up' ? false : nextSeasonOn == null ? true : nextSeasonOn.includes(sv);
      rows.push({
        platform: sv,
        platformAlias: sv === MAX_ALIAS ? 'alias-of-max (JustWatch legacy HBO mapping)' : '',
        subscribed: subscribed.has(sv),
        tmdbId: s.tmdbId, title: s.title, year: s.year ?? null, posterPath: s.posterPath ?? null,
        watchCategory: category,
        watchMode: s.watchPreference || s.recommendedWatchPreference || '',
        rating: s.rating ?? null, predictedRating: s.predictedRating ?? null, qualityScore: quality,
        bingeability: s.bingeability ?? null, predictedBingeability: s.predictedBingeability ?? null,
        bingeRamp: rampClause(s.predictedBingeabilityReason),
        worthIt4plus: isWorthIt(category, quality) && availableHere,
        exclusiveToPlatform: exclusive,
        numberOfSeasons: s.numberOfSeasons ?? null, showStatus: s.showStatus ?? null, genres: s.genres ?? null,
        traktCompleted: p?.completed ?? null, traktAired: p?.aired ?? null, traktNextEpisode: p?.nextEp ?? null,
        justWatchUrl: s.justWatchUrl ?? null,
        nextSeason, nextSeasonOn, availableHere,
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

/** The 3.5★ tail: unfinished, not stalled, next season available here, 3.5 ≤ quality < 4. */
export function tier35Rows(rows: PlatformShowRow[]): PlatformShowRow[] {
  return unfinishedRows(rows)
    .filter((r) => r.watchCategory !== 'stalled' && r.availableHere && r.qualityScore != null && r.qualityScore >= 3.5 && r.qualityScore < 4)
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

/** tmdbId → platforms that carry the season you need next (Max alias dropped), for the "also on" notes. */
export function platformsByShow(rows: PlatformShowRow[]): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const r of rows) {
    if (r.platform === MAX_ALIAS || !r.availableHere) continue;
    (out[r.tmdbId] ??= []).push(r.platform);
  }
  return out;
}

export type BlockReason = 'caught-up' | 'not-in-au' | 'other-services';

export interface WaitingShow {
  row: PlatformShowRow;
  /** Where the next season is (foxtel-now shown as max); [] = not in AU yet. Empty for caught-up shows. */
  nextSeasonOn: string[];
  reason: BlockReason;
}

/** Why a row's next season can't be watched here, and where it is instead. */
function blockedInfo(r: PlatformShowRow): { reason: BlockReason; nextSeasonOn: string[] } {
  const on = [...new Set((r.nextSeasonOn ?? []).map((x) => (x === MAX_ALIAS ? 'max' : x)))];
  const reason: BlockReason = r.watchCategory === 'caught-up' ? 'caught-up' : on.length ? 'other-services' : 'not-in-au';
  return { reason, nextSeasonOn: on };
}

export interface ShowAvailability {
  /** Subscribed platforms (Max alias excluded) that carry the season you need next. */
  watchableOn: string[];
  /** Set when the show is on a subscribed platform but none of them carries the next season. */
  blocked: { reason: BlockReason; nextSeason: number | null; nextSeasonOn: string[] } | null;
}

/**
 * Per-show availability on the user's subscribed services — the same rule as
 * Watch Next, without the quality filter. Used by /recommendations to hide or
 * re-label hand-written recommendations whose next season isn't watchable.
 */
export function availabilityByShow(rows: PlatformShowRow[], subscribed: Set<string>): Map<number, ShowAvailability> {
  const out = new Map<number, ShowAvailability>();
  const byShow = new Map<number, PlatformShowRow[]>();
  for (const r of rows) (byShow.get(r.tmdbId) ?? byShow.set(r.tmdbId, []).get(r.tmdbId)!).push(r);
  for (const [tmdbId, list] of byShow) {
    const subs = list.filter((r) => subscribed.has(r.platform) && r.platform !== MAX_ALIAS);
    const watchableOn = subs.filter((r) => r.availableHere).map((r) => r.platform);
    const blocked = subs.length && !watchableOn.length ? { ...blockedInfo(subs[0]), nextSeason: subs[0].nextSeason } : null;
    out.set(tmdbId, { watchableOn, blocked });
  }
  return out;
}

/**
 * The counterpart to watchNext(): shows that WOULD be on it (4★+, unfinished,
 * not stalled, on a subscribed service) but whose next season is not on any
 * subscribed service — or that are caught up with nothing to watch.
 */
export function waitingRows(rows: PlatformShowRow[], subscribed: Set<string>): WaitingShow[] {
  const byShow = new Map<number, PlatformShowRow[]>();
  for (const r of rows) (byShow.get(r.tmdbId) ?? byShow.set(r.tmdbId, []).get(r.tmdbId)!).push(r);
  const out: WaitingShow[] = [];
  for (const list of byShow.values()) {
    const subs = list.filter((r) => subscribed.has(r.platform) && r.platform !== MAX_ALIAS);
    if (!subs.length || subs.some((r) => r.worthIt4plus)) continue;
    const r = subs[0];
    if (!isWorthIt(r.watchCategory, r.qualityScore)) continue; // excluded for quality/status, not availability
    out.push({ row: r, ...blockedInfo(r) });
  }
  return out.sort((a, b) => byQualityThenTitle(a.row, b.row));
}
