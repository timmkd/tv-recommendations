import { db, shows, settings, streamingServices, deletedShows } from './index';
import { eq, and, or } from 'drizzle-orm';
import type { ShowOverlay, Settings, DeletedShow, TraktAuth, StreamingService } from '@/types';
import type { DbShow } from './schema';

// ==================== SHOWS (Overlays) ====================

export async function getOverlays(): Promise<ShowOverlay[]> {
  const result = await db.select().from(shows);
  return result.map(dbShowToOverlay);
}

export async function getOverlayByTmdbId(tmdbId: number): Promise<ShowOverlay | undefined> {
  const result = await db.select().from(shows).where(eq(shows.tmdbId, tmdbId)).limit(1);
  return result[0] ? dbShowToOverlay(result[0]) : undefined;
}

export async function getOverlaysMap(): Promise<Map<number, ShowOverlay>> {
  const overlays = await getOverlays();
  return new Map(overlays.map(o => [o.tmdbId, o]));
}

export async function saveOverlay(overlay: ShowOverlay): Promise<void> {
  const existing = await db.select({ id: shows.id })
    .from(shows)
    .where(eq(shows.tmdbId, overlay.tmdbId))
    .limit(1);

  const data = overlayToDbShow(overlay);

  if (existing.length > 0) {
    // MERGE with existing data - only update fields that are provided
    await db.update(shows)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(shows.tmdbId, overlay.tmdbId));
  } else {
    await db.insert(shows).values({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function deleteOverlay(tmdbId: number): Promise<void> {
  await db.delete(shows).where(eq(shows.tmdbId, tmdbId));
}

// ==================== SETTINGS ====================

export async function getSettings(): Promise<Settings> {
  const [settingsRow] = await db.select().from(settings).limit(1);
  const services = await db.select().from(streamingServices);
  const deleted = await db.select().from(deletedShows);

  // Reconstruct TraktAuth if we have tokens
  let traktAuth: TraktAuth | undefined;
  if (settingsRow?.traktAccessToken && settingsRow?.traktRefreshToken) {
    traktAuth = {
      accessToken: settingsRow.traktAccessToken,
      refreshToken: settingsRow.traktRefreshToken,
      expiresAt: settingsRow.traktExpiresAt ?? 0,
      createdAt: settingsRow.traktCreatedAt ?? 0,
    };
  }

  return {
    traktUsername: settingsRow?.traktUsername ?? undefined,
    openaiApiKey: settingsRow?.openaiApiKey ?? undefined,
    justWatchUsername: settingsRow?.justWatchUsername ?? undefined,
    traktAuth,
    streamingServices: services.map(s => ({
      slug: s.slug,
      name: s.name,
      isSubscribed: s.isSubscribed ?? false,
    })),
    deletedShows: deleted.map(d => ({
      tmdbId: d.tmdbId ?? undefined,
      title: d.title,
      year: d.year ?? undefined,
      deletedAt: d.deletedAt,
    })),
  };
}

export async function saveSettings(newSettings: Settings): Promise<void> {
  // Update main settings (upsert pattern)
  const existing = await db.select({ id: settings.id }).from(settings).limit(1);

  const settingsData = {
    traktUsername: newSettings.traktUsername ?? null,
    openaiApiKey: newSettings.openaiApiKey ?? null,
    justWatchUsername: newSettings.justWatchUsername ?? null,
    traktAccessToken: newSettings.traktAuth?.accessToken ?? null,
    traktRefreshToken: newSettings.traktAuth?.refreshToken ?? null,
    traktExpiresAt: newSettings.traktAuth?.expiresAt ?? null,
    traktCreatedAt: newSettings.traktAuth?.createdAt ?? null,
  };

  if (existing.length > 0) {
    await db.update(settings).set(settingsData).where(eq(settings.id, 1));
  } else {
    await db.insert(settings).values({ id: 1, ...settingsData });
  }

  // Sync streaming services - upsert each one
  for (const service of newSettings.streamingServices) {
    const existingService = await db.select({ id: streamingServices.id })
      .from(streamingServices)
      .where(eq(streamingServices.slug, service.slug))
      .limit(1);

    if (existingService.length > 0) {
      await db.update(streamingServices)
        .set({ name: service.name, isSubscribed: service.isSubscribed })
        .where(eq(streamingServices.slug, service.slug));
    } else {
      await db.insert(streamingServices).values({
        slug: service.slug,
        name: service.name,
        isSubscribed: service.isSubscribed,
      });
    }
  }

  // Sync deleted shows - clear and re-add (simple approach)
  await db.delete(deletedShows);
  for (const deleted of newSettings.deletedShows || []) {
    await db.insert(deletedShows).values({
      tmdbId: deleted.tmdbId ?? null,
      title: deleted.title,
      year: deleted.year ?? null,
      deletedAt: deleted.deletedAt,
    });
  }
}

export async function getSubscribedServices(): Promise<string[]> {
  const result = await db.select({ slug: streamingServices.slug })
    .from(streamingServices)
    .where(eq(streamingServices.isSubscribed, true));
  return result.map(r => r.slug);
}

// ==================== DELETED SHOWS ====================

export async function getDeletedShows(): Promise<DeletedShow[]> {
  const result = await db.select().from(deletedShows);
  return result.map(d => ({
    tmdbId: d.tmdbId ?? undefined,
    title: d.title,
    year: d.year ?? undefined,
    deletedAt: d.deletedAt,
  }));
}

// Get all deleted tmdbIds as a Set (for efficient bulk checking)
export async function getDeletedTmdbIds(): Promise<Set<number>> {
  const result = await db.select({ tmdbId: deletedShows.tmdbId }).from(deletedShows);
  return new Set(result.filter(r => r.tmdbId !== null).map(r => r.tmdbId as number));
}

export async function addDeletedShow(deleted: DeletedShow): Promise<void> {
  // Check for duplicates by tmdbId
  if (deleted.tmdbId) {
    const existing = await db.select({ id: deletedShows.id })
      .from(deletedShows)
      .where(eq(deletedShows.tmdbId, deleted.tmdbId))
      .limit(1);
    if (existing.length > 0) return;
  }

  await db.insert(deletedShows).values({
    tmdbId: deleted.tmdbId ?? null,
    title: deleted.title,
    year: deleted.year ?? null,
    deletedAt: deleted.deletedAt,
  });
}

export async function isShowDeleted(tmdbId?: number, title?: string, year?: number): Promise<boolean> {
  if (tmdbId) {
    const result = await db.select({ id: deletedShows.id })
      .from(deletedShows)
      .where(eq(deletedShows.tmdbId, tmdbId))
      .limit(1);
    if (result.length > 0) return true;
  }

  // Title+year fallback
  if (title) {
    const result = await db.select({ id: deletedShows.id })
      .from(deletedShows)
      .where(
        and(
          eq(deletedShows.title, title),
          year ? eq(deletedShows.year, year) : undefined
        )
      )
      .limit(1);
    if (result.length > 0) return true;
  }

  return false;
}

export async function clearDeletedShow(tmdbId?: number, title?: string, year?: number): Promise<void> {
  if (tmdbId) {
    await db.delete(deletedShows).where(eq(deletedShows.tmdbId, tmdbId));
  } else if (title) {
    await db.delete(deletedShows).where(
      and(
        eq(deletedShows.title, title),
        year ? eq(deletedShows.year, year) : undefined
      )
    );
  }
}

// ==================== HELPER: Generate ID ====================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== TYPE CONVERSION HELPERS ====================

function dbShowToOverlay(row: DbShow): ShowOverlay {
  return {
    tmdbId: row.tmdbId,
    title: row.title ?? undefined,
    year: row.year ?? undefined,
    posterPath: row.posterPath ?? undefined,
    overview: row.overview ?? undefined,
    genres: row.genres ?? undefined,
    numberOfSeasons: row.numberOfSeasons ?? undefined,
    showStatus: row.showStatus ?? undefined,
    watchPreference: row.watchPreference ?? undefined,
    watchPreferenceNote: row.watchPreferenceNote ?? undefined,
    rating: row.rating ?? undefined,
    reviewNote: row.reviewNote ?? undefined,
    notes: row.notes ?? undefined,
    ratedAt: row.ratedAt ?? undefined,
    predictedRating: row.predictedRating ?? undefined,
    predictedRatingReason: row.predictedRatingReason ?? undefined,
    recommendedWatchPreference: row.recommendedWatchPreference ?? undefined,
    predictionsUpdatedAt: row.predictionsUpdatedAt ?? undefined,
    hidden: row.hidden ?? undefined,
    dropped: row.dropped ?? undefined,
    imdbId: row.imdbId ?? undefined,
    imdbRating: row.imdbRating ?? undefined,
    imdbVoteCount: row.imdbVoteCount ?? undefined,
    traktRating: row.traktRating ?? undefined,
    traktVoteCount: row.traktVoteCount ?? undefined,
    tmdbRating: row.tmdbRating ?? undefined,
    tmdbVoteCount: row.tmdbVoteCount ?? undefined,
    rtCriticsScore: row.rtCriticsScore ?? undefined,
    rtAudienceScore: row.rtAudienceScore ?? undefined,
    rtFetchedAt: row.rtFetchedAt ?? undefined,
    streamingServices: row.streamingServices ?? undefined,
    streamingFetchedAt: row.streamingFetchedAt ?? undefined,
    justWatchUrl: row.justWatchUrl ?? undefined,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

function overlayToDbShow(overlay: ShowOverlay): Omit<typeof shows.$inferInsert, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    tmdbId: overlay.tmdbId,
    title: overlay.title ?? null,
    year: overlay.year ?? null,
    posterPath: overlay.posterPath ?? null,
    overview: overlay.overview ?? null,
    genres: overlay.genres ?? null,
    numberOfSeasons: overlay.numberOfSeasons ?? null,
    showStatus: overlay.showStatus ?? null,
    watchPreference: overlay.watchPreference ?? null,
    watchPreferenceNote: overlay.watchPreferenceNote ?? null,
    rating: overlay.rating ?? null,
    reviewNote: overlay.reviewNote ?? null,
    notes: overlay.notes ?? null,
    ratedAt: overlay.ratedAt ?? null,
    predictedRating: overlay.predictedRating ?? null,
    predictedRatingReason: overlay.predictedRatingReason ?? null,
    recommendedWatchPreference: overlay.recommendedWatchPreference ?? null,
    predictionsUpdatedAt: overlay.predictionsUpdatedAt ?? null,
    hidden: overlay.hidden ?? null,
    dropped: overlay.dropped ?? null,
    imdbId: overlay.imdbId ?? null,
    imdbRating: overlay.imdbRating ?? null,
    imdbVoteCount: overlay.imdbVoteCount ?? null,
    traktRating: overlay.traktRating ?? null,
    traktVoteCount: overlay.traktVoteCount ?? null,
    tmdbRating: overlay.tmdbRating ?? null,
    tmdbVoteCount: overlay.tmdbVoteCount ?? null,
    rtCriticsScore: overlay.rtCriticsScore ?? null,
    rtAudienceScore: overlay.rtAudienceScore ?? null,
    rtFetchedAt: overlay.rtFetchedAt ?? null,
    streamingServices: overlay.streamingServices ?? null,
    streamingFetchedAt: overlay.streamingFetchedAt ?? null,
    justWatchUrl: overlay.justWatchUrl ?? null,
  };
}
