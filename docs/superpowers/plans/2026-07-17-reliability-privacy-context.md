# Reliability, Privacy, and Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduce unnecessary LLM cost, secure anonymous data, and use cached daily weather in dinner recommendations.

**Architecture:** Keep browser identity and weather orchestration in focused frontend modules. Keep session hashes, ownership checks, and sliding-window rate limits in the FastAPI/database layer. Preserve deterministic fallback behavior whenever external services fail.

**Tech Stack:** Vanilla ES modules, FastAPI, SQLite, Python unittest, Node test, Playwright.

## Global Constraints

- Do not collect precise coordinates or use paid weather APIs.
- Store only a hash of anonymous session tokens in SQLite.
- Rate limits must return local fallback decisions, not provider errors.
- Existing local data migrates away from `local-user` without reading legacy backend data.
- Keep current stale-content updating UX when cards already exist.

---

### Task 1: Avoid redundant settings generation

**Files:** `src/app.js`, `src/profile.js`, `tests/profile.test.js`

- [x] Write a failing test for a profile equality helper that treats equivalent normalized drafts as unchanged.
- [x] Verify the test fails because the helper does not exist.
- [x] Add `profilesEqual(left, right)` and use it in `closeSettingsPage` to skip profile sync and regeneration without changes.
- [x] Run `node --test tests/profile.test.js` and confirm it passes.

### Task 2: Session-bound anonymous identity

**Files:** `server/database.py`, `server/main.py`, `src/apiClient.js`, `src/app.js`, `tests_backend/test_backend.py`, `tests/apiClient.test.js`

- [x] Write failing backend tests for issuing a session, rejecting a missing token, rejecting a wrong token, and decision ownership checks.
- [x] Write a failing frontend API test that expects `X-Kaifan-Session` on user-scoped requests.
- [x] Add the sessions table, token hashing, constant-time comparison, session route, FastAPI dependency, browser session bootstrap, and legacy-local migration.
- [x] Run the focused Node and backend test files, then the full suite.

### Task 3: Cost protection and LLM backoff

**Files:** `server/rate_limit.py`, `server/main.py`, `server/llm_client.py`, `tests_backend/test_backend.py`, `tests_backend/test_llm_client.py`

- [x] Write failing tests for a four-per-minute generation cap, refresh cap, and a 0.5-second retry wait.
- [x] Add injected-clock sliding windows, fallback response metadata, refresh throttling, and injected retry sleep.
- [x] Run focused backend tests and confirm deterministic fallback remains selectable.

### Task 4: Harden generated-card constraints

**Files:** `server/llm_client.py`, `tests_backend/test_llm_client.py`

- [x] Write a failing test where an LLM card contains a learned avoided keyword.
- [x] Extend the existing forbidden-term collection with `feedbackLearning.avoidedKeywords`.
- [x] Verify retry receives the validation reason and the focused test passes.

### Task 5: City weather context

**Files:** `src/weather.js`, `src/app.js`, `src/profile.js`, `src/sampleData.js`, `tests/weather.test.js`, `tests/profile.test.js`

- [x] Write failing tests for Open-Meteo weather normalization, same-day cache reuse, and preserving prior context after a failed fetch.
- [x] Add an optional city setting and `hydrateWeatherContext` using Open-Meteo geocoding plus current weather endpoints.
- [x] Hydrate weather before an initial decision and refresh after a city change; update date text from the returned weather.
- [x] Run focused tests and test a no-city path without network access.

### Task 6: Offline delivery cleanup

**Files:** `index.html`, `styles.css`, `sw.js`, `src/app.js`, `tests/html.test.js`, `tests/pwa.test.js`

- [x] Write failing tests that reject Google Font URLs and query-string module versions.
- [x] Remove external font imports and use the existing system UI stack.
- [x] Replace manual cache versioning with a network-first app-shell cache with offline fallback and versionless asset imports.
- [x] Run shell tests and Playwright mobile flows.

### Task 7: Integration, deployment, and measurement

**Files:** `README.md`, `docs/yuncoding.top-部署说明.md`, relevant tests

- [x] Document optional city weather, session reset behavior, and rate-limit fallback.
- [x] Run `npm run check`, `npm run e2e`, `npm run clean`, and `git diff --check`.
- [x] Restart `kaifan`, verify `/api/health`, then verify `https://yuncoding.top` returns HTTP 200.
- [x] Run `npm run analytics`; keep P2 deferred unless real adoption data reaches the product threshold.
