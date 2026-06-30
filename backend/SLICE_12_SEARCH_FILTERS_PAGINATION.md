# Slice 12 — Search + Filters + Pagination

## What was added

### New files
| File | Purpose |
|---|---|
| `src/controllers/searchController.js` | `searchUsers` — search, filters, and pagination over the User collection |
| `src/middleware/rateLimiter.js` | Generic, reusable Redis-backed rate limiter factory (basic abuse protection) |
| `postman/slice12-search-filters-pagination.postman_collection.json` | Postman tests |

### Surgically modified (minimal changes, nothing broken)
| File | Change |
|---|---|
| `src/models/User.js` | Added indexes: `skills` (multikey), `location`, and a compound `{ location, isProfileComplete }`. `username` already had a unique index from `unique: true` — no change needed there. |
| `src/routes/user.js` | Added `GET /search` (protected + rate-limited) |
| `src/app.js` | Mounted the user router at `/api/users` *in addition to* the existing `/api/user`, so the spec's exact path (`/api/users/search`) works without touching the existing mount |

No existing controller, route, or model field was rewritten — `searchController.js` reuses `utils/matchScore.js` (already used by `discoveryController.js`) rather than duplicating scoring logic.

---

## API Reference

`GET /api/users/search` — also reachable at `/api/user/search` (same router, mounted twice — see `app.js`). Requires `Authorization: Bearer <accessToken>`.

| Query param | Type | Default | Notes |
|---|---|---|---|
| `q` | string | — | Partial, case-insensitive match against `username` **or** `skills` |
| `location` | string | — | Partial, case-insensitive match |
| `skills` | string (csv) or array | — | Exact (case-insensitive) match — matches if the user has **any** of the named skills. Accepts `?skills=react,node` or `?skills=react&skills=node` |
| `isProfileComplete` | `"true"` \| `"false"` | — | Exact boolean filter. Any other value is ignored |
| `minMatchScore` | number ≥ 0 | — | Filters by relevance score vs. the logged-in user (see "Match score" below) |
| `page` | integer ≥ 1 | `1` | Invalid/garbage values silently fall back to the default |
| `limit` | integer | `10` | Clamped to a max of `50` |

All filters are **AND'd together** — e.g. `?q=dev&location=jaipur&skills=react` requires all three to match.

### Response shape
```json
{
  "success": true,
  "total": 42,
  "page": 1,
  "pages": 5,
  "users": [
    {
      "userId": "...",
      "name": "Jane Doe",
      "username": "janedoe",
      "bio": "Full-stack dev",
      "skills": ["React", "Node"],
      "location": "Jaipur, Rajasthan",
      "profilePicture": "https://...",
      "isProfileComplete": true,
      "matchScore": 20,
      "createdAt": "2026-01-10T12:00:00.000Z"
    }
  ]
}
```
`truncated: true` is added to the response **only** when `minMatchScore` is used and the internal candidate cap was hit (see below) — its absence means the result set is complete.

---

## Search & filter logic

- **Case-insensitive throughout** — every regex built from user input carries the `i` flag (or matches against pre-lowercased data, like `username`).
- **Regex-escaped input** — `q`, `location`, and each entry in `skills` are passed through an `escapeRegex()` helper before being used to build a `RegExp`. This stops special characters (`. * + ? ( ) [ ] { } | ^ $`) in user input from being interpreted as regex syntax — both a minor security hardening (regex injection) and a correctness fix (so searching for `"c++"` doesn't accidentally match `"c"`).
- **`q` vs `skills`** — `q` is a fuzzy, "search-box" style partial match intended for free text; `skills` (the dedicated filter) is an exact, anchored match (`^skill$`) against named skills, so filtering by `skills=react` won't accidentally also pull in users who only have `reactjs` or `react-native` listed.
- Users never see their own profile in search results (`_id: { $ne: req.user._id }`).

## Pagination

Same `{ total, page, pages }` shape and `skip()/limit()` mechanics already used by `getNotifications` in `notificationController.js`, for consistency across the API. `page`/`limit` default and clamp rather than error on bad input (e.g. `page=abc` → `page=1`), matching that existing convention.

## Match score (`minMatchScore`)

`matchScore` is **not a stored field** — it's computed per-request relative to whoever is calling the endpoint (shared skills, same location, profile completeness — see `utils/matchScore.js`, already used by discovery). That means Mongo can't index, filter, or sort by it directly, so:

- **Without `minMatchScore`** — pagination happens entirely in MongoDB (`skip()`/`limit()` on the indexed filter), which is the fast path and the one that actually benefits from the new indexes. `matchScore` is still computed and returned for the page of results shown, purely as useful display info — this costs nothing extra since it's just the current page, not the whole result set.
- **With `minMatchScore`** — the other filters (`q`, `location`, `skills`, `isProfileComplete`) are applied in MongoDB first to narrow the candidate set, then up to `500` candidates are fetched, scored in memory, filtered by the threshold, sorted by score, and paginated as an array. This mirrors the pattern `discoveryController.js` already uses for its own (smaller, 200-candidate) ranked list. If the 500-candidate cap is hit, the response includes `truncated: true` so the caller knows the count may be incomplete — a deliberate, documented trade-off given the "MongoDB only, no Elasticsearch" constraint.

## Indexing & performance

| Index | On | Why |
|---|---|---|
| (existing) unique index | `username` | Already created by `unique: true` — reused, not duplicated |
| `{ skills: 1 }` | `skills` | Multikey index — speeds up both the `skills` filter and `q` matches against skills |
| `{ location: 1 }` | `location` | Speeds up the `location` filter |
| `{ location: 1, isProfileComplete: 1 }` | compound | Lets Mongo satisfy "filter by location AND profile completeness" with one index instead of intersecting two |

**Honest limitation:** unanchored, case-insensitive regex (used for `q` and `location` to support true substring matching) cannot use a B-tree index for a true index-range scan — that's a fundamental MongoDB constraint without a text-search engine, which this slice intentionally avoids per the "Mongo-based, no Elasticsearch" requirement. What keeps this from becoming a full collection scan in practice:
- Every other filter (`skills`, `isProfileComplete`, plus `location` when paired with `isProfileComplete`) **is** fully indexed and narrows the candidate set before/independent of the regex check.
- `limit` is hard-capped at 50 (and the score-filter path caps candidates at 500), so no single request can force an unbounded scan.
- `.lean()` is used on every read — skips Mongoose document hydration overhead.
- `page`/`total` use `Promise.all([find, countDocuments])` to run in parallel rather than sequentially.

If `q`/`location` substring search needs to scale further (millions of users), the next step would be MongoDB Atlas Search or a dedicated search engine — explicitly out of scope here.

## Security

| Concern | Solution |
|---|---|
| Route protection | `GET /search` sits behind the existing `protect` (JWT) middleware |
| Abuse prevention | New `createRateLimiter()` middleware — Redis-backed fixed-window counter, applied here as 30 requests/minute/user. It's a generic factory (not search-specific) so other routes can reuse it later without writing a new limiter |
| Regex injection / ReDoS | All user-supplied search terms are regex-escaped before being compiled into a `RegExp` |
| Information leakage | `PUBLIC_FIELDS` selection excludes email, password, refresh tokens, and GitHub tokens — same safe-field discipline as `userController.safeProfile` |

### Why a new rate limiter instead of an npm package
The project has no rate-limiting dependency yet. Rather than add `express-rate-limit` (which defaults to in-memory counters — unsafe for this project's multi-instance / Redis-adapter setup) a small Redis `INCR`/`EXPIRE` based limiter was added instead, reusing the same shared Redis client the cache helpers already use. It fails *open* (lets requests through) on a Redis error, consistent with how `cache.js` already degrades gracefully rather than blocking requests during a Redis outage.

---

## Edge case handling

| Case | Behaviour |
|---|---|
| No results | `200` with `users: []`, `total: 0`, `pages: 0` |
| `q` / `location` containing regex metacharacters (`c++`, `.NET`) | Escaped before use — matched literally, doesn't throw or behave unexpectedly |
| Invalid `page` / `limit` (non-numeric, negative) | Silently fall back to defaults (`1` / `10`) |
| `limit` above max | Clamped to `50` |
| Invalid `minMatchScore` (non-numeric or negative) | `400` — this one errors instead of defaulting, since silently ignoring it could return a misleadingly broad result set |
| Invalid `isProfileComplete` value (anything but `"true"`/`"false"`) | Filter ignored, rest of the query still runs |
| Large dataset | Indexed filters + parallel count/find + hard pagination caps; `minMatchScore` path caps candidates at 500 and flags `truncated: true` if hit |
| No JWT | `401` from existing `protect` middleware |
| Over rate limit | `429` |
