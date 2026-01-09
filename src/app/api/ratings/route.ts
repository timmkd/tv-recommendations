import { NextRequest, NextResponse } from 'next/server';
import { getRTRatings } from '@/lib/rottentomatoes';
import { getOverlayByTmdbId, saveOverlay } from '@/lib/data';

// GET ratings for a show (fetches from RT and caches in overlays)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tmdbId = searchParams.get('tmdbId');
    const title = searchParams.get('title');
    const year = searchParams.get('year');
    const refresh = searchParams.get('refresh') === 'true';

    // If tmdbId provided, check overlay cache first
    if (tmdbId) {
      const tmdbIdNum = parseInt(tmdbId);
      const overlay = await getOverlayByTmdbId(tmdbIdNum);

      if (!title) {
        return NextResponse.json(
          { error: 'title is required when using tmdbId' },
          { status: 400 }
        );
      }

      // Check if cache is stale (older than 30 days)
      const STALE_DAYS = 30;
      const isStale = overlay?.rtFetchedAt
        ? (Date.now() - new Date(overlay.rtFetchedAt).getTime()) > STALE_DAYS * 24 * 60 * 60 * 1000
        : true;

      // Return cached ratings if available, not refreshing, and not stale
      if (!refresh && !isStale && overlay && (overlay.rtCriticsScore || overlay.rtAudienceScore)) {
        return NextResponse.json({
          criticsScore: overlay.rtCriticsScore,
          audienceScore: overlay.rtAudienceScore,
          cached: true
        });
      }

      // Fetch fresh ratings
      const ratings = await getRTRatings(title, year ? parseInt(year) : undefined);

      // Cache the ratings in overlay
      await saveOverlay({
        tmdbId: tmdbIdNum,
        ...(overlay || {}),
        rtCriticsScore: ratings.criticsScore,
        rtAudienceScore: ratings.audienceScore,
        rtFetchedAt: new Date().toISOString()
      });

      return NextResponse.json({
        ...ratings,
        cached: false
      });
    }

    // If title provided, just fetch ratings without caching
    if (title) {
      const ratings = await getRTRatings(title, year ? parseInt(year) : undefined);
      return NextResponse.json(ratings);
    }

    return NextResponse.json(
      { error: 'Either tmdbId+title or just title is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Ratings error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get ratings' },
      { status: 500 }
    );
  }
}

// POST to batch update ratings for multiple shows
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shows } = body as { shows: { tmdbId: number; title: string; year?: number }[] };

    if (!shows || !Array.isArray(shows)) {
      return NextResponse.json(
        { error: 'shows array is required (each with tmdbId, title, year)' },
        { status: 400 }
      );
    }

    const results: Record<number, { criticsScore?: number; audienceScore?: number }> = {};
    let updated = 0;

    const STALE_DAYS = 30;
    const staleThreshold = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

    for (const show of shows) {
      const overlay = await getOverlayByTmdbId(show.tmdbId);

      // Check if data is fresh (has scores and not stale)
      const isFresh = overlay && (overlay.rtCriticsScore || overlay.rtAudienceScore) &&
        overlay.rtFetchedAt &&
        new Date(overlay.rtFetchedAt).getTime() > staleThreshold;

      if (isFresh) {
        results[show.tmdbId] = {
          criticsScore: overlay.rtCriticsScore,
          audienceScore: overlay.rtAudienceScore
        };
        continue;
      }

      try {
        const ratings = await getRTRatings(show.title, show.year);
        results[show.tmdbId] = ratings;

        // Cache in overlay
        await saveOverlay({
          tmdbId: show.tmdbId,
          ...(overlay || {}),
          rtCriticsScore: ratings.criticsScore,
          rtAudienceScore: ratings.audienceScore,
          rtFetchedAt: new Date().toISOString()
        });
        updated++;

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch {
        results[show.tmdbId] = {};
      }
    }

    return NextResponse.json({
      results,
      updated,
      total: shows.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update ratings' },
      { status: 500 }
    );
  }
}
