# Meal History Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight history panel that shows recent selected meals and feedback-learning signals.

**Architecture:** Build a pure `history` summary module from existing local state (`recentMeals`, `feedback`, `feedbackLearning`) and render it in a bottom sheet opened from the app header. This stays local-first and avoids adding backend tables until the product needs account-level sync.

**Tech Stack:** Vanilla ES modules, Node `node:test`, current H5/PWA shell.

---

## File Structure

- Create `src/history.js`: convert local app state into display-ready history data.
- Create `tests/history.test.js`: verify recent meal ordering, feedback counts, empty state, and keyword summary.
- Modify `src/app.js`: render and open the history sheet.
- Modify `index.html`: add a header history button and sheet container.
- Modify `styles.css`: add compact history list and keyword chip styling.

## Task 1: History Summary Tests

- [x] Add `tests/history.test.js` with tests for empty state, recent meals, feedback counts, and liked/avoided keywords.
- [x] Run `npm test -- tests/history.test.js` and verify it fails because `src/history.js` does not exist.

## Task 2: History Summary Module

- [x] Create `src/history.js`.
- [x] Export `buildHistorySummary(state)` returning `hasHistory`, `recentMeals`, `feedbackCount`, `positiveFeedbackCount`, `negativeFeedbackCount`, `likedKeywords`, `avoidedKeywords`, and `constraints`.
- [x] Run `npm test -- tests/history.test.js` and verify it passes.

## Task 3: History UI

- [x] Add a header history button next to settings.
- [x] Add `historySheet` and `historyContent` to `index.html`.
- [x] Render recent meals, feedback counts, and learning chips in `src/app.js`.
- [x] Show a calm empty state when no history exists.

## Task 4: Verification and Push

- [x] Run `npm run check`.
- [x] Browser smoke: open the history panel before and after selecting/feedback.
- [x] Commit with `feat: add meal history panel` and push to `main`.
