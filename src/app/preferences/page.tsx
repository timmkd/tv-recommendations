import { getSettings, getOverlays } from '@/lib/db/queries';
import { getUserShows } from '@/lib/trakt';
import type { Show } from '@/types';

export const dynamic = 'force-dynamic';

interface RatedShow {
  show: Show;
  rating: number;
  reviewNote?: string;
  watchPreferenceNote?: string;
}

function getShowsByPreference(shows: Show[], preference: 'solo' | 'together'): RatedShow[] {
  return shows
    .filter(s => s.watchPreference === preference && s.rating)
    .map(s => ({
      show: s,
      rating: s.rating!,
      reviewNote: s.reviewNote,
      watchPreferenceNote: s.watchPreferenceNote
    }))
    .sort((a, b) => b.rating - a.rating);
}

function getAverageRating(shows: RatedShow[]): number {
  if (shows.length === 0) return 0;
  const sum = shows.reduce((acc, s) => acc + s.rating, 0);
  return Math.round((sum / shows.length) * 10) / 10;
}

function getShowsWithReviewNotes(shows: RatedShow[]): { title: string; rating: number; notes: string }[] {
  return shows
    .filter(s => s.reviewNote)
    .map(s => ({
      title: s.show.title,
      rating: s.rating,
      notes: s.reviewNote!
    }));
}

function getShowsWithPreferenceNotes(shows: RatedShow[]): { title: string; notes: string }[] {
  return shows
    .filter(s => s.watchPreferenceNote)
    .map(s => ({
      title: s.show.title,
      notes: s.watchPreferenceNote!
    }));
}

export default async function PreferencesPage() {
  const settings = await getSettings();

  // If no Trakt username, show empty state
  if (!settings.traktUsername) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-16 bg-gray-800 rounded-lg">
            <p className="text-gray-400 mb-4">Trakt username not configured</p>
            <p className="text-gray-500 text-sm">
              Set your Trakt username in Settings to see your viewing preferences.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch shows from Trakt and merge with overlays
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

  const soloShows = getShowsByPreference(shows, 'solo');
  const togetherShows = getShowsByPreference(shows, 'together');

  const soloReviewNotes = getShowsWithReviewNotes(soloShows);
  const togetherReviewNotes = getShowsWithReviewNotes(togetherShows);

  const soloPreferenceNotes = getShowsWithPreferenceNotes(soloShows);
  const togetherPreferenceNotes = getShowsWithPreferenceNotes(togetherShows);

  const soloAvg = getAverageRating(soloShows);
  const togetherAvg = getAverageRating(togetherShows);

  // Get high-rated shows (4+ stars) for preference analysis
  const soloFavorites = soloShows.filter(s => s.rating >= 4);
  const togetherFavorites = togetherShows.filter(s => s.rating >= 4);

  // Count all shows with each preference (rated or not)
  const allSoloCount = shows.filter(s => s.watchPreference === 'solo').length;
  const allTogetherCount = shows.filter(s => s.watchPreference === 'together').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Viewing Preferences</h1>
          <p className="text-gray-400">
            Analysis of your ratings and notes to understand what you enjoy watching
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Solo Preferences */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-blue-400 mb-4">Solo Watching</h2>

              <div className="flex gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{allSoloCount}</div>
                  <div className="text-sm text-gray-400">Shows marked solo</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{soloShows.length}</div>
                  <div className="text-sm text-gray-400">Rated</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{soloAvg || '-'}★</div>
                  <div className="text-sm text-gray-400">Avg rating</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{soloFavorites.length}</div>
                  <div className="text-sm text-gray-400">Favorites (4+★)</div>
                </div>
              </div>

              {soloFavorites.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Top Rated Solo Shows</h3>
                  <div className="space-y-2">
                    {soloFavorites.slice(0, 5).map(({ show, rating }) => (
                      <div key={show.id} className="flex justify-between items-center bg-gray-700/50 rounded px-3 py-2">
                        <span className="truncate">{show.title}</span>
                        <span className="text-yellow-400 ml-2">{rating}★</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Solo Preference Notes */}
            {soloPreferenceNotes.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Why Solo?</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Notes explaining why these shows are best watched alone
                </p>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {soloPreferenceNotes.map((item, i) => (
                    <div key={i} className="border-l-2 border-blue-500 pl-3">
                      <span className="font-medium text-sm">{item.title}</span>
                      <p className="text-gray-300 text-sm">{item.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Solo Review Notes */}
            {soloReviewNotes.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">What You Liked (Solo)</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Reviews of solo shows to understand your taste
                </p>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {soloReviewNotes.map((item, i) => (
                    <div key={i} className="border-l-2 border-blue-400 pl-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{item.title}</span>
                        <span className="text-yellow-400 text-sm">{item.rating}★</span>
                      </div>
                      <p className="text-gray-300 text-sm">{item.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Together Preferences */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-pink-400 mb-4">Watching Together</h2>

              <div className="flex gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{allTogetherCount}</div>
                  <div className="text-sm text-gray-400">Shows marked together</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{togetherShows.length}</div>
                  <div className="text-sm text-gray-400">Rated</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{togetherAvg || '-'}★</div>
                  <div className="text-sm text-gray-400">Avg rating</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{togetherFavorites.length}</div>
                  <div className="text-sm text-gray-400">Favorites (4+★)</div>
                </div>
              </div>

              {togetherFavorites.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Top Rated Together Shows</h3>
                  <div className="space-y-2">
                    {togetherFavorites.slice(0, 5).map(({ show, rating }) => (
                      <div key={show.id} className="flex justify-between items-center bg-gray-700/50 rounded px-3 py-2">
                        <span className="truncate">{show.title}</span>
                        <span className="text-yellow-400 ml-2">{rating}★</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Together Preference Notes */}
            {togetherPreferenceNotes.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Why Together?</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Notes explaining why these shows are great for watching together
                </p>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {togetherPreferenceNotes.map((item, i) => (
                    <div key={i} className="border-l-2 border-pink-500 pl-3">
                      <span className="font-medium text-sm">{item.title}</span>
                      <p className="text-gray-300 text-sm">{item.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Together Review Notes */}
            {togetherReviewNotes.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">What You Liked (Together)</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Reviews of together shows to understand shared preferences
                </p>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {togetherReviewNotes.map((item, i) => (
                    <div key={i} className="border-l-2 border-pink-400 pl-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{item.title}</span>
                        <span className="text-yellow-400 text-sm">{item.rating}★</span>
                      </div>
                      <p className="text-gray-300 text-sm">{item.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Prompt for Claude */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Generate New Recommendations</h2>
          <p className="text-gray-400 text-sm mb-4">
            Ask Claude to analyze your preferences and generate personalized recommendations.
            Claude will read your ratings, review notes, and preference notes to understand your taste.
          </p>
          <div className="bg-gray-900 rounded p-4 font-mono text-sm text-gray-300">
            <p className="text-gray-500 mb-2"># Example prompt for Claude:</p>
            <p>"Please analyze my viewing preferences and update my recommendations.
            Look at my watchPreference, watchPreferenceNote, rating, and reviewNote fields
            to understand what I enjoy solo vs together."</p>
          </div>
        </div>

        {/* No preferences message */}
        {allSoloCount === 0 && allTogetherCount === 0 && (
          <div className="text-center py-16 bg-gray-800 rounded-lg mt-8">
            <p className="text-gray-400 mb-4">No watch preferences set yet</p>
            <p className="text-gray-500 text-sm">
              Go to show details and set "Solo" or "Together" preferences to see your analysis here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
