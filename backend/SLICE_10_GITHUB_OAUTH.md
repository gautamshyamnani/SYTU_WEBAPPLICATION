# Slice 10 — GitHub OAuth + Repo Sync

## What was added

### New files
| File | Purpose |
|---|---|
| `src/config/github.js` | GitHub API helpers (OAuth URL, token exchange, user/repo fetch, AES-256-GCM token encryption) |
| `src/controllers/githubAuthController.js` | OAuth redirect + callback: login/register via GitHub |
| `src/controllers/githubRepoController.js` | Get repos (paginated), force-fresh sync, connection status |
| `src/routes/githubAuth.js` | `GET /api/auth/github` + `GET /api/auth/github/callback` |
| `src/routes/github.js` | `GET /api/github/status`, `GET /api/github/repos`, `POST /api/github/sync` |
| `src/queues/githubSync.queue.js` | BullMQ queue for async repo sync jobs |
| `src/workers/githubSync.worker.js` | Worker that fetches+upserts repos from GitHub API |
| `src/models/Repo.js` | MongoDB model for synced repos |

### Modified files
| File | Change |
|---|---|
| `src/models/User.js` | Added `githubId`, `githubUsername`, `githubProfileUrl`, `githubAccessToken` (encrypted), `githubTokenExpiry`. Made `email`/`password` non-required to support GitHub-only users |
| `src/app.js` | Mounted `githubAuth` and `github` routes |
| `src/server.js` | Booted `githubSync.worker` on startup |
| `.env.example` | Added `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `GITHUB_TOKEN_ENC_KEY` |

---

## Environment variables to add

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
GITHUB_TOKEN_ENC_KEY=some_long_random_string_32_chars_min
```

Create your GitHub OAuth App at: https://github.com/settings/developers  
→ New OAuth App → set **Authorization callback URL** to `GITHUB_CALLBACK_URL`

---

## API Reference

### OAuth Flow (browser-initiated)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/github` | None | Redirects browser to GitHub login |
| GET | `/api/auth/github/callback` | None | GitHub redirects here; issues JWT |

**Callback success response:**
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "abc123...",
  "user": {
    "id": "...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "githubUsername": "janedoe",
    "githubProfileUrl": "https://github.com/janedoe",
    "isPremium": false
  }
}
```

### GitHub Data APIs (JWT required)

| Method | Route | Description |
|---|---|---|
| GET | `/api/github/status` | GitHub connection status + repo count |
| GET | `/api/github/repos` | Paginated repos from DB |
| GET | `/api/github/repos?fresh=true` | Live fetch from GitHub before returning |
| GET | `/api/github/repos?lang=Go&sort=forks` | Filter/sort repos |
| POST | `/api/github/sync` | Enqueue background sync (returns 202) |

**Repo sort values:** `stars` (default) | `forks` | `updated` | `name`

---

## Security design

| Concern | Solution |
|---|---|
| CSRF on OAuth callback | Random state token in httpOnly cookie; verified on callback |
| GitHub tokens at rest | AES-256-GCM encryption (`GITHUB_TOKEN_ENC_KEY`); `select: false` on field |
| Token never exposed | `githubAccessToken` never returned in any API response |
| Revoked token handling | 401 from GitHub clears token; user prompted to re-auth |
| Rate limits | `RateLimitError` caught; BullMQ retries after reset window |
| GitHub-only users | `email`/`password` are optional; `sparse` unique index handles null |

---

## User handling matrix

| Scenario | Outcome |
|---|---|
| Brand new GitHub user | Creates new User with GitHub fields, issues JWT |
| GitHub email matches existing account | Links GitHub to existing account, updates token |
| Existing GitHub user logs in again | Updates token + avatar, issues fresh JWT |
| User denies GitHub access | Returns 400 with GitHub error message |

---

## Background sync flow

```
GitHub OAuth callback
        │
        ▼
githubSyncQueue.add('syncRepos', { userId }, { delay: 2000 })
        │
        ▼  (async, after 2s)
githubSync worker
   1. Load user + decrypt token
   2. fetchGitHubRepos() — paginates all repos
   3. Repo.bulkWrite() — upsert all (idempotent)
   4. Log result
```

BullMQ retries 3× with exponential backoff (5s → 25s → 125s) on failure.

---

## Testing the OAuth flow

Since OAuth requires a browser for the redirect flow:

1. Open `http://localhost:5000/api/auth/github` in your browser
2. Authorize the app on GitHub
3. You'll be redirected back to your callback URL with a JSON response
4. Copy the `accessToken` from the response into Postman collection variable
5. Use the repo endpoints with `Authorization: Bearer <token>`

For local development, use [ngrok](https://ngrok.com) if GitHub's callback can't reach `localhost`:
```bash
ngrok http 5000
# Use the https ngrok URL as GITHUB_CALLBACK_URL
```
