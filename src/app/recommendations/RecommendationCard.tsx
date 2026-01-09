'use client';

import { useState } from 'react';
import type { Recommendation } from './page';
import RTScores from '@/components/RTScores';

interface RecommendationCardProps {
  recommendation: Recommendation;
  context: 'solo' | 'together';
  confidenceStyles: Record<string, string>;
  serviceColors: Record<string, string>;
  serviceNames: Record<string, string>;
  onEditRequest?: (showId: string) => void;
}

export default function RecommendationCard({
  recommendation: rec,
  context,
  confidenceStyles,
  serviceColors,
  serviceNames,
  onEditRequest
}: RecommendationCardProps) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedShowId, setSavedShowId] = useState<string | null>(null);

  const handleAddToWatchlist = async () => {
    if (!rec.tmdbId) {
      alert('This recommendation needs a TMDB ID to add to watchlist. Ask Claude to update the recommendations with TMDB IDs.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: rec.tmdbId,
          title: rec.title,
          year: rec.year,
          status: 'watchlist',
          watchPreference: context,
          notes: notes || undefined
        })
      });

      if (response.ok) {
        const addedShow = await response.json();
        setSaved(true);
        setSavedShowId(addedShow.id);
        setShowNotes(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add show');
      }
    } catch {
      alert('Failed to add show to watchlist');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    if (savedShowId && onEditRequest) {
      onEditRequest(savedShowId);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all">
      <div className="flex">
        {/* Poster */}
        <div className="flex-shrink-0 w-28 min-h-[168px]">
          {rec.posterPath ? (
            <img
              src={`https://image.tmdb.org/t/p/w342${rec.posterPath}`}
              alt={rec.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
              <span className="text-gray-500 text-xs text-center px-2">{rec.title}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-lg font-semibold">
                {rec.title}
                {rec.year && <span className="text-gray-400 font-normal ml-2">({rec.year})</span>}
              </h3>
              {rec.predictedRating && (
                <div className="text-sm text-yellow-400 mt-0.5">
                  Predicted: {rec.predictedRating}★
                </div>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ml-2 ${confidenceStyles[rec.confidence]}`}>
              {rec.confidence}
            </span>
          </div>

          <div className="mb-2">
            <RTScores
              title={rec.title}
              year={rec.year}
              size="sm"
              autoFetch={true}
            />
          </div>

          <p className="text-gray-300 text-sm mb-3 line-clamp-3">{rec.reason}</p>

          {rec.streamingServices.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {rec.streamingServices.map((service) => (
                <span
                  key={service}
                  className={`px-2 py-0.5 rounded text-xs ${serviceColors[service] || 'bg-gray-600'}`}
                >
                  {serviceNames[service] || service}
                </span>
              ))}
            </div>
          )}

          {/* Notes & Add to Watchlist */}
          {!saved ? (
            <>
              {showNotes ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this show..."
                    rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddToWatchlist}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 px-3 py-1 rounded text-sm"
                    >
                      {saving ? 'Adding...' : 'Add to Watchlist'}
                    </button>
                    <button
                      onClick={() => setShowNotes(false)}
                      className="text-gray-400 hover:text-gray-300 px-2 py-1 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => rec.tmdbId ? setShowNotes(true) : handleAddToWatchlist()}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  + Add to Watchlist
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-sm">Added to watchlist</span>
              {savedShowId && onEditRequest && (
                <button
                  onClick={handleEdit}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Edit ratings/notes
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
