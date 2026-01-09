'use client';

import { useState, useEffect } from 'react';
import type { Show, ShowStatus, WatchPreference } from '@/types';

const STATUS_OPTIONS: { value: ShowStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'dropped', label: 'Dropped' }
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
            className="relative w-7 h-7 cursor-pointer"
            onMouseMove={(e) => handleMouseMove(e, starIndex)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const isHalf = x < rect.width / 2;
              handleClick(starIndex, isHalf);
            }}
          >
            <svg
              className="absolute inset-0 w-7 h-7 text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fillLevel * 100}%` }}
            >
              <svg
                className="w-7 h-7 text-yellow-400"
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

interface ShowEditModalProps {
  showId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (show: Show) => void;
  onDeleted?: () => void;
}

export default function ShowEditModal({
  showId,
  isOpen,
  onClose,
  onSaved,
  onDeleted
}: ShowEditModalProps) {
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [status, setStatus] = useState<ShowStatus>('watchlist');
  const [watchPreference, setWatchPreference] = useState<WatchPreference | undefined>(undefined);
  const [watchPreferenceNote, setWatchPreferenceNote] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [reviewNote, setReviewNote] = useState('');
  const [notes, setNotes] = useState('');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!isOpen || !showId) return;

    async function fetchShow() {
      setLoading(true);
      setError(null);
      try {
        // Try local API first, then handle Trakt-style IDs
        let response = await fetch(`/api/shows?id=${showId}`);
        if (!response.ok && showId.startsWith('trakt-')) {
          // For Trakt shows, fetch from the shows list and find by ID
          response = await fetch('/api/trakt/shows');
          if (response.ok) {
            const shows = await response.json();
            const found = shows.find((s: Show) => s.id === showId);
            if (found) {
              setShow(found);
              setStatus(found.status);
              setWatchPreference(found.watchPreference);
              setWatchPreferenceNote(found.watchPreferenceNote || '');
              setRating(found.rating);
              setReviewNote(found.reviewNote || '');
              setNotes(found.notes || '');
              setHidden(found.hidden || false);
              setLoading(false);
              return;
            }
          }
          throw new Error('Show not found');
        }
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
        setHidden(data.hidden || false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load show');
      } finally {
        setLoading(false);
      }
    }

    fetchShow();
  }, [showId, isOpen]);

  const saveChanges = async () => {
    if (!show) return;

    setSaving(true);
    try {
      // For Trakt shows, save to overlay; for local shows, save to shows API
      const isTrakt = show.id.startsWith('trakt-');
      const url = isTrakt ? '/api/trakt/shows' : '/api/shows';
      const body = isTrakt
        ? {
            tmdbId: show.tmdbId,
            watchPreference: watchPreference || null,
            watchPreferenceNote: watchPreferenceNote || null,
            rating: rating || null,
            reviewNote: reviewNote || null,
            notes: notes || null,
            hidden
          }
        : {
            id: show.id,
            status,
            watchPreference: watchPreference || null,
            watchPreferenceNote: watchPreferenceNote || null,
            rating: rating || null,
            reviewNote: reviewNote || null,
            notes: notes || null,
            hidden
          };

      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      // Update local show state with changes
      const updated: Show = {
        ...show,
        status,
        watchPreference,
        watchPreferenceNote,
        rating,
        reviewNote,
        notes,
        hidden
      };
      setShow(updated);
      onSaved?.(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const deleteShowHandler = async () => {
    if (!show || !confirm('Are you sure you want to delete this show?')) return;

    try {
      // For Trakt shows, we can't really delete from Trakt, but we can mark as deleted locally
      // The delete endpoint handles adding to deletedShows list
      await fetch(`/api/shows?id=${show.id}&tmdbId=${show.tmdbId}`, { method: 'DELETE' });
      onDeleted?.();
      onClose();
    } catch {
      setError('Failed to delete show');
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error || !show ? (
          <div className="p-8">
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
              <p className="text-red-300">{error || 'Show not found'}</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Header with poster and title */}
            <div className="flex gap-4 mb-6">
              {show.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${show.posterPath}`}
                  alt={show.title}
                  className="w-24 rounded-lg shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-24 aspect-[2/3] bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-500 text-xs text-center px-2">{show.title}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold mb-1 pr-8">{show.title}</h2>
                <div className="text-gray-400 text-sm">
                  {show.year && <span>{show.year}</span>}
                  {show.genres.length > 0 && (
                    <span className="ml-2">• {show.genres.slice(0, 3).join(', ')}</span>
                  )}
                </div>
                {show.streamingServices.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {show.streamingServices.map((service) => (
                      <span key={service} className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                        {service}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-5">
              {/* Status */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ShowStatus)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Watch Preference */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Watch Preference</label>
                <div className="flex gap-2 mb-2">
                  {PREFERENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setWatchPreference(
                        watchPreference === opt.value ? undefined : opt.value
                      )}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
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
                  placeholder="Why this preference? (helps AI learn your taste)"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Rating</label>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Review Note */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Review Note
                  <span className="text-gray-500 ml-1 font-normal">
                    (what you liked/disliked)
                  </span>
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Great pacing, loved the character development..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>

              {/* General Notes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">General Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any other notes..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Hidden Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-gray-400">Hide from list</label>
                  <p className="text-xs text-gray-500">Hidden shows won&apos;t appear in your main list</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHidden(!hidden)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    hidden ? 'bg-yellow-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      hidden ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-gray-700">
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 px-5 py-2 rounded font-medium text-sm"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  onClick={deleteShowHandler}
                  className="text-red-400 hover:text-red-300 px-3 py-2 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
