import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/data';
import type { TraktAuth } from '@/types';

const TRAKT_TOKEN_URL = 'https://api.trakt.tv/oauth/token';
const TRAKT_API_URL = 'https://api.trakt.tv';

// GET - Handle OAuth callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/settings?error=oauth_denied', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url));
  }

  const clientId = process.env.TRAKT_CLIENT_ID;
  const clientSecret = process.env.TRAKT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?error=missing_credentials', request.url));
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/trakt/callback`;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(TRAKT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url));
    }

    const tokenData = await tokenResponse.json();

    // Get user info to get username
    const userResponse = await fetch(`${TRAKT_API_URL}/users/me`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      },
    });

    let username = '';
    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.username;
    }

    // Save tokens to settings
    const settings = await getSettings();

    const traktAuth: TraktAuth = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
      createdAt: tokenData.created_at || Math.floor(Date.now() / 1000),
    };

    settings.traktAuth = traktAuth;
    if (username) {
      settings.traktUsername = username;
    }

    await saveSettings(settings);

    return NextResponse.redirect(new URL('/settings?success=trakt_connected', request.url));
  } catch (err) {
    console.error('OAuth error:', err);
    return NextResponse.redirect(new URL('/settings?error=oauth_error', request.url));
  }
}
