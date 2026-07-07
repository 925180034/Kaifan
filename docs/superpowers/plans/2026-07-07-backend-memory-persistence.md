# Backend Memory Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist user profile and dinner memory on the backend so the MVP can restore them after clearing browser storage.

**Architecture:** Add a JSON `memories` table keyed by `user_id`, expose `/api/memory/{user_id}`, and let the frontend load profile + memory before the first generation. Keep the memory payload schema local-first: `recentMeals`, `feedbackLearning`, and `feedback`.

**Tech Stack:** FastAPI, SQLite, Python `unittest`, vanilla ES modules.

---

## File Structure

- Modify `server/database.py`: create `memories` table and add `save_memory()` / `get_memory()`.
- Modify `server/main.py`: add memory request model and GET/POST memory endpoints.
- Modify `tests_backend`: add database and API coverage.
- Modify `src/apiClient.js`: add `fetchProfile()`, `fetchMemory()`, and `saveMemory()`.
- Modify `src/app.js`: use stable default `local-user`, load backend profile/memory before generation, sync memory after selection and feedback.
- Modify `tests/apiClient.test.js`: cover memory/profile client calls.

## Task 1: Backend Tests

- [x] Add database tests for saving and loading memory JSON.
- [x] Add API tests for GET/POST `/api/memory/{user_id}`.
- [x] Run `npm run backend:test` and verify failure before implementation.

## Task 2: Backend Implementation

- [x] Add `memories` table in SQLite initialization.
- [x] Add `Database.save_memory(user_id, memory)` and `Database.get_memory(user_id)`.
- [x] Add FastAPI memory endpoints.
- [x] Run backend tests and verify pass.

## Task 3: Frontend API Client Tests

- [x] Add tests for `fetchProfile()`, `fetchMemory()`, and `saveMemory()`.
- [x] Run `npm test -- tests/apiClient.test.js` and verify failure before implementation.

## Task 4: Frontend Sync Implementation

- [x] Add API client functions.
- [x] Use stable default `local-user` for new browser storage.
- [x] Load profile and memory before first generation.
- [x] Save memory after selection and feedback.

## Task 5: Verification and Push

- [x] Run `npm run check`.
- [x] Browser smoke: save profile/history, clear local storage, reload, verify backend restores memory.
- [x] Commit with `feat: persist user memory` and push to `main`.
