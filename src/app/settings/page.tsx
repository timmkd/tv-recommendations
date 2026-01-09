'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Settings, StreamingService } from '@/types';

function SettingsContent() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Check for OAuth callback messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'trakt_connected') {
      setMessage({ type: 'success', text: 'Successfully connected to Trakt!' });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: 'OAuth authorization was denied',
        no_code: 'No authorization code received',
        missing_credentials: 'Missing Trakt credentials in environment',
        token_exchange_failed: 'Failed to exchange token',
        oauth_error: 'OAuth error occurred',
      };
      setMessage({ type: 'error', text: errorMessages[error] || 'An error occurred' });
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        setSettings(data);
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const toggleService = (slug: string) => {
    if (!settings) return;

    setSettings({
      ...settings,
      streamingServices: settings.streamingServices.map((s) =>
        s.slug === slug ? { ...s, isSubscribed: !s.isSubscribed } : s
      )
    });
    setSaved(false);
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setSaved(true);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const disconnectTrakt = async () => {
    if (!settings) return;

    try {
      const updatedSettings = { ...settings, traktAuth: undefined };
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      setSettings(updatedSettings);
      setMessage({ type: 'success', text: 'Disconnected from Trakt' });
    } catch (e) {
      console.error('Failed to disconnect:', e);
      setMessage({ type: 'error', text: 'Failed to disconnect from Trakt' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-8 inline-block">
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        {/* Streaming Services */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Streaming Services</h2>
          <p className="text-gray-400 text-sm mb-4">
            Select the services you&apos;re currently subscribed to. This helps with recommendations.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {settings?.streamingServices.map((service) => (
              <button
                key={service.slug}
                onClick={() => toggleService(service.slug)}
                className={`p-3 rounded-lg text-left transition-all ${
                  service.isSubscribed
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">{service.name}</div>
                <div className="text-xs text-gray-300">
                  {service.isSubscribed ? 'Subscribed' : 'Not subscribed'}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="mt-6 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 px-6 py-2 rounded font-medium w-full"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* API Keys Info */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">API Keys</h2>
          <p className="text-gray-400 text-sm mb-4">
            API keys are configured in your <code className="bg-gray-700 px-1 rounded">.env.local</code> file.
          </p>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
              <span>TMDB API Key</span>
              <span className="text-green-400">Required for search</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
              <span>OpenAI API Key</span>
              <span className="text-green-400">Required for recommendations</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-700 rounded text-sm text-gray-400">
            <p className="font-medium mb-1">Example .env.local:</p>
            <code className="block">
              TMDB_API_KEY=your_tmdb_key<br />
              OPENAI_API_KEY=your_openai_key
            </code>
          </div>
        </div>

        {/* Trakt Info */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Trakt</h2>

          {message && (
            <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
              <div>
                <span className="font-medium">Username</span>
                <p className="text-sm text-gray-400">{settings?.traktUsername || 'Not set'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
              <div>
                <span className="font-medium">Connection Status</span>
                <p className="text-sm text-gray-400">
                  {settings?.traktAuth ? (
                    <span className="text-green-400">Connected (accurate watch progress enabled)</span>
                  ) : (
                    <span className="text-yellow-400">Not connected (using public data only)</span>
                  )}
                </p>
              </div>
              {settings?.traktAuth ? (
                <button
                  onClick={disconnectTrakt}
                  className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm font-medium"
                >
                  Disconnect
                </button>
              ) : (
                <a
                  href="/api/auth/trakt"
                  className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm font-medium"
                >
                  Connect to Trakt
                </a>
              )}
            </div>

            <p className="text-sm text-gray-500">
              Connecting to Trakt enables accurate &quot;watching&quot; vs &quot;completed&quot; status by checking your episode progress.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-700">
            <Link
              href="/import"
              className="inline-block bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded font-medium"
            >
              Import from Trakt
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
