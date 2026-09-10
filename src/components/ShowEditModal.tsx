'use client';

import { useState, useEffect } from 'react';
import type { Show, ShowStatus, WatchPreference } from '@/types';

const PREFERENCE_OPTIONS: { value: WatchPreference; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'together', label: 'Together' }
];

// Bingeability: how easily the show is binged - deliberately NOT a measure of quality.
// 1-5 integers only (never 0 - the `|| null` save path treats 0 as unset).
const BINGEABILITY_LABELS: Record<number, string> = {
  5: "Couldn't stop - wanted to keep going",
  4: 'Very easy to keep watching',
  3: 'Easy enough, watched steadily',
  2: 'Needed effort to keep going',
  1: 'A struggle to get into'
};

// Numeric 1-5 selector. Kept visually distinct from StarRating so the two
// scores don't drag toward each other. Label appears on hover or once set.
function BingeabilityRating({
  value,
  onChange
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const [hovered, setHovered] = useState<number | undefined>(undefined);
  const shown = hovered ?? value;

  return (
    <div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(value === n ? undefined : n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(undefined)}
            aria-label={`${n} - ${BINGEABILITY_LABELS[n]}`}
            aria-pressed={value === n}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded text-xs sm:text-sm font-medium transition-colors ${
              value === n
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {n}
          </button>
        ))}
        {value && (
          <button
            onClick={() => onChange(undefined)}
            className="ml-1 text-xs text-gray-500 hover:text-red-400"
            aria-label="Clear bingeability"
          >
            ×
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[10px] sm:text-xs text-gray-400 min-h-[1rem]">
        {shown ? BINGEABILITY_LABELS[shown] : ''}
      </p>
    </div>
  );
}

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
    <div className="flex items-center gap-0.5 sm:gap-1" onMouseLeave={() => setHoverValue(null)}>
      {[0, 1, 2, 3, 4].map((starIndex) => {
        const fillLevel = Math.max(0, Math.min(1, displayValue - starIndex));
        return (
          <div
            key={starIndex}
            className="relative w-5 h-5 sm:w-7 sm:h-7 cursor-pointer"
            onMouseMove={(e) => handleMouseMove(e, starIndex)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const isHalf = x < rect.width / 2;
              handleClick(starIndex, isHalf);
            }}
          >
            <svg
              className="absolute inset-0 w-5 h-5 sm:w-7 sm:h-7 text-gray-600"
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
                className="w-5 h-5 sm:w-7 sm:h-7 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        );
      })}
      <span className="ml-1.5 sm:ml-2 text-xs sm:text-sm text-gray-400">
        {value ? `${value}/5` : 'Not rated'}
      </span>
    </div>
  );
}

interface ShowEditModalProps {
  showId: string;
  initialShow?: Show; // Pass the show directly to avoid re-fetching
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (show: Show) => void;
  onDeleted?: () => void;
}

export default function ShowEditModal({
  showId,
  initialShow,
  isOpen,
  onClose,
  onSaved,
  onDeleted
}: ShowEditModalProps) {
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [status, setStatus] = useState<ShowStatus | undefined>('watchlist');
  const [watchPreference, setWatchPreference] = useState<WatchPreference | undefined>(undefined);
  const [watchPreferenceNote, setWatchPreferenceNote] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [bingeability, setBingeability] = useState<number | undefined>(undefined);
  const [reviewNote, setReviewNote] = useState('');
  const [notes, setNotes] = useState('');
  const [hidden, setHidden] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen || !showId) return;

    // Collapse the overview again for each show opened, not just the first
    setOverviewExpanded(false);

    // If initialShow is provided, use it directly (no fetch needed)
    if (initialShow) {
      setShow(initialShow);
      setStatus(initialShow.status);
      setWatchPreference(initialShow.watchPreference);
      setWatchPreferenceNote(initialShow.watchPreferenceNote || '');
      setRating(initialShow.rating);
      setBingeability(initialShow.bingeability);
      setReviewNote(initialShow.reviewNote || '');
      setNotes(initialShow.notes || '');
      setHidden(initialShow.hidden || false);
      setDropped(initialShow.dropped || false);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchShow() {
      setLoading(true);
      setError(null);
      try {
        // For Trakt/overlay shows, find from the shows list
        if (showId.startsWith('trakt-') || showId.startsWith('overlay-')) {
          const tmdbId = showId.replace(/^(trakt-|overlay-)/, '');

          // Try main Trakt endpoint first (includes new imports), then fallback to overlays
          let found: Show | undefined;

          // First try the full Trakt endpoint
          try {
            const response = await fetch('/api/trakt/shows');
            if (response.ok) {
              const shows = await response.json();
              found = shows.find((s: Show) => s.id === showId || s.tmdbId?.toString() === tmdbId);
            }
          } catch {
            // Trakt failed, try fallback
          }

          // If not found, try fallback (overlays only)
          if (!found) {
            const fallbackResponse = await fetch('/api/trakt/shows?fallback=true');
            if (fallbackResponse.ok) {
              const shows = await fallbackResponse.json();
              found = shows.find((s: Show) => s.id === showId || s.tmdbId?.toString() === tmdbId);
            }
          }

          if (found) {
            setShow(found);
            setStatus(found.status);
            setWatchPreference(found.watchPreference);
            setWatchPreferenceNote(found.watchPreferenceNote || '');
            setRating(found.rating);
            setBingeability(found.bingeability);
            setReviewNote(found.reviewNote || '');
            setNotes(found.notes || '');
            setHidden(found.hidden || false);
            setDropped(found.dropped || false);
            setLoading(false);
            return;
          }
          throw new Error('Show not found');
        }

        // For local shows, try local API
        const response = await fetch(`/api/shows?id=${showId}`);
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
        setDropped(data.dropped || false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load show');
      } finally {
        setLoading(false);
      }
    }

    fetchShow();
  }, [showId, isOpen, initialShow]);

  const saveChanges = async () => {
    if (!show) return;

    setSaving(true);
    try {
      // For Trakt/overlay shows, save to overlay; for local shows, save to shows API
      const isTraktOrOverlay = show.id.startsWith('trakt-') || show.id.startsWith('overlay-');
      const url = isTraktOrOverlay ? '/api/trakt/shows' : '/api/shows';
      const body = isTraktOrOverlay
        ? {
            tmdbId: show.tmdbId,
            watchPreference: watchPreference || null,
            watchPreferenceNote: watchPreferenceNote || null,
            rating: rating || null,
            bingeability: bingeability || null,
            reviewNote: reviewNote || null,
            notes: notes || null,
            hidden,
            dropped
          }
        : {
            id: show.id,
            status,
            watchPreference: watchPreference || null,
            watchPreferenceNote: watchPreferenceNote || null,
            rating: rating || null,
            bingeability: bingeability || null,
            reviewNote: reviewNote || null,
            notes: notes || null,
            hidden,
            dropped
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
        bingeability,
        reviewNote,
        notes,
        hidden,
        dropped
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

  const removeFromWatchlistHandler = async () => {
    if (!show || !confirm('Remove from watchlist? The show data will be kept.')) return;

    setSaving(true);
    try {
      const url = show.id.startsWith('trakt-') || show.id.startsWith('overlay-')
        ? '/api/trakt/shows'
        : '/api/shows';

      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: show.tmdbId,
          id: show.id,
          status: null,
        })
      });

      if (!response.ok) throw new Error('Failed to remove from watchlist');

      const updated: Show = { ...show, status: undefined as unknown as ShowStatus };
      onSaved?.(updated);
      onClose();
    } catch {
      setError('Failed to remove from watchlist');
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

  const syncShow = async () => {
    if (!show?.tmdbId) return;

    setSyncing(true);
    setSyncStatus('Syncing with Trakt...');
    setError(null);

    try {
      const response = await fetch('/api/trakt/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId: show.tmdbId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      // Build status message
      const messages: string[] = [];
      if (data.results.trakt?.success) {
        const t = data.results.trakt;
        messages.push(`Trakt: ${t.completed}/${t.aired} episodes`);
        if (t.addedToWatchlist) messages.push('Added to watchlist');
      }
      if (data.results.tmdb?.success) {
        messages.push('TMDB metadata updated');
      }
      if (data.results.rt?.success && data.results.rt.criticsScore) {
        messages.push(`RT: ${data.results.rt.criticsScore}%`);
      }
      if (data.results.streaming?.success && data.results.streaming.services?.length) {
        messages.push(`Streaming: ${data.results.streaming.services.length} services`);
      }

      setSyncStatus(messages.length > 0 ? messages.join(' • ') : 'Synced successfully');

      // Update status from Trakt progress result
      if (data.results.trakt?.success && data.results.trakt.status) {
        setStatus(data.results.trakt.status);
      }

      // Refresh the show data from Trakt (not fallback, to get fresh data)
      const refreshResponse = await fetch('/api/trakt/shows');
      if (refreshResponse.ok) {
        const shows = await refreshResponse.json();
        const tmdbId = show.tmdbId.toString();
        const updated = shows.find((s: Show) => s.id === show.id || s.tmdbId?.toString() === tmdbId);
        if (updated) {
          setShow(updated);
          setStatus(updated.status);
          onSaved?.(updated);
        }
      }

      // Clear status after a few seconds
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
      setSyncStatus(null);
    } finally {
      setSyncing(false);
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
      <div className="relative bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
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
          <div className="p-4 sm:p-6">
            {/* Header with poster and title */}
            <div className="flex gap-3 sm:gap-4 mb-4 sm:mb-6">
              {show.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${show.posterPath}`}
                  alt={show.title}
                  className="w-16 sm:w-24 rounded-lg shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-16 sm:w-24 aspect-[2/3] bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-500 text-xs text-center px-2">{show.title}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold mb-1 pr-8">{show.title}</h2>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {show.year && <span>{show.year}</span>}
                  {show.numberOfSeasons && (
                    <span className="ml-2">• {show.numberOfSeasons}S</span>
                  )}
                  {show.showStatus && (
                    <span className={`ml-2 px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${
                      show.showStatus === 'Ended' ? 'bg-green-900/50 text-green-300' :
                      show.showStatus === 'Returning Series' ? 'bg-blue-900/50 text-blue-300' :
                      show.showStatus === 'Canceled' ? 'bg-red-900/50 text-red-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {show.showStatus}
                    </span>
                  )}
                </div>
                {show.genres.length > 0 && (
                  <div className="text-gray-500 text-[10px] sm:text-xs mt-1">
                    {show.genres.slice(0, 3).join(' • ')}
                  </div>
                )}
                {show.streamingServices.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 sm:mt-2">
                    {show.streamingServices.slice(0, 4).map((service) => (
                      <span key={service} className="px-1.5 sm:px-2 py-0.5 bg-gray-700 rounded text-[10px] sm:text-xs">
                        {service}
                      </span>
                    ))}
                    {show.streamingServices.length > 4 && (
                      <span className="text-[10px] sm:text-xs text-gray-500">+{show.streamingServices.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Overview - clamped to 3 lines on mobile with a tap to expand, always full on sm+ */}
            {show.overview && (
              <div className="mb-3 sm:mb-5 p-2.5 sm:p-3 bg-gray-800/50 rounded-lg">
                <p className={`text-xs sm:text-sm text-gray-300 leading-relaxed sm:line-clamp-none ${overviewExpanded ? '' : 'line-clamp-3'}`}>
                  {show.overview}
                </p>
                {/* Only worth a toggle when there's actually more than ~3 lines to reveal */}
                {show.overview.length > 140 && (
                  <button
                    type="button"
                    onClick={() => setOverviewExpanded(v => !v)}
                    className="sm:hidden mt-1 text-[11px] text-purple-400 hover:text-purple-300"
                  >
                    {overviewExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            {/* AI Predictions (only show if no user rating/preference set) */}
            {(!rating && show.predictedRating) || (!watchPreference && show.recommendedWatchPreference) || (!bingeability && show.predictedBingeability) ? (
              <div className="mb-3 sm:mb-5 p-2 sm:p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <span className="text-purple-400 text-xs sm:text-sm font-medium">🤖 AI Predictions</span>
                </div>
                <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                  {!rating && show.predictedRating && (
                    <div>
                      <span className="text-yellow-500">~{show.predictedRating}★</span>
                      <span className="text-gray-400 ml-1 sm:ml-2">predicted</span>
                    </div>
                  )}
                  {!bingeability && show.predictedBingeability && (
                    <div>
                      <span className="text-teal-400">~{show.predictedBingeability}/5</span>
                      <span className="text-gray-400 ml-1 sm:ml-2">bingeability</span>
                    </div>
                  )}
                  {!watchPreference && show.recommendedWatchPreference && (
                    <div>
                      <span className={show.recommendedWatchPreference === 'solo' ? 'text-blue-400' : 'text-pink-400'}>
                        {show.recommendedWatchPreference === 'solo' ? 'Solo' : 'Together'}
                      </span>
                      <span className="text-gray-400 ml-1 sm:ml-2">rec.</span>
                    </div>
                  )}
                </div>
                {show.predictedRatingReason && (
                  <p className="text-gray-400 text-[10px] sm:text-xs mt-1 sm:mt-2 italic">
                    &quot;{show.predictedRatingReason}&quot;
                  </p>
                )}
                {!bingeability && show.predictedBingeabilityReason && (
                  <p className="text-teal-300/80 text-[10px] sm:text-xs mt-1 sm:mt-2 italic">
                    &quot;{show.predictedBingeabilityReason}&quot;
                  </p>
                )}
              </div>
            ) : null}

            {/* Editable Fields - Stacks on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Left Column - Your Rating */}
              <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 flex flex-col">
                <h3 className="text-xs sm:text-sm font-medium text-gray-300 border-b border-gray-700 pb-2">Your Rating</h3>

                <div className="flex items-center gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Status</label>
                    <span className={`inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-medium ${
                      status === 'completed' ? 'bg-green-900/50 text-green-300' :
                      status === 'watching' ? 'bg-blue-900/50 text-blue-300' :
                      'bg-yellow-900/50 text-yellow-300'
                    }`}>
                      {status === 'completed' ? 'Completed' :
                       status === 'watching' ? 'Watching' : 'Watchlist'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Rating</label>
                    <div className="flex items-center gap-2">
                      <StarRating value={rating} onChange={setRating} />
                      {rating && (
                        <button
                          onClick={() => setRating(undefined)}
                          className="text-xs text-gray-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">What did you think?</label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Great pacing, loved the characters..."
                    rows={3}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm flex-1 min-h-[60px] sm:min-h-[80px]"
                  />
                </div>
              </div>

              {/* Right Column - Watch Context */}
              <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-medium text-gray-300 border-b border-gray-700 pb-2">Watch Context</h3>

                <div>
                  <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Who watches?</label>
                  <div className="flex gap-2">
                    {PREFERENCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setWatchPreference(
                          watchPreference === opt.value ? undefined : opt.value
                        )}
                        className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${
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
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Why? (helps AI)</label>
                  <textarea
                    value={watchPreferenceNote}
                    onChange={(e) => setWatchPreferenceNote(e.target.value)}
                    placeholder="Too intense for together..."
                    rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any other notes..."
                    rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Bingeability - own card so it reads as a separate axis from the star rating */}
            <div className="mt-3 sm:mt-4 bg-gray-800/50 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-medium text-gray-300 border-b border-gray-700 pb-2 mb-3">
                Bingeability
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-2">
                How easily did it binge? Not how good it was.
              </p>
              <BingeabilityRating value={bingeability} onChange={setBingeability} />
            </div>

            {/* External Scores Reference */}
            {(show.tmdbRating || show.rtCriticsScore || show.rtAudienceScore) && (
              <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-700/50">
                <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-500">
                  <span className="uppercase tracking-wide hidden sm:inline">Public scores:</span>
                  {show.tmdbRating && (
                    <span className="flex items-center gap-0.5 sm:gap-1" title={`TMDB: ${show.tmdbVoteCount?.toLocaleString() || 0} votes`}>
                      <span>⭐</span>
                      <span>{show.tmdbRating.toFixed(1)}</span>
                    </span>
                  )}
                  {show.rtCriticsScore && (
                    <span className="flex items-center gap-0.5 sm:gap-1" title="Rotten Tomatoes Critics">
                      <span>🍅</span>
                      <span>{show.rtCriticsScore}%</span>
                    </span>
                  )}
                  {show.rtAudienceScore && (
                    <span className="flex items-center gap-0.5 sm:gap-1" title="Rotten Tomatoes Audience">
                      <span>🍿</span>
                      <span>{show.rtAudienceScore}%</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-700 space-y-2 sm:space-y-3">
              {/* Toggles Row */}
              <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm">
                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-gray-400 hover:text-gray-300">
                  <button
                    type="button"
                    onClick={() => setHidden(!hidden)}
                    className={`relative inline-flex h-4 sm:h-5 w-7 sm:w-9 items-center rounded-full transition-colors ${
                      hidden ? 'bg-yellow-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-2.5 sm:h-3 w-2.5 sm:w-3 transform rounded-full bg-white transition-transform ${
                        hidden ? 'translate-x-3.5 sm:translate-x-5' : 'translate-x-0.5 sm:translate-x-1'
                      }`}
                    />
                  </button>
                  Hidden
                </label>

                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-gray-400 hover:text-gray-300">
                  <button
                    type="button"
                    onClick={() => setDropped(!dropped)}
                    className={`relative inline-flex h-4 sm:h-5 w-7 sm:w-9 items-center rounded-full transition-colors ${
                      dropped ? 'bg-red-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-2.5 sm:h-3 w-2.5 sm:w-3 transform rounded-full bg-white transition-transform ${
                        dropped ? 'translate-x-3.5 sm:translate-x-5' : 'translate-x-0.5 sm:translate-x-1'
                      }`}
                    />
                  </button>
                  Dropped
                </label>
              </div>

              {/* Sync Status */}
              {syncStatus && (
                <div className="text-xs sm:text-sm text-green-400 bg-green-900/30 px-2 sm:px-3 py-1.5 sm:py-2 rounded">
                  {syncStatus}
                </div>
              )}

              {/* Actions Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <button
                    onClick={deleteShowHandler}
                    className="text-gray-500 hover:text-red-400 text-xs sm:text-sm transition-colors"
                  >
                    Delete
                  </button>
                  {status === 'watchlist' && (
                    <button
                      onClick={removeFromWatchlistHandler}
                      disabled={saving}
                      className="text-gray-500 hover:text-amber-400 text-xs sm:text-sm transition-colors disabled:text-gray-600"
                    >
                      Remove from Watchlist
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={syncShow}
                    disabled={syncing || saving}
                    className="text-gray-400 hover:text-white disabled:text-gray-600 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-600 hover:border-gray-500 disabled:border-gray-700 rounded transition-colors"
                    title="Sync with Trakt, refresh TMDB, RT scores, and streaming"
                  >
                    {syncing ? 'Syncing...' : 'Sync'}
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={saving || syncing}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 px-3 sm:px-5 py-1.5 sm:py-2 rounded font-medium text-xs sm:text-sm"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
