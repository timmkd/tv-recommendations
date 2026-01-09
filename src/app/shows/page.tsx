'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Show, ShowStatus } from '@/types';
import ShowEditModal from '@/components/ShowEditModal';
import RTScores from '@/components/RTScores';
import Tooltip from '@/components/Tooltip';

const STATUS_LABELS: Record<ShowStatus, { label: string; color: string }> = {
  watching: { label: 'Watching', color: 'bg-blue-600' },
  completed: { label: 'Completed', color: 'bg-green-600' },
  watchlist: { label: 'Watchlist', color: 'bg-yellow-600' },
  dropped: { label: 'Dropped', color: 'bg-gray-600' }
};

type SortOption = 'updated' | 'title' | 'title-desc' | 'year' | 'year-asc' | 'rating' | 'predicted' | 'rt-critics' | 'rt-audience';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'year', label: 'Year (Newest)' },
  { value: 'year-asc', label: 'Year (Oldest)' },
  { value: 'rating', label: 'Your Rating' },
  { value: 'predicted', label: 'Predicted Rating' },
  { value: 'rt-critics', label: 'RT Critics' },
  { value: 'rt-audience', label: 'RT Audience' },
];

function ShowsContent() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const unratedFilter = searchParams.get('unrated') === 'true';
  const streamingFilter = searchParams.get('streaming');
  const showHidden = searchParams.get('hidden') === 'true';
  const sortParam = (searchParams.get('sort') as SortOption) || 'updated';

  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [allServices, setAllServices] = useState<{slug: string; name: string; isSubscribed: boolean}[]>([]);
  const [editingShowId, setEditingShowId] = useState<string | null>(null);
  const [fetchingRT, setFetchingRT] = useState(false);
  const [rtProgress, setRtProgress] = useState<string | null>(null);
  const [fetchingPosters, setFetchingPosters] = useState(false);
  const [fetchingStreaming, setFetchingStreaming] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState<string | null>(null);

  const fetchShows = async () => {
    try {
      // Try Trakt API first, fall back to local shows
      let response = await fetch('/api/trakt/shows');
      if (!response.ok) {
        // Fall back to local shows if Trakt fails
        response = await fetch('/api/shows');
      }
      if (response.ok) {
        const data = await response.json();
        setShows(data);
      }
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setAllServices(data.streamingServices || []);
      }
    } catch {
      // Handle error silently
    }
  };

  // Auto-fetch RT scores for first few shows only (quick initial load)
  useEffect(() => {
    if (loading || fetchingRT || shows.length === 0) return;

    const showsNeedingRT = shows.filter(s =>
      (!s.rtCriticsScore && !s.rtAudienceScore) || isRTStale(s)
    );

    // Only auto-fetch first 5 shows for quick initial display
    if (showsNeedingRT.length > 0 && showsNeedingRT.length <= 5) {
      fetchRTScores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, shows.length]); // Trigger when shows are loaded

  // Apply filters
  let filtered = shows;
  // Hide hidden shows unless showHidden is true
  if (!showHidden) {
    filtered = filtered.filter(s => !s.hidden);
  }
  if (statusFilter) {
    filtered = filtered.filter(s => s.status === statusFilter);
  }
  if (unratedFilter) {
    filtered = filtered.filter(s => s.rating === undefined || s.rating === null);
  }
  if (streamingFilter) {
    filtered = filtered.filter(s => s.streamingServices?.includes(streamingFilter));
  }

  // Count hidden shows for the badge
  const hiddenCount = shows.filter(s => s.hidden).length;

  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortParam) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'year':
        return (b.year || 0) - (a.year || 0);
      case 'year-asc':
        return (a.year || 0) - (b.year || 0);
      case 'rating':
        // Shows with ratings first, then by rating value
        if (a.rating && !b.rating) return -1;
        if (!a.rating && b.rating) return 1;
        return (b.rating || 0) - (a.rating || 0);
      case 'predicted':
        // Shows with predicted ratings first, then by value
        const aScore = a.rating || a.predictedRating || 0;
        const bScore = b.rating || b.predictedRating || 0;
        return bScore - aScore;
      case 'rt-critics':
        if (a.rtCriticsScore && !b.rtCriticsScore) return -1;
        if (!a.rtCriticsScore && b.rtCriticsScore) return 1;
        return (b.rtCriticsScore || 0) - (a.rtCriticsScore || 0);
      case 'rt-audience':
        if (a.rtAudienceScore && !b.rtAudienceScore) return -1;
        if (!a.rtAudienceScore && b.rtAudienceScore) return 1;
        return (b.rtAudienceScore || 0) - (a.rtAudienceScore || 0);
      case 'updated':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  const handleShowSaved = (updatedShow: Show) => {
    setShows(prev => prev.map(s => s.id === updatedShow.id ? updatedShow : s));
  };

  const handleShowDeleted = () => {
    if (editingShowId) {
      setShows(prev => prev.filter(s => s.id !== editingShowId));
    }
  };

  // Check if RT data is stale (older than 30 days)
  const isRTStale = (show: Show) => {
    if (!show.rtFetchedAt) return true;
    const STALE_DAYS = 30;
    return (Date.now() - new Date(show.rtFetchedAt).getTime()) > STALE_DAYS * 24 * 60 * 60 * 1000;
  };

  const fetchRTScores = async () => {
    const showsNeedingRT = shows.filter(s =>
      (!s.rtCriticsScore && !s.rtAudienceScore) || isRTStale(s)
    );
    if (showsNeedingRT.length === 0) {
      setRtProgress('All RT scores are up to date');
      setTimeout(() => setRtProgress(null), 3000);
      return;
    }

    setFetchingRT(true);
    const BATCH_SIZE = 10;
    let totalUpdated = 0;

    // Process in batches
    for (let i = 0; i < showsNeedingRT.length; i += BATCH_SIZE) {
      const batch = showsNeedingRT.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(showsNeedingRT.length / BATCH_SIZE);

      setRtProgress(`Fetching RT scores... batch ${batchNum}/${totalBatches} (${totalUpdated} updated)`);

      try {
        const response = await fetch('/api/ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showIds: batch.map(s => s.id) })
        });

        if (response.ok) {
          const data = await response.json();
          totalUpdated += data.updated || 0;

          // Update local state with new scores
          if (data.results) {
            setShows(prev => prev.map(s => {
              const result = data.results[s.id];
              if (result && (result.criticsScore || result.audienceScore)) {
                return {
                  ...s,
                  rtCriticsScore: result.criticsScore,
                  rtAudienceScore: result.audienceScore
                };
              }
              return s;
            }));
          }
        }
      } catch {
        // Continue with next batch
      }
    }

    setRtProgress(`Done! Updated ${totalUpdated} shows with RT scores`);
    setFetchingRT(false);
    setTimeout(() => setRtProgress(null), 5000);
  };

  const showsNeedingRTCount = shows.filter(s =>
    (!s.rtCriticsScore && !s.rtAudienceScore) || isRTStale(s)
  ).length;

  const showsNeedingPosters = shows.filter(s => !s.posterPath);

  // Auto-fetch posters on page load (TMDB is fast, no rate limit issues)
  useEffect(() => {
    if (loading || fetchingPosters || shows.length === 0) return;

    const needPosters = shows.filter(s => !s.posterPath);
    if (needPosters.length > 0) {
      fetchPosters(needPosters.map(s => s.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, shows.length]);

  const fetchPosters = async (showIds: string[]) => {
    if (showIds.length === 0) return;

    setFetchingPosters(true);
    const BATCH_SIZE = 20; // TMDB is fast, can do larger batches

    for (let i = 0; i < showIds.length; i += BATCH_SIZE) {
      const batch = showIds.slice(i, i + BATCH_SIZE);

      try {
        const response = await fetch('/api/posters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showIds: batch })
        });

        if (response.ok) {
          const data = await response.json();

          // Update local state with new posters and tmdbId
          if (data.results) {
            setShows(prev => prev.map(s => {
              const result = data.results[s.id];
              if (result?.posterPath || result?.tmdbId) {
                return {
                  ...s,
                  posterPath: result.posterPath || s.posterPath,
                  tmdbId: result.tmdbId || s.tmdbId
                };
              }
              return s;
            }));
          }
        }
      } catch {
        // Continue with next batch
      }
    }

    setFetchingPosters(false);
  };

  // Check if streaming data is stale (older than 7 days)
  const isStreamingStale = (show: Show) => {
    if (!show.streamingFetchedAt) return true;
    const STALE_DAYS = 7;
    return (Date.now() - new Date(show.streamingFetchedAt).getTime()) > STALE_DAYS * 24 * 60 * 60 * 1000;
  };

  const showsNeedingStreaming = shows.filter(s => isStreamingStale(s)).length;

  const fetchStreaming = async () => {
    const showsToFetch = shows.filter(s => isStreamingStale(s));
    if (showsToFetch.length === 0) {
      setStreamingProgress('All streaming data is up to date');
      setTimeout(() => setStreamingProgress(null), 3000);
      return;
    }

    setFetchingStreaming(true);
    setStreamingProgress(`Fetching streaming for ${showsToFetch.length} shows...`);

    try {
      // Use new Trakt streaming API - handles batching internally
      const tmdbIds = showsToFetch.map(s => s.tmdbId).filter(Boolean);
      const response = await fetch('/api/trakt/streaming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbIds })
      });

      if (response.ok) {
        const data = await response.json();

        // Update local state with results
        if (data.results) {
          setShows(prev => prev.map(s => {
            const services = data.results[s.tmdbId];
            if (services) {
              return {
                ...s,
                streamingServices: services,
                streamingFetchedAt: new Date().toISOString()
              };
            }
            return s;
          }));
        }

        setStreamingProgress(`Done! Updated ${data.updated} shows with streaming data`);
      } else {
        setStreamingProgress('Failed to fetch streaming data');
      }
    } catch {
      setStreamingProgress('Error fetching streaming data');
    }

    setFetchingStreaming(false);
    setTimeout(() => setStreamingProgress(null), 5000);
  };

  // Helper to build filter URLs
  const buildFilterUrl = (params: { status?: string | null; unrated?: boolean; streaming?: string | null; hidden?: boolean; sort?: SortOption }) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.unrated) searchParams.set('unrated', 'true');
    if (params.streaming) searchParams.set('streaming', params.streaming);
    if (params.hidden) searchParams.set('hidden', 'true');
    if (params.sort && params.sort !== 'updated') searchParams.set('sort', params.sort);
    const query = searchParams.toString();
    return query ? `/shows?${query}` : '/shows';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div>
              <div className="h-9 w-40 bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-5 w-20 bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-28 bg-gray-700 rounded animate-pulse"></div>
          </header>

          {/* Skeleton filters */}
          <div className="flex gap-2 mb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 w-20 bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>

          {/* Skeleton grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="w-full aspect-[2/3] bg-gray-700 animate-pulse"></div>
                <div className="p-3">
                  <div className="h-4 w-3/4 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-1/4 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-5 w-1/3 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Shows</h1>
            <p className="text-gray-400">{filtered.length} shows</p>
          </div>
          <div className="flex items-center gap-3">
            {showsNeedingStreaming > 0 && (
              <button
                onClick={fetchStreaming}
                disabled={fetchingStreaming}
                className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                📺 {fetchingStreaming ? 'Fetching...' : `Streaming (${showsNeedingStreaming})`}
              </button>
            )}
            {showsNeedingRTCount > 0 && (
              <button
                onClick={fetchRTScores}
                disabled={fetchingRT}
                className="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                🍅 {fetchingRT ? 'Fetching...' : `Fetch RT (${showsNeedingRTCount})`}
              </button>
            )}
            <Link
              href="/add"
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium"
            >
              + Add Show
            </Link>
          </div>
        </header>

        {rtProgress && (
          <div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm">
            {rtProgress}
          </div>
        )}

        {streamingProgress && (
          <div className="mb-4 bg-gray-800 border border-purple-700 rounded-lg px-4 py-3 text-sm">
            {streamingProgress}
          </div>
        )}

        {/* Status Filter */}
        <div className="mb-4">
          <div className="flex gap-2 flex-wrap">
            <Link
              href={buildFilterUrl({ streaming: streamingFilter, hidden: showHidden, sort: sortParam })}
              className={`px-3 py-1 rounded text-sm ${
                !statusFilter && !unratedFilter ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              All
            </Link>
            {(Object.keys(STATUS_LABELS) as ShowStatus[]).map(status => (
              <Link
                key={status}
                href={buildFilterUrl({ status, unrated: unratedFilter, streaming: streamingFilter, hidden: showHidden, sort: sortParam })}
                className={`px-3 py-1 rounded text-sm ${
                  statusFilter === status ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {STATUS_LABELS[status].label}
              </Link>
            ))}
            <span className="border-l border-gray-600 mx-1"></span>
            <Link
              href={buildFilterUrl({ status: statusFilter, unrated: !unratedFilter, streaming: streamingFilter, hidden: showHidden, sort: sortParam })}
              className={`px-3 py-1 rounded text-sm ${
                unratedFilter ? 'bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Unrated
            </Link>
            {hiddenCount > 0 && (
              <Link
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilter, hidden: !showHidden, sort: sortParam })}
                className={`px-3 py-1 rounded text-sm ${
                  showHidden ? 'bg-orange-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Hidden ({hiddenCount})
              </Link>
            )}
          </div>
        </div>

        {/* Streaming Filter */}
        {allServices.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-sm text-gray-400 mr-1">Streaming:</span>
              <Link
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, hidden: showHidden, sort: sortParam })}
                className={`px-3 py-1 rounded text-sm ${
                  !streamingFilter ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                All
              </Link>
              {allServices.map(service => (
                <Link
                  key={service.slug}
                  href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilter === service.slug ? null : service.slug, hidden: showHidden, sort: sortParam })}
                  className={`px-3 py-1 rounded text-sm ${
                    streamingFilter === service.slug
                      ? 'bg-purple-600'
                      : service.isSubscribed
                        ? 'bg-gray-600 hover:bg-gray-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {service.name}{service.isSubscribed ? ' *' : ''}
                </Link>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">* = subscribed</p>
          </div>
        )}

        {/* Sort Options */}
        <div className="mb-8">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-gray-400 mr-1">Sort:</span>
            {SORT_OPTIONS.map(option => (
              <Link
                key={option.value}
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilter, hidden: showHidden, sort: option.value })}
                className={`px-3 py-1 rounded text-sm ${
                  sortParam === option.value ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Shows Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(show => (
              <div
                key={show.id}
                onClick={() => setEditingShowId(show.id)}
                className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all group cursor-pointer"
              >
                {show.posterPath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w342${show.posterPath}`}
                    alt={show.title}
                    className="w-full aspect-[2/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center">
                    <span className="text-gray-500 text-xs text-center px-2">{show.title}</span>
                  </div>
                )}
                <div className="p-3">
                  <div className="text-sm font-medium truncate group-hover:text-blue-400">
                    {show.title}
                  </div>
                  <div className="text-xs text-gray-400 mb-1">{show.year}</div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_LABELS[show.status].color}`}>
                      {STATUS_LABELS[show.status].label}
                    </span>
                    <RTScores
                      showId={show.id}
                      title={show.title}
                      criticsScore={show.rtCriticsScore}
                      audienceScore={show.rtAudienceScore}
                      size="sm"
                    />
                  </div>

                  {/* Ratings row - user rating or predicted */}
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    {show.rating ? (
                      <Tooltip content="Your rating">
                        <span className="text-yellow-400">{show.rating}★</span>
                      </Tooltip>
                    ) : show.predictedRating ? (
                      <Tooltip content={`Predicted: ${show.predictedRating}/5${show.predictedRatingReason ? '\n' + show.predictedRatingReason : ''}`}>
                        <span className="text-yellow-600/70 cursor-help">
                          ~{show.predictedRating}★
                        </span>
                      </Tooltip>
                    ) : null}

                    {/* Watch preference - actual or recommended */}
                    {show.watchPreference ? (
                      <Tooltip content={show.watchPreferenceNote ? `Your preference: ${show.watchPreference}\n${show.watchPreferenceNote}` : `Your preference: ${show.watchPreference}`}>
                        <span className={`px-1 rounded ${show.watchPreference === 'solo' ? 'bg-blue-900/50 text-blue-300' : 'bg-pink-900/50 text-pink-300'} ${show.watchPreferenceNote ? 'cursor-help' : ''}`}>
                          {show.watchPreference === 'solo' ? 'Solo' : 'Together'}
                        </span>
                      </Tooltip>
                    ) : show.recommendedWatchPreference ? (
                      <Tooltip content={`Recommended: ${show.recommendedWatchPreference === 'solo' ? 'Solo' : 'Together'}\nBased on similar shows you've rated`}>
                        <span className={`px-1 rounded cursor-help opacity-60 ${show.recommendedWatchPreference === 'solo' ? 'bg-blue-900/30 text-blue-400' : 'bg-pink-900/30 text-pink-400'}`}>
                          {show.recommendedWatchPreference === 'solo' ? 'Solo?' : 'Together?'}
                        </span>
                      </Tooltip>
                    ) : null}
                  </div>

                  {/* Streaming services */}
                  {show.streamingServices && show.streamingServices.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {show.streamingServices.slice(0, 4).map(service => (
                        <Tooltip key={service} content={service}>
                          <span className="px-1.5 py-0.5 bg-gray-700/80 rounded text-[10px] text-gray-300">
                            {service === 'netflix' ? 'NF' :
                             service === 'stan' ? 'Stan' :
                             service === 'disney-plus' ? 'D+' :
                             service === 'amazon-prime-video' ? 'Prime' :
                             service === 'apple-tv-plus' ? 'ATV+' :
                             service === 'paramount-plus' ? 'P+' :
                             service === 'binge' ? 'Binge' :
                             service === 'foxtel-now' ? 'Fox' :
                             service === 'max' ? 'Max' :
                             service === 'britbox' ? 'Brit' :
                             service === 'abc-iview' ? 'ABC' :
                             service === 'sbs-on-demand' ? 'SBS' :
                             service.slice(0, 4)}
                          </span>
                        </Tooltip>
                      ))}
                      {show.streamingServices.length > 4 && (
                        <span className="text-[10px] text-gray-500">+{show.streamingServices.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 rounded-lg">
            <p className="text-gray-400 mb-4">No shows found</p>
            <Link
              href="/add"
              className="inline-block bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-medium"
            >
              Add a Show
            </Link>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingShowId && (
        <ShowEditModal
          showId={editingShowId}
          isOpen={!!editingShowId}
          onClose={() => setEditingShowId(null)}
          onSaved={handleShowSaved}
          onDeleted={handleShowDeleted}
        />
      )}
    </div>
  );
}

export default function ShowsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <ShowsContent />
    </Suspense>
  );
}
