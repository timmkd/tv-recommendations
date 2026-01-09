import { NextResponse } from 'next/server';

const TRAKT_OAUTH_URL = 'https://trakt.tv/oauth/authorize';

// GET - Redirect to Trakt OAuth
export async function GET() {
  const clientId = process.env.TRAKT_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'TRAKT_CLIENT_ID not configured' },
      { status: 500 }
    );
  }

  // Use the current host for the redirect URI
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/trakt/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const authUrl = `${TRAKT_OAUTH_URL}?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
