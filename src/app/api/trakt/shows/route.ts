import { NextRequest, NextResponse } from 'next/server';
import { getSettings, getOverlaysMap, getOverlays, saveOverlay, getOverlayByTmdbId, getDeletedTmdbIds, setShowTags, getTagsForShow } from '@/lib/db/queries';
import {
  getUserShows,
  searchShows as traktSearch,
  TraktUserShow,
  syncRatingToTrakt,
  removeRatingFromTrakt,
  addToDroppedList,
  removeFromDroppedList,
  removeFromWatchlist,
  getDroppedShows,
  getUserRatings,
  getShowStreaming
} from '@/lib/trakt';
import { enrichShowWithTMDB } from '@/lib/tmdb';
import { getStreamingAvailability, getStreamingByTitle } from '@/lib/justwatch';
import type { Show, ShowStatus, WatchPreference, ShowOverlay } from '@/types';

// Merge Trakt data with local overlay to create a Show object
// Uses stored status from overlay if available, otherwise falls back to Trakt's computed status
function mergeWithOverlay(traktShow: TraktUserShow, overlay?: ShowOverlay): Show {
  return {
    id: `trakt-${traktShow.tmdbId}`, // Use tmdbId as the ID since we're Trakt-based
    tmdbId: traktShow.tmdbId,
    title: traktShow.title,
    year: traktShow.year,
    // Use stored status if explicitly set (including null for removed), otherwise use Trakt's computed status
    status: overlay && 'status' in overlay ? overlay.status : traktShow.status,

    // From overlay (custom data)
    posterPath: overlay?.posterPath,
    overview: overlay?.overview,
    watchPreference: overlay?.watchPreference,
    watchPreferenceNote: overlay?.watchPreferenceNote,
    rating: overlay?.rating,
    bingeability: overlay?.bingeability,
    reviewNote: overlay?.reviewNote,
    predictedRating: overlay?.predictedRating,
    predictedRatingReason: overlay?.predictedRatingReason,
    predictedBingeability: overlay?.predictedBingeability,
    recommendedWatchPreference: overlay?.recommendedWatchPreference,
    predictionsUpdatedAt: overlay?.predictionsUpdatedAt,
    notes: overlay?.notes,
    hidden: overlay?.hidden,
    dropped: overlay?.dropped,

    // External data from overlay cache
    genres: overlay?.genres || [],
    tmdbRating: overlay?.tmdbRating,
    tmdbVoteCount: overlay?.tmdbVoteCount,
    rtCriticsScore: overlay?.rtCriticsScore,
    rtAudienceScore: overlay?.rtAudienceScore,
    rtFetchedAt: overlay?.rtFetchedAt,
    streamingServices: overlay?.streamingServices || [],
    streamingFetchedAt: overlay?.streamingFetchedAt,
    justWatchUrl: overlay?.justWatchUrl,
    numberOfSeasons: overlay?.numberOfSeasons,
    showStatus: overlay?.showStatus,

    // Metadata
    createdAt: overlay?.createdAt || new Date().toISOString(),
    updatedAt: overlay?.updatedAt || new Date().toISOString()
  };
}

// Convert overlay to Show (fallback when Trakt is unavailable)
function overlayToShow(overlay: ShowOverlay): Show {
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

// GET shows from Trakt, merged with local overlays
// Falls back to overlays-only mode if Trakt is rate limited
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const settings = await getSettings();
    const fallbackOnly = searchParams.get('fallback') === 'true';
    const syncFromTrakt = searchParams.get('syncFromTrakt') === 'true';

    let shows: Show[] = [];
    let usedFallback = false;

    // Fetch deleted IDs once upfront (single query instead of N queries)
    const deletedTmdbIds = await getDeletedTmdbIds();

    // Try Trakt first (unless fallback-only mode)
    if (!fallbackOnly && settings.traktUsername) {
      try {
        // Fetch shows and optionally sync dropped/ratings from Trakt.
        // NOTE: hidden is intentionally NOT synced from Trakt. Trakt's "hidden from
        // recommendations" means "stop suggesting this" (normal for watched/watchlist
        // shows) and must NOT be conflated with the app's local "hide from library".
        const [traktShows, droppedFromTrakt, ratingsFromTrakt] = await Promise.all([
          getUserShows(settings.traktUsername),
          syncFromTrakt ? getDroppedShows() : Promise.resolve(new Set<number>()),
          syncFromTrakt ? getUserRatings() : Promise.resolve(new Map<number, number>())
        ]);

        if (traktShows.length > 0) {
          // Get local overlays
          const overlaysMap = await getOverlaysMap();

          // Merge and filter deleted shows
          const traktTmdbIds = new Set<number>();
          const newOverlaysToSave: { overlay: ShowOverlay; slug: string }[] = [];

          for (const traktShow of traktShows) {
            if (deletedTmdbIds.has(traktShow.tmdbId)) {
              continue;
            }

            traktTmdbIds.add(traktShow.tmdbId);
            let overlay = overlaysMap.get(traktShow.tmdbId);

            // Create overlay for new shows so they're available in fallback mode
            if (!overlay) {
              overlay = {
                tmdbId: traktShow.tmdbId,
                traktSlug: traktShow.slug,
                status: traktShow.status, // Save the computed status
                title: traktShow.title,
                year: traktShow.year,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              newOverlaysToSave.push({ overlay, slug: traktShow.slug });
            } else {
              // Always ensure traktSlug is saved (needed for progress sync)
              if (!overlay.traktSlug || overlay.traktSlug !== traktShow.slug) {
                overlay = { ...overlay, traktSlug: traktShow.slug };
                saveOverlay(overlay).catch(err => console.error('Failed to save traktSlug:', err));
              }
            }

            // Merge Trakt sync data if syncing (only update if not already set locally)
            if (syncFromTrakt) {
              const tmdbId = traktShow.tmdbId;
              let overlayUpdated = false;

              // Sync dropped status from Trakt
              if (droppedFromTrakt.has(tmdbId) && !overlay.dropped) {
                overlay = { ...overlay, dropped: true };
                overlayUpdated = true;
              }

              // Sync rating from Trakt (only if we don't have a local rating)
              const traktRating = ratingsFromTrakt.get(tmdbId);
              if (traktRating && !overlay.rating) {
                overlay = { ...overlay, rating: traktRating, ratedAt: new Date().toISOString() };
                overlayUpdated = true;
              }

              // Save updated overlay in background
              if (overlayUpdated) {
                saveOverlay(overlay).catch(err => console.error('Failed to save synced overlay:', err));
              }
            }

            const show = mergeWithOverlay(traktShow, overlay);

            if (show.hidden && !searchParams.get('includeHidden')) {
              continue;
            }

            shows.push(show);
          }

          // Save new overlays and enrich with TMDB + streaming data in background (don't block response)
          if (newOverlaysToSave.length > 0) {
            (async () => {
              for (const { overlay, slug } of newOverlaysToSave) {
                try {
                  // First save basic overlay
                  await saveOverlay(overlay);

                  // Enrich with TMDB data (poster, genres, etc.)
                  const tmdbData = await enrichShowWithTMDB(overlay.tmdbId);

                  // Fetch streaming availability via JustWatch (accurate; Trakt's
                  // watchnow/au returns empty). Fall back to title search, then Trakt.
                  let streamingServices: string[] = [];
                  try {
                    const jw = await getStreamingAvailability(overlay.tmdbId, overlay.title, overlay.year);
                    streamingServices = jw.services;
                    if (streamingServices.length === 0 && overlay.title) {
                      const byTitle = await getStreamingByTitle(overlay.title, overlay.year);
                      streamingServices = byTitle.services;
                    }
                    if (streamingServices.length === 0) {
                      streamingServices = await getShowStreaming(slug, 'au');
                    }
                  } catch (err) {
                    console.error(`Failed to fetch streaming for ${overlay.title}:`, err);
                  }

                  // Save enriched overlay with TMDB and streaming data
                  await saveOverlay({
                    ...overlay,
                    posterPath: tmdbData.posterPath,
                    overview: tmdbData.overview,
                    genres: tmdbData.genres,
                    numberOfSeasons: tmdbData.numberOfSeasons,
                    showStatus: tmdbData.showStatus,
                    tmdbRating: tmdbData.tmdbRating,
                    tmdbVoteCount: tmdbData.tmdbVoteCount,
                    streamingServices: streamingServices.length > 0 ? streamingServices : undefined,
                    streamingFetchedAt: streamingServices.length > 0 ? new Date().toISOString() : undefined,
                    updatedAt: new Date().toISOString()
                  });

                  // Small delay between shows to avoid rate limiting
                  await new Promise(resolve => setTimeout(resolve, 150));
                } catch (err) {
                  console.error(`Failed to enrich show ${overlay.tmdbId}:`, err);
                }
              }
            })();
          }

          // Also include overlay-only shows (not in Trakt but in overlays)
          for (const [tmdbId, overlay] of overlaysMap) {
            if (traktTmdbIds.has(tmdbId)) continue; // Already included from Trakt
            if (deletedTmdbIds.has(tmdbId)) continue;
            if (!overlay.title) continue; // Skip unenriched overlays

            const show = overlayToShow(overlay);
            if (show.hidden && !searchParams.get('includeHidden')) {
              continue;
            }
            shows.push(show);
          }
        }
      } catch (traktError) {
        console.error('[shows] Trakt fetch failed, using fallback:', traktError);
      }
    }

    // Fallback to overlays-only if Trakt returned nothing
    if (shows.length === 0) {
      console.log('Using overlays fallback mode');
      usedFallback = true;
      const overlays = await getOverlays();

      for (const overlay of overlays) {
        if (deletedTmdbIds.has(overlay.tmdbId)) {
          continue;
        }

        // Only include overlays that have title (enriched ones)
        if (!overlay.title) {
          continue;
        }

        const show = overlayToShow(overlay);

        if (show.hidden && !searchParams.get('includeHidden')) {
          continue;
        }

        shows.push(show);
      }
    }

    // Apply filters
    const status = searchParams.get('status') as ShowStatus | null;
    const preference = searchParams.get('preference') as WatchPreference | null;
    const streaming = searchParams.get('streaming');

    if (status) {
      shows = shows.filter(s => s.status === status);
    }
    if (preference) {
      shows = shows.filter(s => s.watchPreference === preference);
    }
    if (streaming) {
      shows = shows.filter(s => s.streamingServices.includes(streaming));
    }

    // Add headers
    const response = NextResponse.json(shows);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (usedFallback) {
      response.headers.set('X-Fallback-Mode', 'true');
    }
    return response;
  } catch (error) {
    console.error('Trakt shows error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get shows from Trakt' },
      { status: 500 }
    );
  }
}

// PUT update overlay data for a show (identified by tmdbId)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdbId, tags: tagNames, ...updates } = body;

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 });
    }

    const existingOverlay = await getOverlayByTmdbId(tmdbId);

    // Check what changed for timestamps and Trakt sync.
    // NOTE: `hidden` is a local-only flag and is intentionally NOT synced to Trakt.
    const ratingChanged = updates.rating !== undefined && updates.rating !== existingOverlay?.rating;
    const droppedChanged = updates.dropped !== undefined && updates.dropped !== existingOverlay?.dropped;
    const removedFromWatchlist = updates.status === null && existingOverlay?.status === 'watchlist';

    // Check if predictions changed - set predictionsUpdatedAt timestamp
    const predictionsChanged = (
      (updates.predictedRating !== undefined && updates.predictedRating !== existingOverlay?.predictedRating) ||
      (updates.predictedRatingReason !== undefined && updates.predictedRatingReason !== existingOverlay?.predictedRatingReason) ||
      (updates.recommendedWatchPreference !== undefined && updates.recommendedWatchPreference !== existingOverlay?.recommendedWatchPreference)
    );

    const updated: ShowOverlay = {
      tmdbId,
      ...existingOverlay,
      ...updates,
      // Set timestamps for rating/prediction changes
      ...(ratingChanged && { ratedAt: new Date().toISOString() }),
      ...(predictionsChanged && { predictionsUpdatedAt: new Date().toISOString() })
    };

    await saveOverlay(updated);

    // Handle tags separately (stored in junction table)
    if (tagNames !== undefined && Array.isArray(tagNames)) {
      await setShowTags(tmdbId, tagNames);
    }

    // Sync changes to Trakt in background (don't block response)
    const syncResults: { rating?: boolean; dropped?: boolean; watchlist?: boolean } = {};

    (async () => {
      try {
        // Remove from Trakt watchlist if status changed to null
        if (removedFromWatchlist) {
          syncResults.watchlist = await removeFromWatchlist(tmdbId);
        }

        // Sync rating to Trakt
        if (ratingChanged) {
          if (updates.rating) {
            syncResults.rating = await syncRatingToTrakt(tmdbId, updates.rating);
          } else {
            // Rating was removed
            syncResults.rating = await removeRatingFromTrakt(tmdbId);
          }
        }

        // Sync dropped status to Trakt (via custom list)
        if (droppedChanged) {
          if (updates.dropped) {
            syncResults.dropped = await addToDroppedList(tmdbId);
          } else {
            syncResults.dropped = await removeFromDroppedList(tmdbId);
          }
        }
      } catch (err) {
        console.error('Trakt sync error:', err);
      }
    })();

    // Include tags in response
    const showTags = await getTagsForShow(tmdbId);

    return NextResponse.json({ success: true, overlay: updated, tags: showTags });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update overlay' },
      { status: 500 }
    );
  }
}

// Search shows via Trakt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const results = await traktSearch(query);

    // Convert to a simpler format
    const shows = results.slice(0, 20).map(r => ({
      tmdbId: r.show.ids.tmdb,
      traktId: r.show.ids.trakt,
      title: r.show.title,
      year: r.show.year,
      overview: r.show.overview,
      genres: r.show.genres || []
    }));

    return NextResponse.json(shows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search Trakt' },
      { status: 500 }
    );
  }
}
