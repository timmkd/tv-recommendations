import type { Show, ShowStatus, WatchPreference, TraktAuth } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { getStreamingAvailability } from './justwatch';
import { getSettings, saveSettings } from './data';

const TRAKT_API_URL = 'https://api.trakt.tv';
const TRAKT_TOKEN_URL = 'https://api.trakt.tv/oauth/token';

// Trakt API response types
export interface TraktShowInfo {
  title: string;
  year: number;
  ids: {
    trakt: number;
    slug: string;
    imdb: string;
    tmdb: number;
  };
  overview?: string;
  runtime?: number;
  status?: string;
  network?: string;
  genres?: string[];
}

export interface TraktShow {
  show: TraktShowInfo;
  rating?: number;
  rated_at?: string;
  plays?: number;
  last_watched_at?: string;
  listed_at?: string;
}

export interface TraktSearchResult {
  type: 'show';
  score: number;
  show: TraktShowInfo;
}

// Combined user data from Trakt
export interface TraktUserShow {
  tmdbId: number;
  traktId: number;
  slug: string;
  title: string;
  year: number;
  status: ShowStatus;
  traktRating?: number; // 1-10 scale
  plays?: number;
  lastWatchedAt?: string;
  listedAt?: string;
}

// Trakt streaming/watch provider types
export interface TraktWatchProvider {
  source: string;
  link: string;
}

export interface TraktWatchNow {
  sources: TraktWatchProvider[];
}

// Map Trakt source names to our slug format
const TRAKT_SOURCE_MAP: Record<string, string> = {
  'netflix': 'netflix',
  'amazon_prime': 'prime-video',
  'amazon prime': 'prime-video',
  'prime video': 'prime-video',
  'disney_plus': 'disney-plus',
  'disney+': 'disney-plus',
  'stan': 'stan',
  'binge': 'binge',
  'foxtel': 'foxtel-now',
  'foxtel now': 'foxtel-now',
  'apple_tv_plus': 'apple-tv-plus',
  'apple tv+': 'apple-tv-plus',
  'paramount_plus': 'paramount-plus',
  'paramount+': 'paramount-plus',
  'britbox': 'britbox',
  'abc iview': 'abc-iview',
  'sbs on demand': 'sbs-on-demand',
  'hbo max': 'max',
  'max': 'max',
};

function getClientId(): string {
  const clientId = process.env.TRAKT_CLIENT_ID;
  if (!clientId) {
    throw new Error('TRAKT_CLIENT_ID environment variable is not set. Get one free at trakt.tv/oauth/applications');
  }
  return clientId;
}

function getClientSecret(): string {
  const clientSecret = process.env.TRAKT_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('TRAKT_CLIENT_SECRET environment variable is not set');
  }
  return clientSecret;
}

// Refresh access token if expired
async function refreshTokenIfNeeded(auth: TraktAuth): Promise<TraktAuth | null> {
  // Check if token is expired (with 5 minute buffer)
  const now = Math.floor(Date.now() / 1000);
  if (auth.expiresAt > now + 300) {
    return auth; // Still valid
  }

  try {
    const response = await fetch(TRAKT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: auth.refreshToken,
        client_id: getClientId(),
        client_secret: getClientSecret(),
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/trakt/callback`,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const newAuth: TraktAuth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      createdAt: data.created_at || Math.floor(Date.now() / 1000),
    };

    // Save updated tokens
    const settings = await getSettings();
    settings.traktAuth = newAuth;
    await saveSettings(settings);

    return newAuth;
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
}

// Get auth headers for authenticated requests
async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const settings = await getSettings();
  if (!settings.traktAuth) {
    return null;
  }

  const auth = await refreshTokenIfNeeded(settings.traktAuth);
  if (!auth) {
    return null;
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${auth.accessToken}`,
    'trakt-api-version': '2',
    'trakt-api-key': getClientId(),
  };
}

// Check if we have valid authentication
export async function isAuthenticated(): Promise<boolean> {
  const headers = await getAuthHeaders();
  return headers !== null;
}

// Fetch user's watchlist via Trakt API
async function fetchWatchlist(username: string): Promise<TraktShow[]> {
  const clientId = getClientId();
  const url = `${TRAKT_API_URL}/users/${username}/watchlist/shows`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`User "${username}" not found or profile is private`);
    }
    throw new Error(`Failed to fetch Trakt watchlist: ${response.status}`);
  }

  return response.json();
}

// Fetch user's watched shows via Trakt API
async function fetchWatched(username: string): Promise<TraktShow[]> {
  const clientId = getClientId();
  const url = `${TRAKT_API_URL}/users/${username}/watched/shows`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Trakt watched: ${response.status}`);
  }

  return response.json();
}

// Fetch user's ratings via Trakt API
async function fetchRatings(username: string): Promise<TraktShow[]> {
  const clientId = getClientId();
  const url = `${TRAKT_API_URL}/users/${username}/ratings/shows`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    }
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

// Search for shows via Trakt API
export async function searchShows(query: string): Promise<TraktSearchResult[]> {
  const clientId = getClientId();
  const url = `${TRAKT_API_URL}/search/show?query=${encodeURIComponent(query)}&extended=full`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to search Trakt: ${response.status}`);
  }

  return response.json();
}

// Get show details by Trakt ID or TMDB ID
export async function getShowByTmdbId(tmdbId: number): Promise<TraktShowInfo | null> {
  const clientId = getClientId();
  const url = `${TRAKT_API_URL}/search/tmdb/${tmdbId}?type=show&extended=full`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    }
  });

  if (!response.ok) {
    return null;
  }

  const results = await response.json();
  if (results.length > 0 && results[0].show) {
    return results[0].show;
  }
  return null;
}

// Extended show info with ratings
export interface TraktShowExtended extends TraktShowInfo {
  rating?: number;  // Community rating 0-10
  votes?: number;   // Vote count
}

// Get show with community ratings
export async function getShowWithRatings(slugOrId: string | number): Promise<TraktShowExtended | null> {
  const clientId = getClientId();
  const url = `${TRAKT_API_URL}/shows/${slugOrId}?extended=full`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

// Get IMDB rating via OMDB API (requires OMDB_API_KEY env var)
export async function getImdbRating(imdbId: string): Promise<{ rating: number; votes: number } | null> {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey || !imdbId) {
    return null;
  }

  try {
    const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
      return {
        rating: parseFloat(data.imdbRating),
        votes: parseInt(data.imdbVotes?.replace(/,/g, '') || '0', 10)
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Progress response type from /shows/{id}/progress/watched
interface TraktShowProgress {
  aired: number;
  completed: number;
  last_watched_at?: string;
  seasons: {
    number: number;
    aired: number;
    completed: number;
  }[];
}

// Fetch progress for a single show (authenticated)
async function fetchShowProgress(slug: string): Promise<TraktShowProgress | null> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) {
    return null;
  }

  const url = `${TRAKT_API_URL}/shows/${slug}/progress/watched`;

  try {
    const response = await fetch(url, { headers: authHeaders });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

// In-memory cache for progress data to avoid rate limiting
let progressCache: Map<string, TraktShowProgress> = new Map();
let progressCacheTime: number = 0;
const PROGRESS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes - longer to avoid rate limits

// Flag to enable/disable progress fetching (can be toggled via API)
let progressFetchEnabled = true;

// Export function to manually trigger progress refresh
export async function refreshProgressCache(slugs: string[]): Promise<number> {
  progressFetchEnabled = true;
  const results = await fetchProgressForShowsInternal(slugs);
  return results.size;
}

// Internal function that does the actual fetching
async function fetchProgressForShowsInternal(slugs: string[]): Promise<Map<string, TraktShowProgress>> {
  const results = new Map<string, TraktShowProgress>();

  // Process in batches of 2 with longer delays to avoid rate limiting
  const batchSize = 2;
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const promises = batch.map(async (slug) => {
      try {
        const progress = await fetchShowProgress(slug);
        if (progress) {
          results.set(slug, progress);
        }
      } catch (err) {
        // If we hit rate limit, stop fetching
        console.error(`Progress fetch failed for ${slug}:`, err);
        progressFetchEnabled = false;
      }
    });
    await Promise.all(promises);

    // Longer delay between batches to avoid rate limiting (500ms)
    if (i + batchSize < slugs.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Update cache
  progressCache = results;
  progressCacheTime = Date.now();

  return results;
}

// Fetch progress for multiple shows (with caching to avoid rate limits)
async function fetchProgressForShows(slugs: string[]): Promise<Map<string, TraktShowProgress>> {
  const now = Date.now();

  // Return cached data if still fresh
  if (progressCache.size > 0 && (now - progressCacheTime) < PROGRESS_CACHE_TTL) {
    return progressCache;
  }

  // If progress fetching is disabled (due to rate limits), return empty
  if (!progressFetchEnabled) {
    console.log('Progress fetching disabled due to rate limits, using cached data');
    return progressCache;
  }

  return fetchProgressForShowsInternal(slugs);
}

// Get all user shows combined (watchlist + watched + ratings)
// Uses authenticated progress endpoint when available for accurate status
export async function getUserShows(username: string): Promise<TraktUserShow[]> {
  const showsMap = new Map<number, TraktUserShow>();

  // Fetch all data in parallel
  const [watchlist, watched, ratings] = await Promise.all([
    fetchWatchlist(username).catch(() => []),
    fetchWatched(username).catch(() => []),
    fetchRatings(username).catch(() => [])
  ]);

  // Process watchlist - status: watchlist
  for (const item of watchlist) {
    const tmdbId = item.show.ids.tmdb;
    if (!tmdbId) continue;

    showsMap.set(tmdbId, {
      tmdbId,
      traktId: item.show.ids.trakt,
      slug: item.show.ids.slug,
      title: item.show.title,
      year: item.show.year,
      status: 'watchlist',
      listedAt: item.listed_at
    });
  }

  // Fetch progress for all watched shows to determine watching vs completed
  // Wrapped in try-catch to handle rate limiting gracefully
  let progressMap = new Map<string, TraktShowProgress>();
  try {
    const hasAuth = await isAuthenticated();
    const watchedSlugs = watched.map(w => w.show.ids.slug).filter(Boolean);
    if (hasAuth && watchedSlugs.length > 0) {
      progressMap = await fetchProgressForShows(watchedSlugs);
    }
  } catch (err) {
    console.error('Failed to fetch progress (rate limited?):', err);
    // Continue without progress - shows will default to "completed"
  }

  // Process watched - use progress data for accurate status
  for (const item of watched) {
    const tmdbId = item.show.ids.tmdb;
    const slug = item.show.ids.slug;
    if (!tmdbId) continue;

    const existing = showsMap.get(tmdbId);
    const progress = progressMap.get(slug);

    // Determine status based on progress if available
    let status: ShowStatus = 'completed';
    if (progress) {
      // If they've watched some but not all aired episodes, it's "watching"
      if (progress.completed < progress.aired && progress.completed > 0) {
        status = 'watching';
      }
    }

    if (existing) {
      existing.status = status;
      existing.plays = item.plays;
      existing.lastWatchedAt = item.last_watched_at;
    } else {
      showsMap.set(tmdbId, {
        tmdbId,
        traktId: item.show.ids.trakt,
        slug: item.show.ids.slug,
        title: item.show.title,
        year: item.show.year,
        status,
        plays: item.plays,
        lastWatchedAt: item.last_watched_at
      });
    }
  }

  // Process ratings - add rating to existing entries
  for (const item of ratings) {
    const tmdbId = item.show.ids.tmdb;
    if (!tmdbId) continue;

    const existing = showsMap.get(tmdbId);
    if (existing) {
      existing.traktRating = item.rating;
    } else {
      // Show has rating but not in watchlist or watched - mark as completed
      showsMap.set(tmdbId, {
        tmdbId,
        traktId: item.show.ids.trakt,
        slug: item.show.ids.slug,
        title: item.show.title,
        year: item.show.year,
        status: 'completed',
        traktRating: item.rating
      });
    }
  }

  return Array.from(showsMap.values());
}

// Fetch streaming availability from Trakt for a show
export async function getShowStreaming(slug: string, country: string = 'au'): Promise<string[]> {
  const clientId = getClientId();
  const url = `${TRAKT_API_URL}/shows/${slug}/watchnow/${country}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    // Trakt returns an array of sources
    // Each source has: source (name), link, etc.
    const services: string[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        const sourceName = (item.source || '').toLowerCase();
        // First try to map using our known mappings
        const mappedSlug = TRAKT_SOURCE_MAP[sourceName];
        if (mappedSlug) {
          services.push(mappedSlug);
        } else {
          // Fallback: normalize the name as a slug
          const slug = sourceName.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          if (slug) {
            services.push(slug);
          }
        }
      }
    }

    return [...new Set(services)]; // Dedupe
  } catch (error) {
    console.error(`Failed to fetch streaming for ${slug}:`, error);
    return [];
  }
}

// Batch fetch streaming for multiple shows
export async function batchGetStreaming(
  shows: { slug: string; tmdbId: number }[],
  country: string = 'au'
): Promise<Map<number, string[]>> {
  const results = new Map<number, string[]>();

  for (const show of shows) {
    try {
      const services = await getShowStreaming(show.slug, country);
      results.set(show.tmdbId, services);
      // Rate limit - be respectful to Trakt API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      results.set(show.tmdbId, []);
    }
  }

  return results;
}

// Import all shows from a Trakt user
export async function importFromTrakt(
  username: string,
  defaultPreference?: WatchPreference,
  options?: { fetchStreaming?: boolean; onProgress?: (msg: string) => void }
): Promise<{ shows: Show[]; errors: string[] }> {
  const errors: string[] = [];
  const showsMap = new Map<number, Show>();
  const { fetchStreaming = true, onProgress } = options || {};

  try {
    // Fetch watchlist
    const watchlist = await fetchWatchlist(username);
    for (const item of watchlist) {
      const tmdbId = item.show.ids.tmdb;
      if (!tmdbId) continue;

      showsMap.set(tmdbId, {
        id: uuidv4(),
        tmdbId,
        title: item.show.title,
        year: item.show.year,
        status: 'watchlist',
        watchPreference: defaultPreference,
        genres: [],
        streamingServices: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    errors.push(`Failed to fetch watchlist: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  try {
    // Fetch watched shows
    const watched = await fetchWatched(username);
    for (const item of watched) {
      const tmdbId = item.show.ids.tmdb;
      if (!tmdbId) continue;

      if (!showsMap.has(tmdbId)) {
        showsMap.set(tmdbId, {
          id: uuidv4(),
          tmdbId,
          title: item.show.title,
          year: item.show.year,
          status: 'completed',
          watchPreference: defaultPreference,
          genres: [],
          streamingServices: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        // Update status if already in watchlist
        const existing = showsMap.get(tmdbId)!;
        existing.status = 'completed';
      }
    }
  } catch (e) {
    errors.push(`Failed to fetch watched shows: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  try {
    // Fetch ratings and apply them (convert Trakt 1-10 to our 0.5-5 scale)
    const ratings = await fetchRatings(username);
    for (const item of ratings) {
      const tmdbId = item.show.ids.tmdb;
      if (!tmdbId) continue;

      const show = showsMap.get(tmdbId);
      if (show && item.rating) {
        // Convert Trakt's 1-10 scale to our 0.5-5 scale
        show.rating = Math.round(item.rating / 2 * 2) / 2; // Round to nearest 0.5
      }
    }
  } catch (e) {
    errors.push(`Failed to fetch ratings: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  // Fetch streaming availability for each show
  if (fetchStreaming) {
    const shows = Array.from(showsMap.values());
    onProgress?.(`Fetching streaming info for ${shows.length} shows...`);

    for (let i = 0; i < shows.length; i++) {
      const show = shows[i];
      if (show.tmdbId) {
        try {
          onProgress?.(`Streaming: ${show.title} (${i + 1}/${shows.length})`);
          const result = await getStreamingAvailability(show.tmdbId);
          show.streamingServices = result.services;
          show.streamingFetchedAt = new Date().toISOString();
          if (result.justWatchUrl) {
            show.justWatchUrl = result.justWatchUrl;
          }
          // Rate limit - 200ms between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          // Silently continue if streaming fetch fails for a show
          errors.push(`Streaming fetch failed for ${show.title}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }
  }

  return {
    shows: Array.from(showsMap.values()),
    errors
  };
}

// ============================================
// TRAKT SYNC FUNCTIONS
// ============================================

// Sync a rating to Trakt (converts 0.5-5 scale to 1-10)
export async function syncRatingToTrakt(tmdbId: number, rating: number): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) {
    console.error('Cannot sync rating: not authenticated with Trakt');
    return false;
  }

  // Convert our 0.5-5 scale to Trakt's 1-10 scale
  const traktRating = Math.round(rating * 2);

  try {
    const response = await fetch(`${TRAKT_API_URL}/sync/ratings`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shows: [{
          ids: { tmdb: tmdbId },
          rating: traktRating
        }]
      })
    });

    if (!response.ok) {
      console.error('Failed to sync rating to Trakt:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error syncing rating to Trakt:', error);
    return false;
  }
}

// Remove a rating from Trakt
export async function removeRatingFromTrakt(tmdbId: number): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return false;

  try {
    const response = await fetch(`${TRAKT_API_URL}/sync/ratings/remove`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shows: [{ ids: { tmdb: tmdbId } }]
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error removing rating from Trakt:', error);
    return false;
  }
}

// Hide a show on Trakt (hides from recommendations)
export async function hideShowOnTrakt(tmdbId: number): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return false;

  try {
    const response = await fetch(`${TRAKT_API_URL}/users/hidden/recommendations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shows: [{ ids: { tmdb: tmdbId } }]
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error hiding show on Trakt:', error);
    return false;
  }
}

// Unhide a show on Trakt
export async function unhideShowOnTrakt(tmdbId: number): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return false;

  try {
    const response = await fetch(`${TRAKT_API_URL}/users/hidden/recommendations/remove`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shows: [{ ids: { tmdb: tmdbId } }]
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error unhiding show on Trakt:', error);
    return false;
  }
}

// Get or create the "Dropped" list on Trakt
async function getOrCreateDroppedList(): Promise<string | null> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return null;

  try {
    // First, try to find existing "Dropped" list
    const listsResponse = await fetch(`${TRAKT_API_URL}/users/me/lists`, {
      headers: authHeaders
    });

    if (listsResponse.ok) {
      const lists = await listsResponse.json();
      const droppedList = lists.find((list: { name: string; ids: { slug: string } }) =>
        list.name.toLowerCase() === 'dropped'
      );
      if (droppedList) {
        return droppedList.ids.slug;
      }
    }

    // Create the list if it doesn't exist
    const createResponse = await fetch(`${TRAKT_API_URL}/users/me/lists`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Dropped',
        description: 'Shows I started but decided not to continue',
        privacy: 'private',
        display_numbers: false,
        allow_comments: false
      })
    });

    if (createResponse.ok) {
      const newList = await createResponse.json();
      return newList.ids.slug;
    }

    return null;
  } catch (error) {
    console.error('Error getting/creating Dropped list:', error);
    return null;
  }
}

// Add a show to the Dropped list
export async function addToDroppedList(tmdbId: number): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return false;

  const listSlug = await getOrCreateDroppedList();
  if (!listSlug) return false;

  try {
    const response = await fetch(`${TRAKT_API_URL}/users/me/lists/${listSlug}/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shows: [{ ids: { tmdb: tmdbId } }]
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error adding to Dropped list:', error);
    return false;
  }
}

// Remove a show from the Dropped list
export async function removeFromDroppedList(tmdbId: number): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return false;

  const listSlug = await getOrCreateDroppedList();
  if (!listSlug) return false;

  try {
    const response = await fetch(`${TRAKT_API_URL}/users/me/lists/${listSlug}/items/remove`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shows: [{ ids: { tmdb: tmdbId } }]
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error removing from Dropped list:', error);
    return false;
  }
}

// Get all hidden shows from Trakt
export async function getHiddenShows(): Promise<Set<number>> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return new Set();

  try {
    const response = await fetch(`${TRAKT_API_URL}/users/hidden/recommendations?type=show&limit=1000`, {
      headers: authHeaders
    });

    if (!response.ok) return new Set();

    const hidden = await response.json();
    const tmdbIds = new Set<number>();

    for (const item of hidden) {
      if (item.show?.ids?.tmdb) {
        tmdbIds.add(item.show.ids.tmdb);
      }
    }

    return tmdbIds;
  } catch (error) {
    console.error('Error fetching hidden shows:', error);
    return new Set();
  }
}

// Get all shows in the Dropped list
export async function getDroppedShows(): Promise<Set<number>> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return new Set();

  const listSlug = await getOrCreateDroppedList();
  if (!listSlug) return new Set();

  try {
    const response = await fetch(`${TRAKT_API_URL}/users/me/lists/${listSlug}/items/shows`, {
      headers: authHeaders
    });

    if (!response.ok) return new Set();

    const items = await response.json();
    const tmdbIds = new Set<number>();

    for (const item of items) {
      if (item.show?.ids?.tmdb) {
        tmdbIds.add(item.show.ids.tmdb);
      }
    }

    return tmdbIds;
  } catch (error) {
    console.error('Error fetching dropped shows:', error);
    return new Set();
  }
}

// Get user's ratings from Trakt (returns map of tmdbId -> rating in our 0.5-5 scale)
export async function getUserRatings(): Promise<Map<number, number>> {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return new Map();

  try {
    const response = await fetch(`${TRAKT_API_URL}/users/me/ratings/shows`, {
      headers: authHeaders
    });

    if (!response.ok) return new Map();

    const ratings = await response.json();
    const ratingsMap = new Map<number, number>();

    for (const item of ratings) {
      if (item.show?.ids?.tmdb && item.rating) {
        // Convert Trakt's 1-10 to our 0.5-5 scale (round to nearest 0.5)
        const ourRating = Math.round(item.rating / 2 * 2) / 2;
        ratingsMap.set(item.show.ids.tmdb, ourRating);
      }
    }

    return ratingsMap;
  } catch (error) {
    console.error('Error fetching user ratings:', error);
    return new Map();
  }
}
