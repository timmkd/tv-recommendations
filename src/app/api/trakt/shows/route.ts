import { NextRequest, NextResponse } from 'next/server';
import { getSettings, getOverlaysMap, saveOverlay, getOverlayByTmdbId, isShowDeleted } from '@/lib/data';
import { getUserShows, searchShows as traktSearch, TraktUserShow } from '@/lib/trakt';
import type { Show, ShowStatus, WatchPreference, ShowOverlay } from '@/types';

// Merge Trakt data with local overlay to create a Show object
function mergeWithOverlay(traktShow: TraktUserShow, overlay?: ShowOverlay): Show {
  return {
    id: `trakt-${traktShow.tmdbId}`, // Use tmdbId as the ID since we're Trakt-based
    tmdbId: traktShow.tmdbId,
    title: traktShow.title,
    year: traktShow.year,
    status: traktShow.status,

    // From overlay (custom data)
    posterPath: overlay?.posterPath,
    overview: overlay?.overview,
    watchPreference: overlay?.watchPreference,
    watchPreferenceNote: overlay?.watchPreferenceNote,
    rating: overlay?.rating,
    reviewNote: overlay?.reviewNote,
    predictedRating: overlay?.predictedRating,
    predictedRatingReason: overlay?.predictedRatingReason,
    recommendedWatchPreference: overlay?.recommendedWatchPreference,
    notes: overlay?.notes,
    hidden: overlay?.hidden,

    // External data from overlay cache
    genres: overlay?.genres || [],
    rtCriticsScore: overlay?.rtCriticsScore,
    rtAudienceScore: overlay?.rtAudienceScore,
    rtFetchedAt: overlay?.rtFetchedAt,
    streamingServices: overlay?.streamingServices || [],
    streamingFetchedAt: overlay?.streamingFetchedAt,
    justWatchUrl: overlay?.justWatchUrl,

    // Metadata
    createdAt: overlay?.createdAt || new Date().toISOString(),
    updatedAt: overlay?.updatedAt || new Date().toISOString()
  };
}

// GET shows from Trakt, merged with local overlays
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const settings = await getSettings();

    if (!settings.traktUsername) {
      return NextResponse.json(
        { error: 'Trakt username not configured. Set it in Settings.' },
        { status: 400 }
      );
    }

    // Get user shows from Trakt
    const traktShows = await getUserShows(settings.traktUsername);

    // Get local overlays
    const overlaysMap = await getOverlaysMap();

    // Merge and filter deleted shows
    let shows: Show[] = [];
    for (const traktShow of traktShows) {
      // Skip deleted shows
      if (await isShowDeleted(traktShow.tmdbId)) {
        continue;
      }

      const overlay = overlaysMap.get(traktShow.tmdbId);
      const show = mergeWithOverlay(traktShow, overlay);

      // Skip hidden shows unless specifically requested
      if (show.hidden && !searchParams.get('includeHidden')) {
        continue;
      }

      shows.push(show);
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

    // NOTE: Auto-enrichment disabled to prevent race conditions with concurrent requests
    // Use POST /api/trakt/posters to manually fetch missing poster data

    return NextResponse.json(shows);
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
    const { tmdbId, ...updates } = body;

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 });
    }

    const existingOverlay = await getOverlayByTmdbId(tmdbId);

    const updated: ShowOverlay = {
      tmdbId,
      ...existingOverlay,
      ...updates
    };

    await saveOverlay(updated);

    return NextResponse.json({ success: true, overlay: updated });
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
