'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Show, Settings } from '@/types';

export default function Home() {
  const [shows, setShows] = useState<Show[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [showsRes, settingsRes] = await Promise.all([
          fetch('/api/trakt/shows'),
          fetch('/api/settings')
        ]);

        if (showsRes.ok) {
          setShows(await showsRes.json());
        }
        if (settingsRes.ok) {
          setSettings(await settingsRes.json());
        }
      } catch {
        // Keep defaults
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const watchingCount = shows.filter(s => s.status === 'watching').length;
  const completedCount = shows.filter(s => s.status === 'completed').length;
  const watchlistCount = shows.filter(s => s.status === 'watchlist').length;
  const subscribedServices = settings?.streamingServices.filter(s => s.isSubscribed).length ?? 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-8">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">TV Recommendations</h1>
          <p className="text-gray-400">Track shows, get personalized recommendations</p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-400">{loading ? '-' : watchingCount}</div>
            <div className="text-gray-400 text-sm">Watching</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">{loading ? '-' : completedCount}</div>
            <div className="text-gray-400 text-sm">Completed</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{loading ? '-' : watchlistCount}</div>
            <div className="text-gray-400 text-sm">Watchlist</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-purple-400">{loading ? '-' : subscribedServices}</div>
            <div className="text-gray-400 text-sm">Services</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Link
            href="/shows"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg p-6 transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">My Shows</h2>
            <p className="text-blue-200 text-sm">Browse and manage your tracked shows</p>
          </Link>

          <Link
            href="/recommendations"
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-lg p-6 transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">Get Recommendations</h2>
            <p className="text-green-200 text-sm">AI-powered suggestions based on your taste</p>
          </Link>

          <Link
            href="/settings"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">Settings</h2>
            <p className="text-gray-400 text-sm">Manage streaming services and Trakt connection</p>
          </Link>

          <Link
            href="/add"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">Add Show</h2>
            <p className="text-gray-400 text-sm">Search and add shows to your watchlist</p>
          </Link>
        </div>

        {/* Recent Shows */}
        {!loading && shows.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Recently Updated</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {shows
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .slice(0, 8)
                .map(show => (
                  <Link
                    key={show.id}
                    href="/shows"
                    className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                  >
                    {show.posterPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w342${show.posterPath}`}
                        alt={show.title}
                        className="w-full aspect-[2/3] object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center">
                        <span className="text-gray-500 text-xs text-center px-2">{show.title}</span>
                      </div>
                    )}
                    <div className="p-2">
                      <div className="text-sm font-medium truncate">{show.title}</div>
                      <div className="text-xs text-gray-400">{show.year}</div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}

        {!loading && shows.length === 0 && (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">No shows yet</h2>
            <p className="text-gray-400 mb-6">Connect your Trakt account in Settings to sync your shows</p>
            <Link
              href="/settings"
              className="inline-block bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg font-medium"
            >
              Go to Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
