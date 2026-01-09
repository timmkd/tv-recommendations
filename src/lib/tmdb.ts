const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface TMDBShowDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  genres: { id: number; name: string }[];
  vote_average: number;
  status: string;
  number_of_seasons: number;
  number_of_episodes: number;
}

interface TMDBSearchResult {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  genre_ids: number[];
}

interface TMDBSeason {
  season_number: number;
  episode_count: number;
  episodes?: TMDBEpisode[];
}

interface TMDBEpisode {
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string;
}

function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY environment variable is not set');
  }
  return key;
}

export async function searchShows(query: string): Promise<TMDBSearchResult[]> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

export async function getShowDetails(tmdbId: number): Promise<TMDBShowDetails> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB get show failed: ${response.status}`);
  }

  return response.json();
}

export async function getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<TMDBEpisode[]> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB get season failed: ${response.status}`);
  }

  const data = await response.json();
  return data.episodes || [];
}

export function getPosterUrl(posterPath: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | undefined {
  if (!posterPath) return undefined;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

// Genre ID to name mapping (common genres)
const GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western'
};

export function getGenreNames(genreIds: number[]): string[] {
  return genreIds.map(id => GENRE_MAP[id] || 'Unknown').filter(g => g !== 'Unknown');
}

// Enrich a show with TMDB data
export async function enrichShowWithTMDB(tmdbId: number): Promise<{
  overview?: string;
  posterPath?: string;
  genres: string[];
  year?: number;
}> {
  try {
    const details = await getShowDetails(tmdbId);
    return {
      overview: details.overview,
      posterPath: details.poster_path || undefined,
      genres: details.genres.map(g => g.name),
      year: details.first_air_date ? parseInt(details.first_air_date.split('-')[0]) : undefined
    };
  } catch {
    return { genres: [] };
  }
}

// TMDB provider ID to slug mapping for Australia
// Consolidates different tiers (ads, premium, channels) into base service
const PROVIDER_MAP: Record<number, string> = {
  // Netflix
  8: 'netflix',
  1796: 'netflix', // Netflix standard with ads

  // Amazon Prime Video
  119: 'amazon-prime-video',
  2100: 'amazon-prime-video', // Prime Video with ads
  9: 'amazon-prime-video', // Amazon Prime Video legacy

  // Disney
  337: 'disney-plus',

  // Apple TV+
  2: 'apple-tv-plus',
  350: 'apple-tv-plus', // Apple TV
  2552: 'apple-tv-plus', // Apple TV Amazon Channel

  // Stan
  21: 'stan',

  // Binge
  385: 'binge',

  // Foxtel
  134: 'foxtel-now',

  // Paramount+
  531: 'paramount-plus',
  1853: 'paramount-plus', // Paramount+ Premium
  1854: 'paramount-plus', // Paramount+ Basic with Ads
  582: 'paramount-plus', // Paramount+ Amazon Channel
  1770: 'paramount-plus', // Paramount+ Apple TV Channel

  // BritBox
  380: 'britbox',
  197: 'britbox', // BritBox Amazon Channel
  151: 'britbox', // BritBox Apple TV Channel

  // Free-to-air
  29: 'abc-iview',
  132: 'sbs-on-demand',

  // Max (HBO)
  1899: 'max',

  // AMC+
  526: 'amc-plus',
  528: 'amc-plus', // AMC+ Amazon Channel
  529: 'amc-plus', // AMC+ Apple TV Channel
};

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface WatchProviderResult {
  results: {
    [country: string]: {
      link?: string;
      flatrate?: WatchProvider[];
      rent?: WatchProvider[];
      buy?: WatchProvider[];
    };
  };
}

// Get streaming providers for a show from TMDB
export async function getWatchProviders(tmdbId: number, country: string = 'AU'): Promise<string[]> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/tv/${tmdbId}/watch/providers?api_key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const data: WatchProviderResult = await response.json();
    const countryData = data.results?.[country];

    if (!countryData?.flatrate) {
      return [];
    }

    // Map provider IDs to our slugs
    const services = countryData.flatrate
      .map(p => PROVIDER_MAP[p.provider_id] || p.provider_name.toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean);

    return [...new Set(services)]; // Dedupe
  } catch (error) {
    console.error(`Failed to fetch watch providers for ${tmdbId}:`, error);
    return [];
  }
}

// Batch get watch providers for multiple shows
export async function batchGetWatchProviders(
  tmdbIds: number[],
  country: string = 'AU'
): Promise<Map<number, string[]>> {
  const results = new Map<number, string[]>();

  for (const tmdbId of tmdbIds) {
    try {
      const services = await getWatchProviders(tmdbId, country);
      results.set(tmdbId, services);
      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch {
      results.set(tmdbId, []);
    }
  }

  return results;
}
