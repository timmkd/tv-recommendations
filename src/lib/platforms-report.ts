/**
 * Server-side loader for the /platforms page: reads the DB and runs the shared
 * report logic in src/lib/platforms.ts. Status-only — no Trakt episode
 * progress is available on the deployed app yet, so every watching show
 * counts as "in progress".
 */
import { db, shows, streamingServices } from '@/lib/db';
import {
  buildPlatformRows, summarisePlatforms, watchNext, platformsByShow, MAX_ALIAS,
  type PlatformShowRow, type PlatformSummary,
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
    alsoOn: platformsByShow(rows),
  };
}
