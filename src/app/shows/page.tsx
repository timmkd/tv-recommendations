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
  watchlist: { label: 'Watchlist', color: 'bg-yellow-600' }
};

// Streaming service brand colors and TMDB logo paths
const STREAMING_BRANDS: Record<string, { bg: string; activeBg: string; logo: string }> = {
  'netflix': { bg: 'bg-red-900/60', activeBg: 'bg-red-600', logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  'stan': { bg: 'bg-blue-900/60', activeBg: 'bg-blue-500', logo: '/sSfxJXq7s8oHf3XWd0FtqagPDsF.jpg' },
  'binge': { bg: 'bg-orange-900/60', activeBg: 'bg-orange-500', logo: '/7QX5OdsQZrXGNBKq9SPzoPV9OYQ.jpg' },
  'disney-plus': { bg: 'bg-blue-900/60', activeBg: 'bg-blue-600', logo: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
  'prime-video': { bg: 'bg-cyan-900/60', activeBg: 'bg-cyan-600', logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  'paramount-plus': { bg: 'bg-blue-900/60', activeBg: 'bg-blue-700', logo: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  'apple-tv-plus': { bg: 'bg-gray-800', activeBg: 'bg-gray-600', logo: '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg' },
  'max': { bg: 'bg-indigo-900/60', activeBg: 'bg-indigo-600', logo: '/jbe4gVSfRlbPTdESXhEKpornsfu.jpg' },
  'britbox': { bg: 'bg-red-900/60', activeBg: 'bg-red-700', logo: '/aGIS8maihUm60A3moKYD9gfYHYT.jpg' },
  'abc-iview': { bg: 'bg-green-900/60', activeBg: 'bg-green-600', logo: '/zR1TJmEwssf0ZThB2iByNtZi2Oo.jpg' },
  'sbs-on-demand': { bg: 'bg-red-900/60', activeBg: 'bg-red-600', logo: '/cR4okiAS0zcXb4ufs3mi4PImXPB.jpg' },
  'ten-play': { bg: 'bg-blue-900/60', activeBg: 'bg-blue-500', logo: '/8fIieu3ZfmTPu8eozZbtgATcPO5.jpg' },
  'amc-plus': { bg: 'bg-blue-900/60', activeBg: 'bg-blue-600', logo: '/ovmu6uot1XVvsemM2dDySXLiX57.jpg' },
};

type SortOption = 'updated' | 'added' | 'title' | 'title-desc' | 'year' | 'year-asc' | 'rating' | 'predicted' | 'rt-critics' | 'rt-audience';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'added', label: 'Recently Added' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'year', label: 'Year (Newest)' },
  { value: 'year-asc', label: 'Year (Oldest)' },
  { value: 'rating', label: 'Your Rating' },
  { value: 'predicted', label: 'Predicted Rating' },
  { value: 'rt-critics', label: '🍅 Tomatometer' },
  { value: 'rt-audience', label: '🍿 Popcornmeter' },
];

function ShowsContent() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const unratedFilter = searchParams.get('unrated') === 'true';
  const unpredictedFilter = searchParams.get('unpredicted') === 'true';
  const streamingFilterParam = searchParams.get('streaming');
  const streamingFilters = streamingFilterParam ? streamingFilterParam.split(',') : [];
  const watchPrefFilter = searchParams.get('watchpref') as 'solo' | 'together' | null;
  const showHidden = searchParams.get('hidden') === 'true';
  const showDropped = searchParams.get('dropped') === 'true';
  const showRemoved = searchParams.get('removed') === 'true';
  const sortParam = (searchParams.get('sort') as SortOption) || 'updated';

  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [allServices, setAllServices] = useState<{slug: string; name: string; isSubscribed: boolean}[]>([]);
  const [editingShowId, setEditingShowId] = useState<string | null>(null);
  const [fetchingRT, setFetchingRT] = useState(false);
  const [rtProgress, setRtProgress] = useState<string | null>(null);
  const [fetchingPosters, setFetchingPosters] = useState(false);
  const [posterProgress, setPosterProgress] = useState<string | null>(null);
  const [fetchingStreaming, setFetchingStreaming] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState<string | null>(null);
  const [refreshingTrakt, setRefreshingTrakt] = useState(false);
  const [traktStatus, setTraktStatus] = useState<string | null>(null);
  const [syncingTrakt, setSyncingTrakt] = useState(false);
  const [syncingProgress, setSyncingProgress] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load shows - first from cache (fast), then sync Trakt in background
  const fetchShows = async () => {
    try {
      // Step 1: Load cached data immediately (fast)
      const cacheResponse = await fetch('/api/trakt/shows?fallback=true');
      if (cacheResponse.ok) {
        const cachedData = await cacheResponse.json();
        setShows(cachedData);
        setLoading(false); // Show UI immediately with cached data

        // Step 2: Sync from Trakt in background
        setSyncingTrakt(true);
        try {
          const traktResponse = await fetch('/api/trakt/shows');
          if (traktResponse.ok) {
            const traktData = await traktResponse.json();
            if (traktData.length > 0) {
              // Merge with existing state to preserve any local updates
              setShows(prev => {
                const prevMap = new Map(prev.map(s => [s.tmdbId, s]));
                return traktData.map((show: Show) => {
                  const existing = prevMap.get(show.tmdbId);
                  if (existing) {
                    // Prefer local data if it exists and server doesn't have it
                    return {
                      ...show,
                      rtCriticsScore: show.rtCriticsScore ?? existing.rtCriticsScore,
                      rtAudienceScore: show.rtAudienceScore ?? existing.rtAudienceScore,
                      rtFetchedAt: show.rtFetchedAt ?? existing.rtFetchedAt,
                      streamingServices: show.streamingServices?.length ? show.streamingServices : existing.streamingServices,
                      streamingFetchedAt: show.streamingFetchedAt ?? existing.streamingFetchedAt,
                      posterPath: show.posterPath ?? existing.posterPath,
                    };
                  }
                  return show;
                });
              });
            }
          }
        } catch (err) {
          setTraktStatus('Trakt sync failed - showing cached data');
          setTimeout(() => setTraktStatus(null), 5000);
        } finally {
          setSyncingTrakt(false);
        }
      } else {
        // Cache failed, try Trakt directly
        const response = await fetch('/api/trakt/shows');
        if (response.ok) {
          const data = await response.json();
          setShows(data);
        }
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const refreshFromTrakt = async () => {
    setRefreshingTrakt(true);
    setTraktStatus('Refreshing from Trakt...');
    try {
      // Force fresh fetch from Trakt (no fallback)
      const response = await fetch('/api/trakt/shows');
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          // Merge with existing state to preserve local updates
          setShows(prev => {
            const prevMap = new Map(prev.map(s => [s.tmdbId, s]));
            return data.map((show: Show) => {
              const existing = prevMap.get(show.tmdbId);
              if (existing) {
                return {
                  ...show,
                  rtCriticsScore: show.rtCriticsScore ?? existing.rtCriticsScore,
                  rtAudienceScore: show.rtAudienceScore ?? existing.rtAudienceScore,
                  rtFetchedAt: show.rtFetchedAt ?? existing.rtFetchedAt,
                  streamingServices: show.streamingServices?.length ? show.streamingServices : existing.streamingServices,
                  streamingFetchedAt: show.streamingFetchedAt ?? existing.streamingFetchedAt,
                  posterPath: show.posterPath ?? existing.posterPath,
                };
              }
              return show;
            });
          });
          setTraktStatus(`Synced ${data.length} shows from Trakt`);
          setTimeout(() => setTraktStatus(null), 3000);
        } else {
          setTraktStatus('Trakt returned no data - may be rate limited');
        }
      } else {
        setTraktStatus('Failed to fetch from Trakt - may be rate limited');
      }
    } catch {
      setTraktStatus('Error connecting to Trakt');
    } finally {
      setRefreshingTrakt(false);
    }
  };

  // Sync progress from Trakt (batched operation - updates watching/completed status)
  const syncProgress = async () => {
    setSyncingProgress(true);
    setProgressStatus('Syncing progress...');

    let totalSynced = 0;
    let iterations = 0;
    const maxIterations = 20; // Safety limit

    try {
      // Keep syncing in batches until no more remaining
      while (iterations < maxIterations) {
        iterations++;
        const response = await fetch('/api/trakt/sync/progress', { method: 'POST' });

        if (!response.ok) {
          setProgressStatus('Failed to sync progress - check console');
          break;
        }

        const data = await response.json();

        if (!data.success) {
          setProgressStatus(data.message || 'Failed to sync progress');
          break;
        }

        totalSynced += data.updated || 0;
        setProgressStatus(`Syncing... ${totalSynced} updated, ${data.remaining || 0} remaining`);

        // Stop if no more remaining
        if (!data.remaining || data.remaining === 0) {
          setProgressStatus(`✓ Done! ${data.stats.watching} watching, ${data.stats.completed} completed, ${data.stats.watchlist} watchlist`);
          // Refresh shows to get updated statuses
          await fetchShows();
          break;
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (iterations >= maxIterations) {
        setProgressStatus(`Stopped after ${maxIterations} batches. ${totalSynced} updated.`);
        await fetchShows();
      }
    } catch {
      setProgressStatus('Error syncing progress');
    } finally {
      setSyncingProgress(false);
      setTimeout(() => setProgressStatus(null), 8000);
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
  // Dropped filter: OFF = hide dropped, ON = show ONLY dropped
  if (showDropped) {
    filtered = filtered.filter(s => s.dropped);
  } else {
    filtered = filtered.filter(s => !s.dropped);
  }
  // Hidden filter: OFF = hide hidden, ON = show ONLY hidden
  if (showHidden) {
    filtered = filtered.filter(s => s.hidden);
  } else {
    filtered = filtered.filter(s => !s.hidden);
  }
  // Removed filter: OFF = hide removed (no status), ON = show ONLY removed
  if (showRemoved) {
    filtered = filtered.filter(s => !s.status);
  } else {
    filtered = filtered.filter(s => !!s.status);
  }
  if (statusFilter) {
    filtered = filtered.filter(s => s.status === statusFilter);
  }
  if (unratedFilter) {
    filtered = filtered.filter(s => s.rating === undefined || s.rating === null);
  }
  if (unpredictedFilter) {
    // Shows that need predictions: no predicted rating AND no user rating (rated items don't need predictions)
    filtered = filtered.filter(s => (s.predictedRating === undefined || s.predictedRating === null) && (s.rating === undefined || s.rating === null));
  }
  if (streamingFilters.length > 0) {
    // Special case: "none" means shows with no streaming service
    if (streamingFilters.includes('none')) {
      filtered = filtered.filter(s => !s.streamingServices || s.streamingServices.length === 0);
    } else {
      filtered = filtered.filter(s => s.streamingServices?.some(service => streamingFilters.includes(service)));
    }
  }
  if (watchPrefFilter) {
    // Filter by actual preference or recommended preference
    filtered = filtered.filter(s =>
      s.watchPreference === watchPrefFilter ||
      (!s.watchPreference && s.recommendedWatchPreference === watchPrefFilter)
    );
  }
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(s => s.title.toLowerCase().includes(query));
  }

  // Count hidden and dropped shows for the badges
  const hiddenCount = shows.filter(s => s.hidden).length;
  const droppedCount = shows.filter(s => s.dropped).length;
  const removedCount = shows.filter(s => !s.status).length;

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
      case 'added':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
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
          body: JSON.stringify({
            shows: batch.map(s => ({
              tmdbId: s.tmdbId,
              title: s.title,
              year: s.year
            }))
          })
        });

        if (response.ok) {
          const data = await response.json();
          totalUpdated += data.updated || 0;

          // Update local state with new scores (keyed by tmdbId)
          if (data.results) {
            setShows(prev => prev.map(s => {
              const result = data.results[s.tmdbId];
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

  const showsNeedingPostersCount = shows.filter(s => !s.posterPath).length;

  const fetchMissingPosters = async () => {
    const needPosters = shows.filter(s => !s.posterPath);
    if (needPosters.length === 0) {
      setPosterProgress('All posters are up to date');
      setTimeout(() => setPosterProgress(null), 3000);
      return;
    }

    setFetchingPosters(true);
    setPosterProgress(`Fetching posters for ${needPosters.length} shows...`);

    try {
      // Use enrichment API which fetches posters + metadata
      const tmdbIds = needPosters.map(s => s.tmdbId).filter(Boolean);
      const response = await fetch('/api/trakt/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbIds })
      });

      if (response.ok) {
        const data = await response.json();

        // Update local state with new posters
        if (data.results) {
          setShows(prev => prev.map(s => {
            const result = data.results[s.tmdbId];
            if (result?.posterPath) {
              return {
                ...s,
                posterPath: result.posterPath,
                genres: result.genres || s.genres
              };
            }
            return s;
          }));
        }

        setPosterProgress(`Done! Updated ${data.updated} shows with posters`);
      } else {
        setPosterProgress('Failed to fetch posters');
      }
    } catch {
      setPosterProgress('Error fetching posters');
    }

    setFetchingPosters(false);
    setTimeout(() => setPosterProgress(null), 5000);
  };

  // Check if streaming data is stale (older than 7 days)
  const isStreamingStale = (show: Show) => {
    if (!show.streamingFetchedAt) return true;
    const STALE_DAYS = 7;
    return (Date.now() - new Date(show.streamingFetchedAt).getTime()) > STALE_DAYS * 24 * 60 * 60 * 1000;
  };

  const showsNeedingStreaming = shows.filter(s => isStreamingStale(s)).length;

  // View mode (grid or list)
  const viewParam = searchParams.get('view') || 'grid';

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
  const buildFilterUrl = (params: { status?: string | null; unrated?: boolean; unpredicted?: boolean; streaming?: string[] | null; watchpref?: 'solo' | 'together' | null; hidden?: boolean; dropped?: boolean; removed?: boolean; sort?: SortOption; view?: 'grid' | 'list' }) => {
    const urlParams = new URLSearchParams();
    if (params.status) urlParams.set('status', params.status);
    if (params.unrated) urlParams.set('unrated', 'true');
    if (params.unpredicted) urlParams.set('unpredicted', 'true');
    if (params.streaming && params.streaming.length > 0) urlParams.set('streaming', params.streaming.join(','));
    if (params.watchpref) urlParams.set('watchpref', params.watchpref);
    if (params.hidden) urlParams.set('hidden', 'true');
    if (params.dropped) urlParams.set('dropped', 'true');
    if (params.removed) urlParams.set('removed', 'true');
    if (params.sort && params.sort !== 'updated') urlParams.set('sort', params.sort);
    if (params.view && params.view !== 'grid') urlParams.set('view', params.view);
    const query = urlParams.toString();
    return query ? `/shows?${query}` : '/shows';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-3 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-center mb-4 sm:mb-8">
            <div>
              <div className="h-7 sm:h-9 w-28 sm:w-40 bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-4 sm:h-5 w-16 sm:w-20 bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="h-8 sm:h-10 w-8 sm:w-28 bg-gray-700 rounded animate-pulse"></div>
          </header>

          {/* Skeleton filters */}
          <div className="flex gap-1.5 sm:gap-2 mb-4 overflow-x-auto pb-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 sm:h-8 w-14 sm:w-20 bg-gray-700 rounded animate-pulse flex-shrink-0"></div>
            ))}
          </div>

          {/* Skeleton grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="w-full aspect-[2/3] bg-gray-700 animate-pulse"></div>
                <div className="p-2 sm:p-3">
                  <div className="h-3 sm:h-4 w-3/4 bg-gray-700 rounded animate-pulse mb-1.5 sm:mb-2"></div>
                  <div className="h-2.5 sm:h-3 w-1/4 bg-gray-700 rounded animate-pulse mb-1.5 sm:mb-2"></div>
                  <div className="h-4 sm:h-5 w-1/3 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 sm:p-8">
      {/* Background sync indicator */}
      {syncingTrakt && (
        <div className="fixed top-14 sm:top-4 right-2 sm:right-4 bg-gray-800 border border-gray-700 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-2 shadow-lg z-50">
          <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs sm:text-sm text-gray-300">Syncing...</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Mobile-optimized header */}
        <header className="mb-4 sm:mb-8">
          <div className="flex justify-between items-center mb-2 sm:mb-0">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold">My Shows</h1>
              <p className="text-xs sm:text-base text-gray-400">{filtered.length} shows</p>
            </div>
            {/* Desktop action buttons */}
            <div className="hidden sm:flex items-center gap-3">
              {showsNeedingPostersCount > 0 && (
                <button
                  onClick={fetchMissingPosters}
                  disabled={fetchingPosters}
                  className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  🖼️ {fetchingPosters ? 'Fetching...' : `Posters (${showsNeedingPostersCount})`}
                </button>
              )}
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
              <button
                onClick={refreshFromTrakt}
                disabled={refreshingTrakt}
                className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                title="Refresh shows and watch progress from Trakt"
              >
                🔄 {refreshingTrakt ? 'Syncing...' : 'Sync Trakt'}
              </button>
              <button
                onClick={syncProgress}
                disabled={syncingProgress}
                className="bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                title="Sync watching/completed status from Trakt (slow)"
              >
                📊 {syncingProgress ? 'Syncing...' : 'Sync Progress'}
              </button>
              <Link
                href="/add"
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium"
              >
                + Add Show
              </Link>
            </div>
            {/* Mobile action buttons - compact */}
            <div className="flex sm:hidden items-center gap-1.5">
              {showsNeedingStreaming > 0 && (
                <button
                  onClick={fetchStreaming}
                  disabled={fetchingStreaming}
                  className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 px-2 py-1.5 rounded text-xs font-medium"
                  title="Fetch streaming"
                >
                  📺 {showsNeedingStreaming}
                </button>
              )}
              {showsNeedingRTCount > 0 && (
                <button
                  onClick={fetchRTScores}
                  disabled={fetchingRT}
                  className="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 px-2 py-1.5 rounded text-xs font-medium"
                  title="Fetch RT scores"
                >
                  🍅 {showsNeedingRTCount}
                </button>
              )}
              <button
                onClick={refreshFromTrakt}
                disabled={refreshingTrakt}
                className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 px-2 py-1.5 rounded text-xs font-medium"
                title="Sync Trakt"
              >
                🔄
              </button>
              <button
                onClick={syncProgress}
                disabled={syncingProgress}
                className="bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 px-2 py-1.5 rounded text-xs font-medium"
                title="Sync watching/completed status"
              >
                📊
              </button>
              <Link
                href="/add"
                className="bg-blue-600 hover:bg-blue-500 px-2 py-1.5 rounded text-xs font-medium"
              >
                +
              </Link>
            </div>
          </div>
        </header>

        {traktStatus && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            traktStatus.includes('rate limited') || traktStatus.includes('Failed') || traktStatus.includes('Error')
              ? 'bg-yellow-900/50 border border-yellow-700 text-yellow-200'
              : traktStatus.includes('Synced')
              ? 'bg-green-900/50 border border-green-700 text-green-200'
              : 'bg-gray-800 border border-gray-700'
          }`}>
            {traktStatus}
          </div>
        )}

        {posterProgress && (
          <div className="mb-4 bg-gray-800 border border-cyan-700 rounded-lg px-4 py-3 text-sm">
            {posterProgress}
          </div>
        )}

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

        {progressStatus && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            progressStatus.includes('✓')
              ? 'bg-green-900/50 border border-green-700 text-green-200'
              : progressStatus.includes('Error') || progressStatus.includes('Failed')
              ? 'bg-red-900/50 border border-red-700 text-red-200'
              : 'bg-yellow-900/50 border border-yellow-700 text-yellow-200'
          }`}>
            {progressStatus}
          </div>
        )}

        {/* Filter Bar - Row 1: Search + Status + Special Filters */}
        <div className="mb-2 sm:mb-3 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-28 sm:w-48 bg-gray-800 border border-gray-700 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 pl-7 sm:pl-8 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <svg
                className="absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <span className="border-l border-gray-600 h-5 sm:h-6 hidden sm:block"></span>

            {/* Status Filters */}
            <Link
              href={buildFilterUrl({ unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${
                !statusFilter && !unratedFilter && !unpredictedFilter ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              All
            </Link>
            {(Object.keys(STATUS_LABELS) as ShowStatus[]).map(status => (
              <Link
                key={status}
                href={buildFilterUrl({ status, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                className={`px-2 sm:px-2.5 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${
                  statusFilter === status ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {STATUS_LABELS[status].label}
              </Link>
            ))}

            <span className="border-l border-gray-600 h-5 sm:h-6"></span>

            {/* Special Filters */}
            <Link
              href={buildFilterUrl({ status: statusFilter, unrated: !unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${
                unratedFilter ? 'bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Unrated
            </Link>
            <Link
              href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: !unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${
                unpredictedFilter ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Unpredicted
            </Link>
            {hiddenCount > 0 && (
              <Link
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: !showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                className={`px-2 sm:px-2.5 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${
                  showHidden ? 'bg-orange-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Hidden ({hiddenCount})
              </Link>
            )}
            {droppedCount > 0 && (
              <Link
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: !showDropped, removed: showRemoved, sort: sortParam })}
                className={`px-2 sm:px-2.5 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${
                  showDropped ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Dropped ({droppedCount})
              </Link>
            )}
            {removedCount > 0 && (
              <Link
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: !showRemoved, sort: sortParam })}
                className={`px-2 sm:px-2.5 py-1 rounded text-xs sm:text-sm whitespace-nowrap ${
                  showRemoved ? 'bg-amber-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Removed ({removedCount})
              </Link>
            )}

            {/* Clear all filters button */}
            {(statusFilter || unratedFilter || unpredictedFilter || streamingFilters.length > 0 || watchPrefFilter || showHidden || showDropped || showRemoved || sortParam !== 'updated' || searchQuery) && (
              <Link
                href="/shows"
                onClick={() => setSearchQuery('')}
                className="px-2 sm:px-2.5 py-1 rounded text-xs sm:text-sm bg-red-900/50 hover:bg-red-800 text-red-300 border border-red-700/50 whitespace-nowrap"
              >
                ✕ Clear
              </Link>
            )}
          </div>
        </div>

        {/* Filter Bar - Row 2: Streaming | Watch Pref | Sort | View */}
        <div className="mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-max">
            {/* Streaming Services - hidden on mobile, show only subscribed */}
            {allServices.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5">
                <Link
                  href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                  className={`px-2 py-1 rounded text-xs ${
                    streamingFilters.length === 0 ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  All
                </Link>
                <Link
                  href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters.includes('none') ? null : ['none'], watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                  className={`px-2 py-1 rounded text-xs ${
                    streamingFilters.includes('none') ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title="Shows with no streaming service"
                >
                  No Platform
                </Link>
                {allServices.map(service => {
                  const brand = STREAMING_BRANDS[service.slug];
                  const isActive = streamingFilters.includes(service.slug);
                  const newFilters = isActive
                    ? streamingFilters.filter(s => s !== service.slug)
                    : [...streamingFilters, service.slug];
                  return (
                    <Link
                      key={service.slug}
                      href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: newFilters.length > 0 ? newFilters : null, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                      className={`px-1.5 py-1 rounded-md flex items-center transition-all ${
                        isActive
                          ? 'ring-2 ring-white bg-gray-700'
                          : service.isSubscribed
                            ? 'bg-gray-800 hover:bg-gray-700'
                            : 'bg-gray-800/50 hover:bg-gray-700 opacity-50'
                      }`}
                    >
                      {brand?.logo ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${brand.logo}`}
                          alt={service.name}
                          className="h-6 w-auto rounded"
                        />
                      ) : (
                        <span className="text-xs">{service.name}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Mobile streaming - compact, show all services */}
            {allServices.length > 0 && (
              <div className="flex sm:hidden items-center gap-1">
                <Link
                  href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters.includes('none') ? null : ['none'], watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    streamingFilters.includes('none') ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title="No platform"
                >
                  ∅
                </Link>
                {allServices.map(service => {
                  const brand = STREAMING_BRANDS[service.slug];
                  const isActive = streamingFilters.includes(service.slug);
                  const newFilters = isActive
                    ? streamingFilters.filter(s => s !== service.slug)
                    : [...streamingFilters, service.slug];
                  return (
                    <Link
                      key={service.slug}
                      href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: newFilters.length > 0 ? newFilters : null, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                      className={`p-0.5 rounded-md flex items-center transition-all ${
                        isActive
                          ? 'ring-2 ring-white'
                          : service.isSubscribed
                            ? ''
                            : 'opacity-50'
                      }`}
                    >
                      {brand?.logo && (
                        <img
                          src={`https://image.tmdb.org/t/p/w45${brand.logo}`}
                          alt={service.name}
                          className="h-5 w-auto rounded"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            <span className="border-l border-gray-600 h-5"></span>

            {/* Watch Preference */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">Watch:</span>
              <Link
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: null, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                className={`px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-xs ${
                  !watchPrefFilter ? 'bg-teal-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                All
              </Link>
              <Link
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter === 'solo' ? null : 'solo', hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                className={`px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-xs ${
                  watchPrefFilter === 'solo' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Solo
              </Link>
              <Link
                href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter === 'together' ? null : 'together', hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam })}
                className={`px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-xs ${
                  watchPrefFilter === 'together' ? 'bg-pink-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Together
              </Link>
            </div>

            {/* Sort + View Toggle - pushed to right */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              <select
                value={sortParam}
                onChange={(e) => {
                  const url = buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: e.target.value as SortOption, view: viewParam as 'grid' | 'list' });
                  window.location.href = url;
                }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-800 rounded-lg p-0.5">
                <Link
                  href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam, view: 'grid' })}
                  className={`p-1 sm:p-1.5 rounded transition-colors ${
                    viewParam === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title="Grid view"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </Link>
                <Link
                  href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, unpredicted: unpredictedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam, view: 'list' })}
                  className={`p-1 sm:p-1.5 rounded transition-colors ${
                    viewParam === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title="List view"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Shows Display */}
        {filtered.length > 0 ? (
          viewParam === 'list' ? (
            /* List View */
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-12"></th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      <Link
                        href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam === 'title' ? 'title-desc' : 'title', view: 'list' })}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        Title
                        {(sortParam === 'title' || sortParam === 'title-desc') && (
                          <span>{sortParam === 'title' ? '↑' : '↓'}</span>
                        )}
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                      <Link
                        href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: sortParam === 'year' ? 'year-asc' : 'year', view: 'list' })}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        Year
                        {(sortParam === 'year' || sortParam === 'year-asc') && (
                          <span>{sortParam === 'year' ? '↓' : '↑'}</span>
                        )}
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      <Link
                        href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: 'rating', view: 'list' })}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        Rating
                        {sortParam === 'rating' && <span>↓</span>}
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      <Link
                        href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: 'predicted', view: 'list' })}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        Predicted
                        {sortParam === 'predicted' && <span>↓</span>}
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      <Link
                        href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: 'rt-critics', view: 'list' })}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        🍅
                        {sortParam === 'rt-critics' && <span>↓</span>}
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      <Link
                        href={buildFilterUrl({ status: statusFilter, unrated: unratedFilter, streaming: streamingFilters, watchpref: watchPrefFilter, hidden: showHidden, dropped: showDropped, removed: showRemoved, sort: 'rt-audience', view: 'list' })}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        🍿
                        {sortParam === 'rt-audience' && <span>↓</span>}
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Streaming</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Watch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filtered.map(show => {
                    const watchPref = show.watchPreference || show.recommendedWatchPreference;
                    return (
                      <tr
                        key={show.id}
                        onClick={() => setEditingShowId(show.id)}
                        className="hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        {/* Poster thumbnail */}
                        <td className="px-2 py-2">
                          {show.posterPath ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${show.posterPath}`}
                              alt=""
                              className="w-10 h-15 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-15 bg-gray-700 rounded"></div>
                          )}
                        </td>
                        {/* Title */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white hover:text-blue-400">{show.title}</span>
                            {show.numberOfSeasons && (
                              <span className="text-xs text-gray-500">{show.numberOfSeasons}S</span>
                            )}
                          </div>
                          {show.predictedRatingReason && (
                            <div className="text-xs text-gray-500 truncate max-w-xs hidden sm:block" title={show.predictedRatingReason}>
                              {show.predictedRatingReason.length > 60
                                ? show.predictedRatingReason.slice(0, 60) + '...'
                                : show.predictedRatingReason}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 sm:hidden">{show.year}</div>
                        </td>
                        {/* Year */}
                        <td className="px-3 py-2 text-gray-400 text-sm hidden sm:table-cell">{show.year}</td>
                        {/* Status */}
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${show.status ? STATUS_LABELS[show.status].color : 'bg-gray-600'}`}>
                            {show.status ? STATUS_LABELS[show.status].label : 'Removed'}
                          </span>
                        </td>
                        {/* Rating */}
                        <td className="px-3 py-2">
                          {show.rating ? (
                            <span className="text-yellow-400 font-medium">{show.rating}★</span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        {/* Predicted */}
                        <td className="px-3 py-2 hidden md:table-cell">
                          {show.predictedRating ? (
                            <Tooltip content={show.predictedRatingReason || 'AI prediction'}>
                              <span className="text-purple-400 cursor-help">{show.predictedRating}★</span>
                            </Tooltip>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        {/* RT Critics */}
                        <td className="px-3 py-2 hidden lg:table-cell">
                          {show.rtCriticsScore ? (
                            <span className={show.rtCriticsScore >= 60 ? 'text-red-400' : 'text-green-400'}>{show.rtCriticsScore}%</span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        {/* RT Audience */}
                        <td className="px-3 py-2 hidden lg:table-cell">
                          {show.rtAudienceScore ? (
                            <span className="text-yellow-400">{show.rtAudienceScore}%</span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        {/* Streaming */}
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <div className="flex gap-1">
                            {show.streamingServices?.slice(0, 3).map(service => {
                              const brand = STREAMING_BRANDS[service];
                              if (brand?.logo) {
                                return (
                                  <Tooltip key={service} content={service}>
                                    <img
                                      src={`https://image.tmdb.org/t/p/w45${brand.logo}`}
                                      alt={service}
                                      className="h-5 w-5 rounded object-cover"
                                    />
                                  </Tooltip>
                                );
                              }
                              return null;
                            })}
                            {(show.streamingServices?.length || 0) > 3 && (
                              <span className="text-xs text-gray-500">+{show.streamingServices!.length - 3}</span>
                            )}
                          </div>
                        </td>
                        {/* Watch Preference */}
                        <td className="px-3 py-2 hidden md:table-cell">
                          {watchPref && (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              watchPref === 'solo' ? 'bg-blue-600' : 'bg-pink-600'
                            }`}>
                              {watchPref === 'solo' ? 'Solo' : 'Together'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
              {filtered.map(show => (
                <div
                  key={show.id}
                  onClick={() => setEditingShowId(show.id)}
                  className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all group cursor-pointer"
                >
                  {/* Poster */}
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

                  {/* Rating ribbon between poster and details */}
                  {show.rating ? (
                    <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-900">
                      <span className="text-yellow-400 font-semibold text-sm sm:text-base">{show.rating}★</span>
                      {show.watchPreference && (
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${
                          show.watchPreference === 'solo' ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'
                        }`}>
                          {show.watchPreference === 'solo' ? 'Solo' : 'Together'}
                        </span>
                      )}
                    </div>
                  ) : (show.predictedRating || show.recommendedWatchPreference) ? (
                    <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-900/60">
                      <Tooltip content={show.predictedRatingReason || 'Based on your taste profile'}>
                        <div className="flex items-center gap-1 sm:gap-1.5 cursor-help">
                          <span className="text-purple-300 text-[8px] sm:text-[10px] font-medium uppercase">AI</span>
                          {show.predictedRating && (
                            <span className="text-yellow-400 font-semibold text-sm sm:text-base">{show.predictedRating}★</span>
                          )}
                        </div>
                      </Tooltip>
                      {show.recommendedWatchPreference && (
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${
                          show.recommendedWatchPreference === 'solo'
                            ? 'bg-blue-600 text-white'
                            : 'bg-pink-600 text-white'
                        }`}>
                          {show.recommendedWatchPreference === 'solo' ? 'Solo' : 'Together'}
                        </span>
                      )}
                    </div>
                  ) : null}
                  <div className="p-2 sm:p-3">
                    {/* Title */}
                    <div className="text-xs sm:text-sm font-medium truncate group-hover:text-blue-400">
                      {show.title}
                    </div>

                    {/* Meta row: Year, Seasons, Show Status */}
                    <div className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
                      {show.year && <span>{show.year}</span>}
                      {show.numberOfSeasons && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span>{show.numberOfSeasons}S</span>
                        </>
                      )}
                      {show.showStatus && show.showStatus !== 'Returning Series' && (
                        <span className={`px-1 rounded text-[8px] sm:text-[10px] ${
                          show.showStatus === 'Ended' ? 'bg-green-900/50 text-green-400' :
                          show.showStatus === 'Canceled' ? 'bg-red-900/50 text-red-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {show.showStatus}
                        </span>
                      )}
                    </div>

                    {/* Status + RT Scores row */}
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-1.5">
                      <span className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${show.status ? STATUS_LABELS[show.status].color : 'bg-gray-600'}`}>
                        {show.status ? STATUS_LABELS[show.status].label : 'Removed'}
                      </span>
                      <RTScores
                        showId={show.id}
                        title={show.title}
                        criticsScore={show.rtCriticsScore}
                        audienceScore={show.rtAudienceScore}
                        size="sm"
                      />
                    </div>

                    {/* Streaming services */}
                    {show.streamingServices && show.streamingServices.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 sm:gap-1">
                        {show.streamingServices.slice(0, 3).map(service => {
                          const brand = STREAMING_BRANDS[service];
                          if (brand?.logo) {
                            return (
                              <Tooltip key={service} content={service}>
                                <img
                                  src={`https://image.tmdb.org/t/p/w45${brand.logo}`}
                                  alt={service}
                                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded object-cover"
                                />
                              </Tooltip>
                            );
                          }
                          return null;
                        })}
                        {show.streamingServices.length > 3 && (
                          <span className="text-[8px] sm:text-[10px] text-gray-500">+{show.streamingServices.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-8 sm:py-16 bg-gray-800 rounded-lg">
            <p className="text-gray-400 mb-4 text-sm sm:text-base">No shows found</p>
            <Link
              href="/add"
              className="inline-block bg-blue-600 hover:bg-blue-500 px-3 sm:px-4 py-1.5 sm:py-2 rounded font-medium text-sm sm:text-base"
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
          initialShow={shows.find(s => s.id === editingShowId)}
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
