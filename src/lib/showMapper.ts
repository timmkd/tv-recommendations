import type { Show, ShowOverlay } from '@/types';

/**
 * Map a stored overlay row to the Show shape the UI consumes.
 *
 * NOTE: `Show.id` is a synthetic `overlay-<tmdbId>` string, not a database row
 * id. Anything that passes an id to the API (ShowEditModal does) must run it
 * back through `tmdbIdFromShowId` before querying.
 *
 * Lives here rather than in an API route so both /api/shows and
 * /api/trakt/shows return an identical shape — they previously diverged, which
 * is how the show detail page ended up unreachable.
 */
export function overlayToShow(overlay: ShowOverlay): Show {
  return {
    id: `overlay-${overlay.tmdbId}`,
    tmdbId: overlay.tmdbId,
    title: overlay.title || `Show ${overlay.tmdbId}`,
    year: overlay.year,
    // Use stored status (null = removed from watchlist), fallback for legacy data only
    status: overlay.status !== undefined ? overlay.status : (overlay.rating ? 'completed' : 'watchlist'),
    posterPath: overlay.posterPath,
    overview: overlay.overview,
    watchPreference: overlay.watchPreference,
    watchPreferenceNote: overlay.watchPreferenceNote,
    rating: overlay.rating,
    bingeability: overlay.bingeability,
    reviewNote: overlay.reviewNote,
    predictedRating: overlay.predictedRating,
    predictedRatingReason: overlay.predictedRatingReason,
    predictedBingeability: overlay.predictedBingeability,
    predictedBingeabilityReason: overlay.predictedBingeabilityReason,
    recommendedWatchPreference: overlay.recommendedWatchPreference,
    predictionsUpdatedAt: overlay.predictionsUpdatedAt,
    notes: overlay.notes,
    hidden: overlay.hidden,
    dropped: overlay.dropped,
    genres: overlay.genres || [],
    tmdbRating: overlay.tmdbRating,
    tmdbVoteCount: overlay.tmdbVoteCount,
    rtCriticsScore: overlay.rtCriticsScore,
    rtAudienceScore: overlay.rtAudienceScore,
    rtFetchedAt: overlay.rtFetchedAt,
    streamingServices: overlay.streamingServices || [],
    streamingFetchedAt: overlay.streamingFetchedAt,
    justWatchUrl: overlay.justWatchUrl,
    numberOfSeasons: overlay.numberOfSeasons,
    showStatus: overlay.showStatus,
    createdAt: overlay.createdAt || new Date().toISOString(),
    updatedAt: overlay.updatedAt || new Date().toISOString()
  };
}

/**
 * Resolve a tmdbId from whatever the UI passed: a synthetic `overlay-<tmdbId>`
 * id, or a bare numeric tmdbId. Returns null when the value is unusable.
 */
export function tmdbIdFromShowId(value: string | null): number | null {
  if (!value) return null;
  const raw = value.startsWith('overlay-') ? value.slice('overlay-'.length) : value;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
