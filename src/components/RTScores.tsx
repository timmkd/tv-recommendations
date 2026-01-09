'use client';

import { useState, useEffect } from 'react';

interface RTScoresProps {
  showId?: string;
  title?: string;
  year?: number;
  criticsScore?: number;
  audienceScore?: number;
  size?: 'sm' | 'md';
  autoFetch?: boolean;
  showLink?: boolean;
}

// Generate RT URL from show title
function getRTUrl(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
  return `https://www.rottentomatoes.com/tv/${slug}`;
}

export default function RTScores({
  showId,
  title,
  year,
  criticsScore: initialCritics,
  audienceScore: initialAudience,
  size = 'sm',
  autoFetch = false,
  showLink = true
}: RTScoresProps) {
  const [criticsScore, setCriticsScore] = useState<number | undefined>(initialCritics);
  const [audienceScore, setAudienceScore] = useState<number | undefined>(initialAudience);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    // Update if props change
    setCriticsScore(initialCritics);
    setAudienceScore(initialAudience);
  }, [initialCritics, initialAudience]);

  useEffect(() => {
    // Auto-fetch if enabled and no scores
    if (autoFetch && !criticsScore && !audienceScore && !fetched && !loading) {
      fetchRatings();
    }
  }, [autoFetch, criticsScore, audienceScore, fetched, loading]);

  const fetchRatings = async () => {
    if (loading || fetched) return;

    setLoading(true);
    try {
      let url = '/api/ratings?';
      if (showId) {
        url += `id=${showId}`;
      } else if (title) {
        url += `title=${encodeURIComponent(title)}`;
        if (year) url += `&year=${year}`;
      } else {
        return;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.criticsScore) setCriticsScore(data.criticsScore);
        if (data.audienceScore) setAudienceScore(data.audienceScore);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  const hasScores = criticsScore || audienceScore;

  if (loading) {
    return (
      <div className={`flex gap-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        <span className="text-gray-500">Loading RT...</span>
      </div>
    );
  }

  if (!hasScores) {
    return null;
  }

  const sizeClasses = size === 'sm'
    ? 'text-xs gap-1.5'
    : 'text-sm gap-2';

  const rtUrl = title ? getRTUrl(title) : undefined;
  const canLink = showLink && rtUrl;

  const content = (
    <>
      {criticsScore !== undefined && (
        <div className="flex items-center gap-0.5" title="Tomatometer (Critics)">
          <span className={criticsScore >= 60 ? 'text-red-400' : 'text-green-400'}>
            {criticsScore >= 60 ? '🍅' : '🟢'}
          </span>
          <span className="text-gray-300">{criticsScore}%</span>
        </div>
      )}
      {audienceScore !== undefined && (
        <div className="flex items-center gap-0.5" title="Popcornmeter (Audience)">
          <span>🍿</span>
          <span className="text-gray-300">{audienceScore}%</span>
        </div>
      )}
    </>
  );

  if (canLink) {
    return (
      <a
        href={rtUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`flex items-center ${sizeClasses} hover:opacity-80 transition-opacity`}
        title="View on Rotten Tomatoes"
      >
        {content}
      </a>
    );
  }

  return (
    <div className={`flex items-center ${sizeClasses}`}>
      {content}
    </div>
  );
}
