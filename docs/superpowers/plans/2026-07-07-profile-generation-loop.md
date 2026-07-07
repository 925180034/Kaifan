# Profile Generation Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make profile edits and mood changes trigger a clear, safe dinner-plan regeneration flow.

**Architecture:** Keep the FastAPI decision endpoint unchanged and improve the frontend orchestration. Add small state helpers for request lifecycle, wire the main UI to a shared regeneration function, and show loading/failure states without losing the last good cards.

**Tech Stack:** Vanilla ES modules, Node `node:test`, FastAPI backend already running at `http://127.0.0.1:6053`.

---

## File Structure

- Modify `src/appState.js`: own frontend state transitions for generation lifecycle and stale response protection.
- Modify `src/app.js`: call a shared `regenerateDecision()` from app load, mood changes, profile save, and manual refresh.
- Modify `index.html`: add a visible regenerate button and status text.
- Modify `styles.css`: style disabled/loading states and status text.
- Modify `tests/appState.test.js`: cover stale requests, loading state, success, and failure.

## Task 1: State Lifecycle Tests

**Files:**
- Modify: `tests/appState.test.js`

- [x] **Step 1: Add a loading-state test**

Add a test that calls `startDecisionRequest(state)` and asserts `state.isGenerating === true`, `state.generationError === ""`, and `state.activeRequestId` is returned.

- [x] **Step 2: Add stale-response test**

Add a test that starts two requests, applies the first response, and asserts the cards are not replaced. Then apply the second response and assert cards update.

- [x] **Step 3: Add failure-state test**

Add a test that starts a request then calls `failDecisionRequest(state, requestId, "生成失败")`. Assert the last good cards remain, `isGenerating === false`, and `generationError === "生成失败"`.

- [x] **Step 4: Verify RED**

Run: `npm test -- tests/appState.test.js`

Expected: fails because `startDecisionRequest`, `finishDecisionRequest`, and `failDecisionRequest` do not exist.

## Task 2: State Lifecycle Implementation

**Files:**
- Modify: `src/appState.js`

- [x] **Step 1: Implement request start**

Export `startDecisionRequest(state)`. It increments `state.requestSequence`, sets `state.activeRequestId`, clears `state.generationError`, sets `state.isGenerating = true`, and returns the request id.

- [x] **Step 2: Implement request success**

Export `finishDecisionRequest(state, requestId, decision, cloneCards)`. Ignore stale request ids. For current ids, call `applyDecisionState()`, clear loading, and return `true`.

- [x] **Step 3: Implement request failure**

Export `failDecisionRequest(state, requestId, message)`. Ignore stale request ids. For current ids, set `isGenerating = false`, store the message, set `apiAvailable = false`, and return `true`.

- [x] **Step 4: Verify GREEN**

Run: `npm test -- tests/appState.test.js`

Expected: all app state tests pass.

## Task 3: Frontend Regeneration Flow

**Files:**
- Modify: `src/app.js`

- [x] **Step 1: Import lifecycle helpers**

Import `startDecisionRequest`, `finishDecisionRequest`, and `failDecisionRequest`.

- [x] **Step 2: Add `regenerateDecision(reason)`**

Use the shared function for initial load, mood changes, profile saves, and manual regenerate. It starts the lifecycle, renders loading state, calls `fetchTodayDecision()`, applies success only when the request id is current, and keeps existing cards on failure.

- [x] **Step 3: Update mood handling**

After changing mood, call `regenerateDecision("mood")`.

- [x] **Step 4: Update settings save**

After saving the profile locally, close settings and call `regenerateDecision("profile")`.

## Task 4: UI Controls and Status

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`

- [x] **Step 1: Add regenerate button and status text**

In the cards section header, add `#regenerateButton` and `#generationStatus`.

- [x] **Step 2: Render loading state**

Disable regenerate, refresh, and card action buttons while generating. Show `正在按你的画像生成...`.

- [x] **Step 3: Render failure state**

When `state.generationError` exists, show the message while keeping the last cards visible.

- [x] **Step 4: Wire manual regenerate**

Clicking `#regenerateButton` calls `regenerateDecision("manual")`.

## Task 5: Verification and Push

**Files:**
- Existing test and app files.

- [x] **Step 1: Run full test suite**

Run: `npm run check`

Expected: all frontend and backend tests pass.

- [x] **Step 2: Browser smoke**

Use a temporary browser script against `http://127.0.0.1:6053/`. Verify app load, profile save triggers generation, mood click triggers generation, status text appears, and no console errors.

- [x] **Step 3: Commit and push**

Run:

```bash
git add .
git commit -m "feat: add profile regeneration loop"
git push
```
