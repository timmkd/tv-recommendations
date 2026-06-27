import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import RecommendationsList from './RecommendationsList';

export const dynamic = 'force-dynamic';

export interface Recommendation {
  title: string;
  year?: number;
  tmdbId?: number;
  posterPath?: string;
  reason: string;
  streamingServices: string[];
  confidence: 'high' | 'medium' | 'low';
  predictedRating?: number; // 0.5 to 5 in 0.5 increments - what I think you'll rate it
}

interface TasteProfile {
  summary: string;
  loves: string[];
  avoids: string[];
  topShows: string[];
}

interface RecommendationsData {
  generatedAt: string;
  subscribedServices?: string[];
  soloProfile?: TasteProfile;
  togetherProfile?: TasteProfile;
  solo: Recommendation[];
  together: Recommendation[];
  'with-wife'?: Recommendation[]; // Legacy support
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-900 text-green-300',
  medium: 'bg-yellow-900 text-yellow-300',
  low: 'bg-gray-700 text-gray-300'
};

const SERVICE_COLORS: Record<string, string> = {
  netflix: 'bg-red-600',
  stan: 'bg-blue-700',
  binge: 'bg-orange-600',
  'disney-plus': 'bg-blue-600',
  'prime-video': 'bg-cyan-600',
  'paramount-plus': 'bg-blue-500',
  'apple-tv-plus': 'bg-gray-600',
  'hbo-max': 'bg-purple-600',
  'abc-iview': 'bg-green-600',
  'sbs-on-demand': 'bg-red-700',
  'ten-play': 'bg-blue-500'
};

const SERVICE_NAMES: Record<string, string> = {
  netflix: 'Netflix',
  stan: 'Stan',
  binge: 'Binge',
  'disney-plus': 'Disney+',
  'prime-video': 'Prime Video',
  'paramount-plus': 'Paramount+',
  'apple-tv-plus': 'Apple TV+',
  'hbo-max': 'HBO Max',
  'abc-iview': 'ABC iview',
  'sbs-on-demand': 'SBS On Demand',
  'ten-play': '10 Play'
};

async function getRecommendations(): Promise<RecommendationsData | null> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'recommendations.json');
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export default async function RecommendationsPage({
  searchParams
}: {
  searchParams: Promise<{ context?: string }>
}) {
  const params = await searchParams;
  const context = (params.context || 'solo') as 'solo' | 'together';
  const data = await getRecommendations();

  // Support both 'together' and legacy 'with-wife' keys
  const togetherRecs = data?.together || data?.['with-wife'] || [];
  const recommendations = context === 'solo' ? (data?.solo || []) : togetherRecs;
  const tasteProfile = context === 'solo' ? data?.soloProfile : data?.togetherProfile;
  const generatedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleDateString() : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Recommendations</h1>
          <p className="text-gray-400">Personalized suggestions based on your taste</p>
          {generatedAt && (
            <p className="text-gray-500 text-sm mt-1">Last updated: {generatedAt}</p>
          )}
        </header>

        {/* Context Selector */}
        <div className="mb-8">
          <div className="flex gap-2">
            <Link
              href="/recommendations?context=solo"
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                context === 'solo'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Solo Watching
            </Link>
            <Link
              href="/recommendations?context=together"
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                context === 'together'
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Together
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {context === 'solo'
              ? 'Recommendations for watching alone - can include intense or niche shows'
              : 'Recommendations for watching together - curated for shared enjoyment'}
          </p>
        </div>

        {/* Recommendations Grid */}
        {recommendations.length > 0 ? (
          <RecommendationsList
            recommendations={recommendations}
            context={context}
            confidenceStyles={CONFIDENCE_STYLES}
            serviceColors={SERVICE_COLORS}
            serviceNames={SERVICE_NAMES}
          />
        ) : (
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <p className="text-gray-400 mb-4">No recommendations available yet.</p>
            <p className="text-gray-500 text-sm">
              Ask Claude to generate recommendations based on your shows!
            </p>
          </div>
        )}

        {/* Taste Profile */}
        {tasteProfile && (
          <div className="mt-8 bg-gray-800 rounded-lg p-5">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">
              {context === 'solo' ? 'Your Solo' : 'Your Together'} Taste Profile
            </h2>
            <p className="text-gray-300 mb-4">{tasteProfile.summary}</p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-sm font-medium text-green-400 mb-2">What you love</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  {tasteProfile.loves.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-500">+</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-400 mb-2">What to avoid</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  {tasteProfile.avoids.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-500">-</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-yellow-400 mb-2">Top rated shows informing these recommendations</h3>
              <p className="text-sm text-gray-400">{tasteProfile.topShows.join(' • ')}</p>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-800 rounded-lg text-sm text-gray-400">
          <p>
            <strong>Want fresh recommendations?</strong> Ask Claude in your terminal to analyze your shows and update the recommendations file.
          </p>
        </div>
      </div>
    </div>
  );
}
