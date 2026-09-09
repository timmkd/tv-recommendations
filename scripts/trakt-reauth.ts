/**
 * Re-authenticate with Trakt using the OAuth DEVICE flow.
 *
 * Use this when the stored token has expired AND the refresh token is rejected
 * ("session not found" / invalid_grant), which means the app authorization was
 * revoked on Trakt's side and can no longer be refreshed.
 *
 * Why device flow rather than the app's /api/auth/trakt redirect route:
 *   - no dev server needed (nothing has to receive a callback)
 *   - no dependency on the redirect URI being registered on the Trakt app
 * You get a short code to type in at trakt.tv/activate.
 *
 * Tokens are saved to the same `settings.traktAuth` the app uses, so this fixes
 * production too (settings live in the shared Turso DB).
 *
 * Run with: npx tsx scripts/trakt-reauth.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getSettings, saveSettings } = require('../src/lib/db/queries');

const TRAKT_API = 'https://api.trakt.tv';
// Trakt sits behind Cloudflare and 403s requests without a User-Agent.
// Matches the UA used in src/lib/trakt.ts.
const UA = 'tv-recommendations/1.0';

async function main() {
  const clientId = process.env.TRAKT_CLIENT_ID;
  const clientSecret = process.env.TRAKT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('RESULT: FAIL — TRAKT_CLIENT_ID / TRAKT_CLIENT_SECRET missing from .env.local');
    process.exit(1);
  }

  // 1. Ask Trakt for a device code
  const codeRes = await fetch(`${TRAKT_API}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ client_id: clientId }),
  });

  if (!codeRes.ok) {
    console.error(`RESULT: FAIL — device/code returned ${codeRes.status}: ${await codeRes.text()}`);
    process.exit(1);
  }

  const { device_code, user_code, verification_url, expires_in, interval } = await codeRes.json();

  console.log('\n========================================');
  console.log('  GO TO:   ' + verification_url);
  console.log('  ENTER:   ' + user_code);
  console.log('========================================');
  console.log(`(code valid for ${Math.floor(expires_in / 60)} minutes)\n`);
  console.log('Waiting for you to authorize...');

  // 2. Poll for the token
  const pollEvery = (interval || 5) * 1000;
  const deadline = Date.now() + expires_in * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollEvery));

    const tokenRes = await fetch(`${TRAKT_API}/oauth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({
        code: device_code,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    // 400 = still pending, 404 = bad code, 409 = already used, 410 = expired,
    // 418 = denied by user, 429 = polling too fast
    if (tokenRes.status === 400) {
      process.stdout.write('.');
      continue;
    }
    if (tokenRes.status === 429) {
      await new Promise((r) => setTimeout(r, pollEvery));
      continue;
    }
    if (tokenRes.status === 418) {
      console.error('\nRESULT: FAIL — you denied the authorization request');
      process.exit(1);
    }
    if (tokenRes.status === 410) {
      console.error('\nRESULT: FAIL — the code expired; run the script again');
      process.exit(1);
    }
    if (!tokenRes.ok) {
      console.error(`\nRESULT: FAIL — device/token returned ${tokenRes.status}: ${await tokenRes.text()}`);
      process.exit(1);
    }

    const data = await tokenRes.json();

    // 3. Look up the username with the fresh token
    let username = '';
    const meRes = await fetch(`${TRAKT_API}/users/me`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Authorization: `Bearer ${data.access_token}`,
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      },
    });
    if (meRes.ok) {
      username = (await meRes.json()).username;
    }

    // 4. Save to the same place the app's OAuth callback writes
    const settings = await getSettings();
    settings.traktAuth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      createdAt: data.created_at || Math.floor(Date.now() / 1000),
    };
    if (username) settings.traktUsername = username;
    await saveSettings(settings);

    const days = Math.floor(data.expires_in / 86400);
    console.log(`\n\nSUMMARY: authorized as ${username || '(unknown user)'}; token valid ${days} days`);
    console.log('RESULT: OK');
    process.exit(0);
  }

  console.error('\nRESULT: FAIL — timed out waiting for authorization');
  process.exit(1);
}

main().catch((e) => {
  console.error('RESULT: FAIL —', e);
  process.exit(1);
});
