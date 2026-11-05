/**
 * Server-side loader for the /platforms page: reads the DB and runs the shared
 * report logic in src/lib/platforms.ts. Episode progress comes from the
 * shows.trakt* columns (scripts/sync-progress.ts), season availability from
 * shows.seasonStreaming (scripts/resync-streaming.ts).
 */
import { db, shows, streamingServices } from '@/lib/db';
import {
  buildPlatformRows, summarisePlatforms, watchNext, waitingRows, platformsByShow, MAX_ALIAS,
  type PlatformShowRow, type PlatformSummary, type WaitingShow,
} from '@/lib/platforms';

export interface PlatformReport {
  generatedAt: string;
  subscribed: string[];
  names: Record<string, string>;
  streamingNewest: string | null;
  streamingAgeDays: number | null;
  showCount: number;
  rows: PlatformShowRow[];
  summary: PlatformSummary[];
  next: PlatformShowRow[];
  waiting: WaitingShow[];
  progressAt: string | null;
  alsoOn: Record<number, string[]>;
}

export async function getPlatformReport(): Promise<PlatformReport> {
  const all = await db.select().from(shows);
  const services = await db.select().from(streamingServices);
  const subscribed = new Set(services.filter((s) => s.isSubscribed).map((s) => s.slug));
  const names: Record<string, string> = {};
  for (const s of services) names[s.slug] = s.name;

  const rows = buildPlatformRows(all, subscribed);
  const summary = summarisePlatforms(rows, subscribed).filter((s) => s.platform !== MAX_ALIAS);
  const next = watchNext(rows, subscribed);
  const waiting = waitingRows(rows, subscribed);
  const progressAt = all.map((s) => s.traktProgressAt).filter((x): x is string => !!x).sort().pop() ?? null;
  const streamingNewest = all.map((s) => s.streamingFetchedAt).filter((x): x is string => !!x).sort().pop() ?? null;

  return {
    generatedAt: new Date().toISOString(),
    subscribed: [...subscribed],
    names,
    streamingNewest,
    streamingAgeDays: streamingNewest ? Math.floor((Date.now() - Date.parse(streamingNewest)) / 86400000) : null,
    showCount: all.length,
    rows,
    summary,
    next,
    waiting,
    progressAt,
    alsoOn: platformsByShow(rows),
  };
}
