# Reliability, Privacy, and Context Design

## Goal

Reduce unnecessary model calls, protect anonymous user data, and replace sample weather with daily city weather without introducing accounts, paid dependencies, or precise-location collection.

## Decisions

- Settings close compares the normalized draft with the stored profile. An unchanged profile returns to Today without sync or generation.
- The backend issues a UUID v4 user ID and a cryptographically random session token to a newly installed browser. Only a SHA-256 hash of that token is stored in SQLite. Requests carrying user data require `X-Kaifan-Session`; a missing or mismatched token receives HTTP 401.
- Existing browsers with `local-user` create a new session before hydration, then write their local profile and memory to that session. They do not read the shared legacy backend record.
- Real LLM generation is limited to four attempts per user in a rolling 60-second window. Excess calls return a deterministic fallback decision with `fallbackReason: "rate_limited"`. The refresh endpoint has a separate, higher limit and verifies that the requested decision belongs to the session user.
- DeepSeek retries wait 0.5 seconds after the first failure, then one second for each subsequent retry. Waiting is injected for unit tests.
- Profile allergies, dislikes, taboos, and learned `avoidedKeywords` are hard constraints. Any match in a generated card triggers the normal retry path.
- City is an optional profile field. The client resolves it through Open-Meteo geocoding and fetches current weather from Open-Meteo once per local day. Weather remains cached locally and a weather failure preserves the current context.
- The PWA uses versionless module URLs and a network-first service-worker cache with offline fallback. Google Fonts are removed in favor of a system Chinese font stack.

## Interfaces

- `POST /api/session` returns `{ userId, sessionToken }`.
- `X-Kaifan-Session` authenticates every user-scoped API request.
- `POST /api/decision/today` returns a normal fallback decision when rate-limited, never an uncaught provider error.
- `src/weather.js` exposes pure response-normalization helpers and `hydrateWeatherContext(context, city, fetchImpl)`.

## Verification

Tests cover unchanged settings, session authorization and migration, decision/refresh rate limits, retry waits, learned forbidden foods, weather caching and failures, and the service-worker/font entry shell. Full verification runs `npm run check` and Playwright key-flow tests before deployment.
