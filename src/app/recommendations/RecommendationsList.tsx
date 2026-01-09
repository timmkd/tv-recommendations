'use client';

import { useState } from 'react';
import type { Recommendation } from './page';
import RecommendationCard from './RecommendationCard';
import ShowEditModal from '@/components/ShowEditModal';

interface RecommendationsListProps {
  recommendations: Recommendation[];
  context: 'solo' | 'together';
  confidenceStyles: Record<string, string>;
  serviceColors: Record<string, string>;
  serviceNames: Record<string, string>;
}

export default function RecommendationsList({
  recommendations,
  context,
  confidenceStyles,
  serviceColors,
  serviceNames
}: RecommendationsListProps) {
  const [editingShowId, setEditingShowId] = useState<string | null>(null);

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        {recommendations.map((rec, index) => (
          <RecommendationCard
            key={index}
            recommendation={rec}
            context={context}
            confidenceStyles={confidenceStyles}
            serviceColors={serviceColors}
            serviceNames={serviceNames}
            onEditRequest={(showId) => setEditingShowId(showId)}
          />
        ))}
      </div>

      {/* Edit Modal */}
      {editingShowId && (
        <ShowEditModal
          showId={editingShowId}
          isOpen={!!editingShowId}
          onClose={() => setEditingShowId(null)}
        />
      )}
    </>
  );
}
