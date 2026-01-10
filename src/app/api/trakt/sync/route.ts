import { NextRequest, NextResponse } from 'next/server';
import { getSettings, getOverlayByTmdbId, saveOverlay } from '@/lib/data';
import { enrichShowWithTMDB } from '@/lib/tmdb';
import { getRTRatings } from '@/lib/rottentomatoes';
import { getStreamingAvailability } from '@/lib/justwatch';
import type { ShowStatus } from '@/types';

const TRAKT_API_URL = 'https://api.trakt.tv';

// Get auth headers for Trakt
async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const settings = await getSettings();
  if (!settings.traktAuth?.accessToken) {
    return null;
  }

  const clientId = process.env.TRAKT_CLIENT_ID;
  if (!clientId) {
    return null;
  }

  return {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
    'Authorization': `Bearer ${settings.traktAuth.accessToken}`
  };
}

// POST to sync a single show - refreshes all data from all sources
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdbId, addToWatchlist = false } = body as { tmdbId: number; addToWatchlist?: boolean };

    if (!tmdbId) {
      return NextResponse.json(
        { error: 'tmdbId is required' },
        { status: 400 }
      );
    }

    const results: {
      trakt?: { success: boolean; status?: ShowStatus; aired?: number; completed?: number; addedToWatchlist?: boolean; error?: string };
      tmdb?: { success: boolean; posterPath?: string; genres?: string[]; error?: string };
      rt?: { success: boolean; criticsScore?: number; audienceScore?: number; error?: string };
      streaming?: { success: boolean; services?: string[]; error?: string };
    } = {};

    // Get existing overlay data
    const existing = await getOverlayByTmdbId(tmdbId);
    let title = existing?.title || '';
    let year = existing?.year;

    // 1. Sync with Trakt - add to watchlist and get progress
    const authHeaders = await getAuthHeaders();
    if (authHeaders) {
      try {
        // Look up show by TMDB ID
        const searchUrl = `${TRAKT_API_URL}/search/tmdb/${tmdbId}?type=show`;
        const searchResponse = await fetch(searchUrl, { headers: authHeaders });

        if (searchResponse.ok) {
          const searchResults = await searchResponse.json();
          if (searchResults.length && searchResults[0].show) {
            const traktShow = searchResults[0].show;
            const traktSlug = traktShow.ids.slug;
            const traktId = traktShow.ids.trakt;
            title = traktShow.title;
            year = traktShow.year;

            // Only add to watchlist if explicitly requested
            let addedToWatchlistResult = false;
            if (addToWatchlist) {
              const watchlistUrl = `${TRAKT_API_URL}/sync/watchlist`;
              const watchlistResponse = await fetch(watchlistUrl, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                  shows: [{ ids: { trakt: traktId } }]
                })
              });
              addedToWatchlistResult = watchlistResponse.ok;
            }

            // Get progress
            const progressUrl = `${TRAKT_API_URL}/shows/${traktSlug}/progress/watched`;
            const progressResponse = await fetch(progressUrl, { headers: authHeaders });

            let status: ShowStatus = 'watchlist';
            let aired = 0;
            let completed = 0;

            if (progressResponse.ok) {
              const progress = await progressResponse.json();
              aired = progress.aired || 0;
              completed = progress.completed || 0;

              if (completed > 0) {
                status = completed >= aired ? 'completed' : 'watching';
              }
            }

            results.trakt = { success: true, status, aired, completed, addedToWatchlist: addedToWatchlistResult };
          } else {
            results.trakt = { success: false, error: 'Show not found on Trakt' };
          }
        } else {
          results.trakt = { success: false, error: `Trakt search failed: ${searchResponse.status}` };
        }
      } catch (error) {
        results.trakt = { success: false, error: error instanceof Error ? error.message : 'Trakt sync failed' };
      }
    } else {
      results.trakt = { success: false, error: 'Not authenticated with Trakt' };
    }

    // 2. Enrich with TMDB metadata
    try {
      const tmdbData = await enrichShowWithTMDB(tmdbId);
      year = tmdbData.year || year;
      results.tmdb = {
        success: true,
        posterPath: tmdbData.posterPath,
        genres: tmdbData.genres
      };
    } catch (error) {
      results.tmdb = { success: false, error: error instanceof Error ? error.message : 'TMDB fetch failed' };
    }

    // 3. Get Rotten Tomatoes scores
    if (title) {
      try {
        const rtData = await getRTRatings(title, year);
        results.rt = {
          success: true,
          criticsScore: rtData.criticsScore,
          audienceScore: rtData.audienceScore
        };
      } catch (error) {
        results.rt = { success: false, error: error instanceof Error ? error.message : 'RT fetch failed' };
      }
    }

    // 4. Get streaming availability
    try {
      const streamingData = await getStreamingAvailability(tmdbId);
      results.streaming = {
        success: true,
        services: streamingData.services
      };
    } catch (error) {
      results.streaming = { success: false, error: error instanceof Error ? error.message : 'Streaming fetch failed' };
    }

    // Save all updated data to overlay
    const tmdbData = results.tmdb?.success ? await enrichShowWithTMDB(tmdbId).catch(() => null) : null;

    await saveOverlay({
      tmdbId,
      ...existing,
      title: title || existing?.title,
      year: year || existing?.year,
      // TMDB data
      posterPath: tmdbData?.posterPath || existing?.posterPath,
      overview: tmdbData?.overview || existing?.overview,
      genres: tmdbData?.genres?.length ? tmdbData.genres : existing?.genres,
      numberOfSeasons: tmdbData?.numberOfSeasons || existing?.numberOfSeasons,
      showStatus: tmdbData?.showStatus || existing?.showStatus,
      // RT data
      rtCriticsScore: results.rt?.criticsScore ?? existing?.rtCriticsScore,
      rtAudienceScore: results.rt?.audienceScore ?? existing?.rtAudienceScore,
      rtFetchedAt: results.rt?.success ? new Date().toISOString() : existing?.rtFetchedAt,
      // Streaming data
      streamingServices: results.streaming?.services?.length ? results.streaming.services : existing?.streamingServices,
      streamingFetchedAt: results.streaming?.success ? new Date().toISOString() : existing?.streamingFetchedAt
    });

    return NextResponse.json({
      success: true,
      tmdbId,
      title,
      results
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
