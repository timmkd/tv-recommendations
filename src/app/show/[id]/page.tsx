'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import type { Show, ShowStatus, WatchPreference } from '@/types';

const STATUS_OPTIONS: { value: ShowStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'watchlist', label: 'Watchlist' }
];

const PREFERENCE_OPTIONS: { value: WatchPreference; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'together', label: 'Together' }
];

// Star rating component with half-star support
function StarRating({
  value,
  onChange
}: {
  value: number | undefined;
  onChange: (rating: number | undefined) => void;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value ?? 0;

  const handleClick = (starIndex: number, isHalf: boolean) => {
    const newRating = isHalf ? starIndex + 0.5 : starIndex + 1;
    // If clicking the same rating, clear it
    if (newRating === value) {
      onChange(undefined);
    } else {
      onChange(newRating);
    }
  };

  const handleMouseMove = (e: React.MouseEvent, starIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    setHoverValue(isHalf ? starIndex + 0.5 : starIndex + 1);
  };

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHoverValue(null)}>
      {[0, 1, 2, 3, 4].map((starIndex) => {
        const fillLevel = Math.max(0, Math.min(1, displayValue - starIndex));
        return (
          <div
            key={starIndex}
            className="relative w-8 h-8 cursor-pointer"
            onMouseMove={(e) => handleMouseMove(e, starIndex)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const isHalf = x < rect.width / 2;
              handleClick(starIndex, isHalf);
            }}
          >
            {/* Empty star background */}
            <svg
              className="absolute inset-0 w-8 h-8 text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {/* Filled star (clipped based on fill level) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fillLevel * 100}%` }}
            >
              <svg
                className="w-8 h-8 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        );
      })}
      <span className="ml-2 text-sm text-gray-400">
        {value ? `${value}/5` : 'Not rated'}
      </span>
    </div>
  );
}

export default function ShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingRatings, setFetchingRatings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [status, setStatus] = useState<ShowStatus>('watchlist');
  const [watchPreference, setWatchPreference] = useState<WatchPreference | undefined>(undefined);
  const [watchPreferenceNote, setWatchPreferenceNote] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [reviewNote, setReviewNote] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchShow() {
      try {
        const response = await fetch(`/api/shows?id=${id}`);
        if (!response.ok) {
          throw new Error('Show not found');
        }
        const data = await response.json();
        setShow(data);
        setStatus(data.status);
        setWatchPreference(data.watchPreference);
        setWatchPreferenceNote(data.watchPreferenceNote || '');
        setRating(data.rating);
        setReviewNote(data.reviewNote || '');
        setNotes(data.notes || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load show');
      } finally {
        setLoading(false);
      }
    }

    fetchShow();
  }, [id]);

  const fetchRTRatings = async () => {
    if (!show) return;

    setFetchingRatings(true);
    try {
      const params = new URLSearchParams({
        tmdbId: String(show.tmdbId),
        title: show.title,
        refresh: 'true'
      });
      if (show.year) params.set('year', String(show.year));
      const response = await fetch(`/api/ratings?${params}`);
      const data = await response.json();

      if (data.criticsScore || data.audienceScore) {
        setShow({
          ...show,
          rtCriticsScore: data.criticsScore,
          rtAudienceScore: data.audienceScore
        });
      }
    } catch {
      // Silently fail
    } finally {
      setFetchingRatings(false);
    }
  };

  const saveChanges = async () => {
    if (!show) return;

    setSaving(true);
    try {
      const response = await fetch('/api/trakt/shows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: show.tmdbId,
          status,
          watchPreference: watchPreference || null,
          watchPreferenceNote: watchPreferenceNote || null,
          rating: rating || null,
          reviewNote: reviewNote || null,
          notes: notes || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      const { overlay } = await response.json();
      setShow({ ...show, ...overlay });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const deleteShowHandler = async () => {
    if (!show || !confirm('Are you sure you want to delete this show?')) return;

    try {
      await fetch(`/api/shows?tmdbId=${show.tmdbId}`, { method: 'DELETE' });
      router.push('/shows');
    } catch {
      setError('Failed to delete show');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Error</h2>
            <p className="text-red-300">{error || 'Show not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0">
            {show.posterPath ? (
              <img
                src={`https://image.tmdb.org/t/p/w342${show.posterPath}`}
                alt={show.title}
                className="w-48 rounded-lg shadow-lg"
              />
            ) : (
              <div className="w-48 aspect-[2/3] bg-gray-800 rounded-lg flex items-center justify-center">
                <span className="text-gray-500">No poster</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{show.title}</h1>
            <div className="text-gray-400 mb-4">
              {show.year && <span>{show.year}</span>}
              {show.genres.length > 0 && (
                <span className="ml-2">• {show.genres.join(', ')}</span>
              )}
            </div>

            {show.overview && (
              <p className="text-gray-300 mb-6">{show.overview}</p>
            )}

            {/* RT Ratings Display */}
            <div className="flex gap-4 mb-6 items-center">
              {show.rtCriticsScore && (
                <div className="bg-red-900/30 px-3 py-2 rounded">
                  <div className="text-xs text-red-400">Critics</div>
                  <div className="text-xl font-bold">{show.rtCriticsScore}%</div>
                </div>
              )}
              {show.rtAudienceScore && (
                <div className="bg-yellow-900/30 px-3 py-2 rounded">
                  <div className="text-xs text-yellow-400">Audience</div>
                  <div className="text-xl font-bold">{show.rtAudienceScore}%</div>
                </div>
              )}
              {!show.rtCriticsScore && !show.rtAudienceScore && (
                <button
                  onClick={fetchRTRatings}
                  disabled={fetchingRatings}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 px-4 py-2 rounded text-sm font-medium"
                >
                  {fetchingRatings ? 'Fetching...' : 'Get RT Ratings'}
                </button>
              )}
              {(show.rtCriticsScore || show.rtAudienceScore) && (
                <button
                  onClick={fetchRTRatings}
                  disabled={fetchingRatings}
                  className="text-gray-400 hover:text-gray-300 text-sm"
                >
                  {fetchingRatings ? '...' : 'Refresh'}
                </button>
              )}
            </div>

            {/* Editable Fields */}
            <div className="space-y-6 bg-gray-800 rounded-lg p-6">
              {/* Status */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ShowStatus)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Watch Preference */}
              <div className="border-t border-gray-700 pt-6">
                <label className="block text-sm text-gray-400 mb-2">Watch Preference</label>
                <div className="flex gap-2 mb-3">
                  {PREFERENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setWatchPreference(
                        watchPreference === opt.value ? undefined : opt.value
                      )}
                      className={`px-4 py-2 rounded font-medium transition-colors ${
                        watchPreference === opt.value
                          ? opt.value === 'solo'
                            ? 'bg-blue-600 text-white'
                            : 'bg-pink-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={watchPreferenceNote}
                  onChange={(e) => setWatchPreferenceNote(e.target.value)}
                  placeholder="Why this preference? (e.g., 'Too intense for watching together')"
                  rows={2}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Rating */}
              <div className="border-t border-gray-700 pt-6">
                <label className="block text-sm text-gray-400 mb-2">Your Rating</label>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Review Note */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Review Note
                  <span className="text-gray-500 ml-1">
                    (what you liked/disliked, or why you dropped it)
                  </span>
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Great pacing, loved the character development..."
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>

              {/* General Notes */}
              <div className="border-t border-gray-700 pt-6">
                <label className="block text-sm text-gray-400 mb-2">General Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any other notes..."
                  rows={2}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between border-t border-gray-700 pt-6">
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 px-6 py-2 rounded font-medium"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  onClick={deleteShowHandler}
                  className="text-red-400 hover:text-red-300 px-4 py-2"
                >
                  Delete Show
                </button>
              </div>
            </div>

            {/* Streaming Services */}
            {show.streamingServices.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm text-gray-400 mb-2">Available on</h3>
                <div className="flex gap-2">
                  {show.streamingServices.map((service) => (
                    <span
                      key={service}
                      className="px-3 py-1 bg-gray-800 rounded text-sm"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
