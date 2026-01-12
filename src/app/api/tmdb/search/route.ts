import { NextRequest, NextResponse } from 'next/server';
import { searchShows, getPosterUrl, getGenreNames } from '@/lib/tmdb';
import { getOverlayByTmdbId } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const results = await searchShows(query);

    // Enhance results and check if has local overlay data
    const enhanced = await Promise.all(
      results.slice(0, 10).map(async (result) => {
        const overlay = await getOverlayByTmdbId(result.id);
        return {
          tmdbId: result.id,
          title: result.name,
          year: result.first_air_date ? parseInt(result.first_air_date.split('-')[0]) : null,
          posterUrl: getPosterUrl(result.poster_path),
          overview: result.overview,
          genres: getGenreNames(result.genre_ids),
          hasOverlay: !!overlay
        };
      })
    );

    return NextResponse.json(enhanced);
  } catch (error) {
    console.error('TMDB search error:', error);

    if (error instanceof Error && error.message.includes('TMDB_API_KEY')) {
      return NextResponse.json(
        { error: 'TMDB API key not configured. Add TMDB_API_KEY to your .env.local file.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
