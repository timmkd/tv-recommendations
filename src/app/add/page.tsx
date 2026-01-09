'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SearchResult {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl?: string;
  overview?: string;
  genres: string[];
  inLibrary: boolean;
  existingId?: string;
}

export default function AddShowPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data);
      }
    } catch {
      setError('Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const addShow = async (
    result: SearchResult,
    status: 'watching' | 'watchlist',
    watchingContext: 'solo' | 'with-wife' | 'both'
  ) => {
    setAdding(result.tmdbId);

    try {
      const response = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: result.tmdbId,
          title: result.title,
          year: result.year,
          status,
          watchingContext
        })
      });

      if (response.ok) {
        const show = await response.json();
        router.push(`/show/${show.id}`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add show');
      }
    } catch {
      setError('Failed to add show');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-8 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-8">Add Show</h1>

        {/* Search */}
        <div className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Search for a TV show..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={search}
              disabled={loading || query.trim().length < 2}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-8">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.tmdbId}
                className="bg-gray-800 rounded-lg p-4 flex gap-4"
              >
                {result.posterUrl ? (
                  <img
                    src={result.posterUrl}
                    alt={result.title}
                    className="w-20 h-30 object-cover rounded"
                  />
                ) : (
                  <div className="w-20 h-30 bg-gray-700 rounded flex items-center justify-center">
                    <span className="text-gray-500 text-xs">No image</span>
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {result.title}
                    {result.year && (
                      <span className="text-gray-400 font-normal ml-2">({result.year})</span>
                    )}
                  </h3>

                  {result.genres.length > 0 && (
                    <div className="flex gap-1 mt-1 mb-2">
                      {result.genres.map((genre) => (
                        <span key={genre} className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}

                  {result.overview && (
                    <p className="text-gray-400 text-sm line-clamp-2">{result.overview}</p>
                  )}

                  {result.inLibrary ? (
                    <Link
                      href={`/show/${result.existingId}`}
                      className="inline-block mt-3 text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Already in library &rarr;
                    </Link>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AddButton
                        label="+ Watchlist (Solo)"
                        loading={adding === result.tmdbId}
                        onClick={() => addShow(result, 'watchlist', 'solo')}
                      />
                      <AddButton
                        label="+ Watchlist (Together)"
                        loading={adding === result.tmdbId}
                        onClick={() => addShow(result, 'watchlist', 'with-wife')}
                      />
                      <AddButton
                        label="+ Watching (Solo)"
                        loading={adding === result.tmdbId}
                        onClick={() => addShow(result, 'watching', 'solo')}
                        variant="secondary"
                      />
                      <AddButton
                        label="+ Watching (Together)"
                        loading={adding === result.tmdbId}
                        onClick={() => addShow(result, 'watching', 'with-wife')}
                        variant="secondary"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && query.length > 0 && (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <p className="text-gray-400">No results found. Try a different search.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AddButton({
  label,
  loading,
  onClick,
  variant = 'primary'
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const baseClasses = 'px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50';
  const variantClasses = variant === 'primary'
    ? 'bg-blue-600 hover:bg-blue-500'
    : 'bg-gray-600 hover:bg-gray-500';

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`${baseClasses} ${variantClasses}`}
    >
      {loading ? '...' : label}
    </button>
  );
}
