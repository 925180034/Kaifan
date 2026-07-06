# Backend API MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a FastAPI + SQLite backend that stores profiles, decisions, selections, and feedback, then connect the H5 frontend to same-origin API endpoints.

**Architecture:** Keep backend modules small: SQLite schema and persistence in `server/database.py`, deterministic MVP recommendation rules in `server/recommender.py`, HTTP routes and static serving in `server/main.py`. The frontend calls `/api/...` through `src/apiClient.js` and falls back to local sample data if the API is unavailable.

**Tech Stack:** FastAPI, Uvicorn, Python `sqlite3`, Python `unittest`, vanilla JavaScript ES modules.

---

## File Structure

- Create `server/__init__.py`: package marker.
- Create `server/sample_data.py`: Python version of current MVP profile, context, and card data.
- Create `server/recommender.py`: rank cards, refresh cards, and build decision payloads.
- Create `server/database.py`: SQLite schema, profile, decision, and feedback persistence.
- Create `server/main.py`: FastAPI routes plus static frontend serving.
- Create `tests_backend/test_backend.py`: backend unit/API tests using `unittest`.
- Create `src/apiClient.js`: frontend API wrapper.
- Modify `src/app.js`: initialize from backend, save profile/selection/feedback to backend.
- Modify `package.json`: add `backend:test`, `dev`, and broaden `check`.
- Modify `AGENTS.md`: document backend commands and structure.

## Task 1: Backend Tests First

**Files:**
- Create: `tests_backend/test_backend.py`

- [ ] **Step 1: Write failing backend tests**

Create tests that assert:

- `Database.save_profile()` and `Database.get_profile()` round-trip a profile in a temporary SQLite DB.
- `build_decision(profile, context)` returns three cards and a `topRecommendation`.
- `POST /api/decision/select` persists the selected card on a generated decision.
- `POST /api/feedback` persists a feedback tag.

- [ ] **Step 2: Run backend tests and verify RED**

Run: `python3 -m unittest discover -s tests_backend`

Expected: fails because `server.database`, `server.recommender`, and `server.main` do not exist.

## Task 2: Persistence and Recommendation

**Files:**
- Create: `server/__init__.py`
- Create: `server/sample_data.py`
- Create: `server/recommender.py`
- Create: `server/database.py`

- [ ] **Step 1: Implement sample data**

Mirror the existing frontend MVP cards in Python dictionaries, including `cook`, `takeout`, and `dine_out` cards.

- [ ] **Step 2: Implement recommender**

Export `build_decision(profile, context)`, `rank_cards(cards, context)`, and `refresh_card(card_type, mood, current_id=None)`.

- [ ] **Step 3: Implement SQLite repository**

Create tables: `profiles`, `decisions`, and `feedback`. Store complex data as JSON text.

- [ ] **Step 4: Run tests and verify persistence/recommender GREEN**

Run: `python3 -m unittest discover -s tests_backend`

Expected: tests progress past import failures; API tests may still fail until routes exist.

## Task 3: FastAPI Routes and Static Serving

**Files:**
- Create: `server/main.py`

- [ ] **Step 1: Implement routes**

Routes:

- `GET /api/health`
- `GET /api/profile/{user_id}`
- `POST /api/profile/{user_id}`
- `POST /api/decision/today`
- `POST /api/decision/{decision_id}/refresh`
- `POST /api/decision/select`
- `POST /api/feedback`

- [ ] **Step 2: Serve frontend**

Mount existing static files so `GET /` returns `index.html` and `/src/...`, `/styles.css`, `/assets/...` work from the same origin.

- [ ] **Step 3: Run tests and verify GREEN**

Run: `python3 -m unittest discover -s tests_backend`

Expected: backend tests pass.

## Task 4: Frontend API Integration

**Files:**
- Create: `src/apiClient.js`
- Modify: `src/app.js`

- [ ] **Step 1: Add API client**

Export `fetchTodayDecision`, `saveProfile`, `selectDecisionCard`, `refreshDecisionCard`, and `submitFeedback`.

- [ ] **Step 2: Wire app initialization**

On load, call `/api/decision/today` with current profile/context. If it fails, keep local sample data and show a small toast.

- [ ] **Step 3: Wire mutations**

Profile save, card select, card refresh, and feedback submit should call the backend when a `decisionId` exists, while keeping local UI responsive.

- [ ] **Step 4: Run frontend tests**

Run: `npm test`

Expected: existing frontend tests pass.

## Task 5: Verification, Commit, Push

**Files:**
- Modify: `package.json`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add commands**

Add:

- `backend:test`: `python3 -m unittest discover -s tests_backend`
- `dev`: `uvicorn server.main:app --host 0.0.0.0 --port 6053`
- `check`: `npm test && npm run backend:test`

- [ ] **Step 2: Run verification**

Run:

- `npm run check`
- `npm run dev`
- request `http://127.0.0.1:6053/api/health`

- [ ] **Step 3: Commit and push**

Run:

```bash
git add .
git commit -m "feat: add backend API MVP"
git push
```
