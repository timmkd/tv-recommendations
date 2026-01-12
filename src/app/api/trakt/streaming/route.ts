import { NextRequest, NextResponse } from 'next/server';
import { getSettings, getOverlayByTmdbId, saveOverlay, getOverlaysMap } from '@/lib/db/queries';
import { getUserShows, getShowByTmdbId, getShowStreaming } from '@/lib/trakt';
import { getStreamingAvailability, getStreamingByTitle } from '@/lib/justwatch';

// POST to fetch streaming availability from TMDB
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdbIds, forceRefresh = false } = body as {
      tmdbIds?: number[];
      forceRefresh?: boolean;
    };

    const settings = await getSettings();
    if (!settings.traktUsername) {
      return NextResponse.json(
        { error: 'Trakt username not configured' },
        { status: 400 }
      );
    }

    // Get all user shows from Trakt
    const traktShows = await getUserShows(settings.traktUsername);
    const overlaysMap = await getOverlaysMap();

    // Filter to shows that need streaming data
    const showsToFetch: { tmdbId: number; title: string; year?: number; slug?: string }[] = [];

    for (const show of traktShows) {
      // If specific IDs provided, only fetch those
      if (tmdbIds && tmdbIds.length > 0 && !tmdbIds.includes(show.tmdbId)) {
        continue;
      }

      const overlay = overlaysMap.get(show.tmdbId);

      // Skip if we have fresh streaming data (less than 7 days old)
      if (!forceRefresh && overlay?.streamingFetchedAt) {
        const fetchedAt = new Date(overlay.streamingFetchedAt);
        const daysSinceFetch = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceFetch < 7) {
          continue;
        }
      }

      showsToFetch.push({
        tmdbId: show.tmdbId,
        title: show.title,
        year: show.year,
        slug: show.slug
      });
    }

    if (showsToFetch.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All streaming data is up to date',
        updated: 0,
        total: 0
      });
    }

    // Fetch streaming data with fallbacks (Trakt -> JustWatch by TMDB ID -> JustWatch by title)
    let updated = 0;
    const results: Record<number, string[]> = {};

    for (const show of showsToFetch) {
      try {
        let services: string[] = [];

        // Try 1: Trakt streaming endpoint (most reliable - uses slug)
        if (show.slug) {
          services = await getShowStreaming(show.slug, 'au');
        }

        // Try 2: JustWatch by TMDB ID (if Trakt returned empty)
        if (services.length === 0) {
          const streamingData = await getStreamingAvailability(show.tmdbId);
          services = streamingData.services;
        }

        // Try 3: JustWatch by title (final fallback)
        if (services.length === 0 && show.title) {
          const titleData = await getStreamingByTitle(show.title, show.year);
          services = titleData.services;
        }

        // Get existing overlay and update streaming data
        const existing = await getOverlayByTmdbId(show.tmdbId);

        await saveOverlay({
          tmdbId: show.tmdbId,
          ...existing,
          title: show.title,
          streamingServices: services,
          streamingFetchedAt: new Date().toISOString()
        });

        results[show.tmdbId] = services;
        updated++;

        // Rate limit - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`Failed to fetch streaming for ${show.title}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: showsToFetch.length,
      results
    });
  } catch (error) {
    console.error('Streaming fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch streaming' },
      { status: 500 }
    );
  }
}

// GET to check how many shows need streaming data
export async function GET() {
  try {
    const settings = await getSettings();
    if (!settings.traktUsername) {
      return NextResponse.json({ needsRefresh: 0, total: 0 });
    }

    const traktShows = await getUserShows(settings.traktUsername);
    const overlaysMap = await getOverlaysMap();
    let needsRefresh = 0;

    for (const show of traktShows) {
      const overlay = overlaysMap.get(show.tmdbId);

      if (!overlay?.streamingFetchedAt) {
        needsRefresh++;
        continue;
      }

      const fetchedAt = new Date(overlay.streamingFetchedAt);
      const daysSinceFetch = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceFetch >= 7) {
        needsRefresh++;
      }
    }

    return NextResponse.json({
      needsRefresh,
      total: traktShows.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check streaming status' },
      { status: 500 }
    );
  }
}
