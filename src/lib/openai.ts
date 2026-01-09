import OpenAI from 'openai';
import type { Show, WatchPreference, Recommendation } from '@/types';

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

interface RecommendationRequest {
  shows: Show[];
  preference: WatchPreference | 'any';
  subscribedServices: string[];
  count?: number;
}

export async function getRecommendations(request: RecommendationRequest): Promise<Recommendation[]> {
  const { shows, preference, subscribedServices, count = 5 } = request;
  const openai = getOpenAIClient();

  // Filter shows by watch preference
  const relevantShows = preference === 'any'
    ? shows
    : shows.filter(s => s.watchPreference === preference);

  // Get highly rated and completed shows for better recommendations
  const likedShows = relevantShows
    .filter(s => s.status === 'completed' || (s.rating && s.rating >= 4))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  if (likedShows.length === 0) {
    return [];
  }

  // Build the prompt with rich context from notes
  const showsList = likedShows.map(s => {
    let desc = `- "${s.title}" (${s.year || 'Unknown year'})`;
    if (s.genres.length > 0) desc += ` - ${s.genres.join(', ')}`;
    if (s.rating) desc += ` - ${s.rating}/5 stars`;
    if (s.watchPreferenceNote) desc += `\n  Preference note: "${s.watchPreferenceNote}"`;
    if (s.reviewNote) desc += `\n  Review: "${s.reviewNote}"`;
    return desc;
  }).join('\n');

  const preferenceDescription = preference === 'solo'
    ? 'watching alone (can be intense, complex, or niche shows)'
    : preference === 'together'
    ? 'watching with spouse (should be enjoyable for both)'
    : 'general viewing';

  const servicesText = subscribedServices.length > 0
    ? `Available streaming services: ${subscribedServices.join(', ')}`
    : 'No specific streaming service preference';

  const prompt = `You are a TV show recommendation expert. Based on the user's viewing history and preferences, suggest ${count} TV shows they might enjoy.

User's liked/completed shows:
${showsList}

Viewing context: ${preferenceDescription}
${servicesText}

Please recommend ${count} TV shows that:
1. Match the user's apparent taste based on their history and review notes
2. Are suitable for the viewing context described
3. Are ideally available on the mentioned streaming services (but include great shows even if availability is unknown)
4. Are NOT already in their watched list

For each recommendation, provide:
- The exact title
- A brief reason why they'd enjoy it (reference specific shows from their history)
- Which streaming service(s) it's likely available on in Australia
- Your confidence level (high/medium/low)

Respond in JSON format:
{
  "recommendations": [
    {
      "title": "Show Title",
      "reason": "Brief explanation referencing their history",
      "streamingServices": ["netflix", "stan"],
      "confidence": "high"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful TV show recommendation assistant. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed.recommendations || [];
  } catch (error) {
    console.error('OpenAI recommendation error:', error);
    throw error;
  }
}

// Get a quick summary of why the user might like a specific show
export async function getShowInsight(show: Show, userShows: Show[]): Promise<string> {
  const openai = getOpenAIClient();

  const similarShows = userShows
    .filter(s => s.status === 'completed' && s.rating && s.rating >= 4)
    .slice(0, 10)
    .map(s => s.title)
    .join(', ');

  const prompt = `Based on someone who enjoyed these shows: ${similarShows}

Would they likely enjoy "${show.title}" (${show.year})?
${show.genres.length > 0 ? `Genres: ${show.genres.join(', ')}` : ''}

Provide a brief (1-2 sentence) insight on whether this show matches their taste.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150
    });

    return response.choices[0]?.message?.content || 'Unable to generate insight.';
  } catch {
    return 'Unable to generate insight.';
  }
}
