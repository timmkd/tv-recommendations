'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ImportResult {
  success?: boolean;
  imported?: number;
  updated?: number;
  total?: number;
  errors?: string[];
  error?: string;
}

interface PreviewShow {
  title: string;
  year?: number;
  tmdbId: number;
  status: string;
  personalRating?: number;
}

interface PreviewResult {
  preview: boolean;
  shows: PreviewShow[];
  count: number;
  errors?: string[];
  error?: string;
}

export default function ImportPage() {
  const [traktUsername, setTraktUsername] = useState('timmkd');
  const [watchingContext, setWatchingContext] = useState<'solo' | 'with-wife' | 'both'>('solo');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const handlePreview = async () => {
    if (!traktUsername.trim()) return;

    setPreviewLoading(true);
    setPreview(null);
    setResult(null);

    try {
      const response = await fetch(`/api/trakt?username=${encodeURIComponent(traktUsername)}`);
      const data = await response.json();
      setPreview(data);
    } catch (error) {
      setPreview({ preview: true, shows: [], count: 0, error: 'Failed to preview' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (!traktUsername.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/trakt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: traktUsername, watchingContext })
      });
      const data = await response.json();
      setResult(data);
      setPreview(null);
    } catch (error) {
      setResult({ error: 'Failed to import' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-8 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-8">Import Shows</h1>

        {/* Trakt Import Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-red-500">Trakt</span> Import
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Trakt Username</label>
              <input
                type="text"
                value={traktUsername}
                onChange={(e) => setTraktUsername(e.target.value)}
                placeholder="Enter your Trakt username"
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Default Watching Context</label>
              <select
                value={watchingContext}
                onChange={(e) => setWatchingContext(e.target.value as 'solo' | 'with-wife' | 'both')}
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="solo">Solo</option>
                <option value="with-wife">With Wife</option>
                <option value="both">Both</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                You can change this per show later
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handlePreview}
                disabled={previewLoading || !traktUsername.trim()}
                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-2 rounded font-medium transition-colors"
              >
                {previewLoading ? 'Loading...' : 'Preview'}
              </button>
              <button
                onClick={handleImport}
                disabled={loading || !traktUsername.trim()}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-2 rounded font-medium transition-colors"
              >
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>

        {/* Preview Results */}
        {preview && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">
              Preview: {preview.count} shows found
            </h3>

            {preview.error && (
              <p className="text-red-400 mb-4">{preview.error}</p>
            )}

            {preview.errors && preview.errors.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600 rounded">
                <p className="text-yellow-400 text-sm font-medium mb-1">Warnings:</p>
                <ul className="text-yellow-300 text-xs list-disc list-inside">
                  {preview.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.shows.length > 0 && (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="text-left py-2">Title</th>
                      <th className="text-left py-2">Year</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.shows.map((show, i) => (
                      <tr key={i} className="border-b border-gray-700/50">
                        <td className="py-2">{show.title}</td>
                        <td className="py-2 text-gray-400">{show.year || '-'}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            show.status === 'completed' ? 'bg-green-900 text-green-300' :
                            show.status === 'watching' ? 'bg-blue-900 text-blue-300' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {show.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400">
                          {show.personalRating ? `${show.personalRating}/10` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Import Results */}
        {result && (
          <div className={`rounded-lg p-6 ${result.success ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'}`}>
            {result.success && (result.imported ?? 0) > 0 ? (
              <>
                <h3 className="text-lg font-semibold text-green-400 mb-2">Import Successful!</h3>
                <p className="text-green-300">
                  Imported {result.imported} new shows, updated {result.updated} existing shows.
                </p>
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-4">
                    <p className="text-yellow-400 text-sm">Some issues occurred:</p>
                    <ul className="text-yellow-300 text-xs list-disc list-inside mt-1">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Link
                  href="/recommendations"
                  className="inline-block mt-4 bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-medium"
                >
                  Get Recommendations &rarr;
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-red-400 mb-2">Import Failed</h3>
                <p className="text-red-300 mb-4">{result.error || 'No shows were imported'}</p>
                {result.errors && result.errors.length > 0 && (
                  <ul className="text-red-300 text-sm list-disc list-inside mb-4">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
                {(result.error?.includes('TRAKT_CLIENT_ID') || result.errors?.some(e => e.includes('TRAKT_CLIENT_ID'))) && (
                  <div className="mt-4 p-3 bg-gray-800 rounded text-sm">
                    <p className="text-gray-300 mb-2">To fix this:</p>
                    <ol className="text-gray-400 list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://trakt.tv/oauth/applications" target="_blank" className="text-blue-400 hover:underline">trakt.tv/oauth/applications</a></li>
                      <li>Create a new application (any name, any redirect URL)</li>
                      <li>Copy the <strong>Client ID</strong></li>
                      <li>Add it to your <code className="bg-gray-700 px-1 rounded">.env.local</code> file</li>
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* JustWatch Section (placeholder) */}
        <div className="bg-gray-800 rounded-lg p-6 opacity-50">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-yellow-500">JustWatch</span> Import
            <span className="text-xs bg-gray-700 px-2 py-1 rounded">Coming Soon</span>
          </h2>
          <p className="text-gray-400 text-sm">
            JustWatch import will be added in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
