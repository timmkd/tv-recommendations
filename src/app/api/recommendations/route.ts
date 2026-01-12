import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations } from '@/lib/openai';
import { getSettings, getSubscribedServices, getOverlays } from '@/lib/db/queries';
import { getUserShows } from '@/lib/trakt';
import type { WatchPreference, Show } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const preference = (searchParams.get('preference') || 'any') as WatchPreference | 'any';
    const count = parseInt(searchParams.get('count') || '5');

    // Get settings for Trakt username
    const settings = await getSettings();
    const subscribedServices = await getSubscribedServices();

    if (!settings.traktUsername) {
      return NextResponse.json({
        recommendations: [],
        message: 'Trakt username not configured. Set it in Settings.'
      });
    }

    // Get shows from Trakt
    const traktShows = await getUserShows(settings.traktUsername);
    const overlays = await getOverlays();
    const overlaysMap = new Map(overlays.map(o => [o.tmdbId, o]));

    // Merge Trakt shows with overlay data
    const shows: Show[] = traktShows.map(ts => {
      const overlay = overlaysMap.get(ts.tmdbId);
      return {
        id: `trakt-${ts.tmdbId}`,
        tmdbId: ts.tmdbId,
        title: ts.title,
        year: ts.year,
        status: ts.status,
        watchPreference: overlay?.watchPreference,
        watchPreferenceNote: overlay?.watchPreferenceNote,
        rating: overlay?.rating,
        reviewNote: overlay?.reviewNote,
        predictedRating: overlay?.predictedRating,
        predictedRatingReason: overlay?.predictedRatingReason,
        notes: overlay?.notes,
        genres: overlay?.genres || [],
        streamingServices: overlay?.streamingServices || [],
        createdAt: overlay?.createdAt || new Date().toISOString(),
        updatedAt: overlay?.updatedAt || new Date().toISOString()
      };
    });

    if (shows.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'No shows in your Trakt library. Add some shows to get recommendations.'
      });
    }

    // Get recommendations from OpenAI
    const recommendations = await getRecommendations({
      shows,
      preference,
      subscribedServices,
      count
    });

    return NextResponse.json({
      recommendations,
      preference,
      basedOnCount: shows.filter(s => s.status === 'completed' || (s.rating && s.rating >= 4)).length
    });
  } catch (error) {
    console.error('Recommendations error:', error);

    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env.local file.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}
