export type WatchPreference = 'solo' | 'together';
export type ShowStatus = 'watching' | 'completed' | 'watchlist' | 'dropped';

export interface Show {
  id: string;
  tmdbId: number;
  title: string;
  year?: number;
  posterPath?: string;
  overview?: string;
  status: ShowStatus;

  // Watch preference (binary choice)
  watchPreference?: WatchPreference;
  watchPreferenceNote?: string;

  // Rating & review
  rating?: number; // 0.5 to 5 in 0.5 increments
  reviewNote?: string;

  // Predicted rating (for watchlist items)
  predictedRating?: number; // 0.5 to 5 in 0.5 increments
  predictedRatingReason?: string;
  recommendedWatchPreference?: WatchPreference;

  // General notes
  notes?: string;

  // Visibility
  hidden?: boolean;

  // External data
  rtCriticsScore?: number;
  rtAudienceScore?: number;
  rtFetchedAt?: string;  // ISO date - when RT scores were last fetched
  genres: string[];
  streamingServices: string[];
  streamingFetchedAt?: string;  // ISO date - when streaming was last fetched
  justWatchUrl?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface Episode {
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
  title?: string;
  watched: boolean;
  watchedAt?: string;
}

export interface StreamingService {
  slug: string;
  name: string;
  isSubscribed: boolean;
}

export interface DeletedShow {
  tmdbId?: number;
  title: string;
  year?: number;
  deletedAt: string;
}

export interface TraktAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  createdAt: number; // Unix timestamp
}

export interface Settings {
  streamingServices: StreamingService[];
  openaiApiKey?: string;
  traktUsername?: string;
  traktAuth?: TraktAuth;
  justWatchUsername?: string;
  deletedShows: DeletedShow[];
}

export interface ShowsData {
  shows: Show[];
}

// Overlay data - custom fields stored locally, keyed by tmdbId
export interface ShowOverlay {
  tmdbId: number;

  // Watch preference (binary choice)
  watchPreference?: WatchPreference;
  watchPreferenceNote?: string;

  // Rating & review (our custom rating, not Trakt's)
  rating?: number; // 0.5 to 5 in 0.5 increments
  reviewNote?: string;

  // Predicted rating (for watchlist items)
  predictedRating?: number; // 0.5 to 5 in 0.5 increments
  predictedRatingReason?: string;
  recommendedWatchPreference?: WatchPreference;

  // General notes
  notes?: string;

  // Visibility
  hidden?: boolean;

  // Cached external data
  posterPath?: string;
  overview?: string;
  genres?: string[];
  rtCriticsScore?: number;
  rtAudienceScore?: number;
  rtFetchedAt?: string;
  streamingServices?: string[];
  streamingFetchedAt?: string;
  justWatchUrl?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface OverlaysData {
  overlays: ShowOverlay[];
}

export interface EpisodesData {
  episodes: Episode[];
}

// API response types
export interface TraktShow {
  show: {
    title: string;
    year: number;
    ids: {
      trakt: number;
      slug: string;
      imdb: string;
      tmdb: number;
    };
  };
  rating?: number;
  rated_at?: string;
  plays?: number;
  last_watched_at?: string;
}

export interface TMDBSearchResult {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string;
  overview?: string;
  genre_ids: number[];
}

export interface Recommendation {
  title: string;
  tmdbId?: number;
  reason: string;
  streamingServices: string[];
  confidence: 'high' | 'medium' | 'low';
}
