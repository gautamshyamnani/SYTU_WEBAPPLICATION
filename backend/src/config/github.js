const crypto = require('crypto');

// ─── GitHub OAuth Config ─────────────────────────────────────────────────────
const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL  = process.env.GITHUB_CALLBACK_URL ||
                             'http://localhost:5000/api/auth/github/callback';

// GitHub API base
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';

/**
 * Build the GitHub authorization URL.
 * We request `user:email` scope so we can fetch the user's email
 * even if it's set to private on their GitHub profile.
 */
const buildGitHubAuthURL = (state) => {
  const params = new URLSearchParams({
    client_id:    GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope:        'user:email read:user',
    state,          // CSRF protection
    allow_signup: 'true',
  });
  return `${GITHUB_OAUTH_URL}?${params.toString()}`;
};

/**
 * Exchange the temporary `code` for a GitHub access token.
 * Returns the raw access token string, or throws on failure.
 */
const exchangeCodeForToken = async (code) => {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id:     GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri:  GITHUB_CALLBACK_URL,
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`GitHub token exchange failed: ${data.error_description || data.error}`);
  }

  return data.access_token;
};

/**
 * Fetch the authenticated user's GitHub profile.
 */
const fetchGitHubUser = async (accessToken) => {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`GitHub user fetch failed: ${errBody.message || res.status}`);
  }

  return res.json();
};

/**
 * Fetch the authenticated user's verified emails from GitHub.
 * Falls back gracefully if the scope is unavailable.
 */
const fetchGitHubEmails = async (accessToken) => {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/user/emails`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) return [];

    const emails = await res.json();
    // Return the primary, verified email — most reliable
    const primary = emails.find((e) => e.primary && e.verified);
    return primary ? primary.email : null;
  } catch {
    return null;
  }
};

/**
 * Fetch up to `perPage` repos for the authenticated user.
 * Paginates through all pages.
 */
const fetchGitHubRepos = async (accessToken, perPage = 100) => {
  const allRepos = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${GITHUB_API_BASE}/user/repos?per_page=${perPage}&page=${page}&sort=updated&type=all`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    // Handle rate limits gracefully
    if (res.status === 403 || res.status === 429) {
      const resetAt = res.headers.get('X-RateLimit-Reset');
      throw new RateLimitError(
        'GitHub API rate limit exceeded',
        resetAt ? new Date(parseInt(resetAt, 10) * 1000) : null
      );
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`GitHub repo fetch failed: ${errBody.message || res.status}`);
    }

    const repos = await res.json();
    if (!repos.length) break;

    allRepos.push(...repos);
    if (repos.length < perPage) break; // last page
    page++;
  }

  return allRepos;
};

// ─── Encryption helpers for stored access tokens ─────────────────────────────
// AES-256-GCM — authenticated encryption, prevents tampering
const ALGO       = 'aes-256-gcm';
const KEY_BASE   = process.env.GITHUB_TOKEN_ENC_KEY || process.env.JWT_SECRET || 'fallback-key';
// Derive a 32-byte key regardless of the input length
const ENC_KEY    = crypto.scryptSync(KEY_BASE, 'gh-token-salt', 32);

const encryptToken = (plaintext) => {
  if (!plaintext) return null;
  const iv         = crypto.randomBytes(12);
  const cipher     = crypto.createCipheriv(ALGO, ENC_KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  // iv (12) + authTag (16) + ciphertext — all base64-encoded
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

const decryptToken = (ciphertext) => {
  if (!ciphertext) return null;
  try {
    const buf       = Buffer.from(ciphertext, 'base64');
    const iv        = buf.subarray(0, 12);
    const authTag   = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher  = crypto.createDecipheriv(ALGO, ENC_KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null; // tampered or key-mismatch — treat as invalid
  }
};

// ─── Custom error for rate limiting ──────────────────────────────────────────
class RateLimitError extends Error {
  constructor(message, resetAt) {
    super(message);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

module.exports = {
  buildGitHubAuthURL,
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchGitHubEmails,
  fetchGitHubRepos,
  encryptToken,
  decryptToken,
  RateLimitError,
};
