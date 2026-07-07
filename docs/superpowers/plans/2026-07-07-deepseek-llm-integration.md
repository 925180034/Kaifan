# DeepSeek LLM Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate DeepSeek chat completions into dinner decision generation while keeping deterministic rule-based fallback.

**Architecture:** Add a small DeepSeek client that uses environment configuration, OpenAI-compatible `/chat/completions`, JSON output mode, and strict local validation. `server.recommender.build_decision()` will try LLM generation when a configured client is available, then fall back to existing rules if the API key is missing, the network call fails, or the model output is invalid.

**Tech Stack:** Python standard library `urllib.request`, FastAPI, SQLite, Python `unittest`, DeepSeek `deepseek-v4-flash`.

---

## File Structure

- Create `server/config.py`: load `.env.local` if present and expose DeepSeek settings.
- Create `server/llm_client.py`: DeepSeek request, prompt construction, JSON parsing, and validation.
- Modify `server/recommender.py`: accept optional `llm_client` and use LLM cards when valid.
- Modify `server/main.py`: create and pass configured DeepSeek client.
- Create `tests_backend/test_llm_client.py`: fake-transport tests for request shape, JSON parsing, and fallback behavior.
- Add `.env.example`: placeholder environment variables.
- Modify `.gitignore`: ignore `.env` and `.env.local`.
- Modify `AGENTS.md`: document DeepSeek configuration.

## Task 1: Failing LLM Client Tests

**Files:**
- Create: `tests_backend/test_llm_client.py`

- [x] **Step 1: Test request shape**

Write a fake transport test asserting `DeepSeekClient.generate_cards()` sends:

- model `deepseek-v4-flash` by default;
- `response_format: {"type": "json_object"}`;
- authorization header built from the provided API key.

- [x] **Step 2: Test parsed cards**

Return a fake DeepSeek response containing JSON with three valid cards. Assert the client returns three cards with types `cook`, `takeout`, and `dine_out`.

- [x] **Step 3: Test recommender fallback**

Use a fake client that raises an error. Assert `build_decision()` still returns three rule-based cards.

- [x] **Step 4: Run tests and verify RED**

Run: `python3 -m unittest discover -s tests_backend`

Expected: fails because `server.llm_client` does not exist.

## Task 2: DeepSeek Client

**Files:**
- Create: `server/llm_client.py`
- Create: `server/config.py`

- [x] **Step 1: Implement config**

Load `.env.local` key-value pairs without external dependencies, then read:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`, default `deepseek-v4-flash`
- `DEEPSEEK_BASE_URL`, default `https://api.deepseek.com`

- [x] **Step 2: Implement client**

Use `urllib.request` to POST to `/chat/completions`. Include JSON output mode and prompts that require a `cards` array.

- [x] **Step 3: Validate model output**

Accept only exactly three cards with required fields: `id`, `type`, `title`, `reason`, `costText`, `timeText`, `accent`, `searchKeywords`, `primaryAction`.

- [x] **Step 4: Run tests and verify GREEN for client**

Run: `python3 -m unittest tests_backend.test_llm_client -v`

Expected: LLM client tests pass.

## Task 3: Recommender and API Integration

**Files:**
- Modify: `server/recommender.py`
- Modify: `server/main.py`

- [x] **Step 1: Wire optional client**

`build_decision(profile, context, cards=None, llm_client=None)` tries `llm_client.generate_cards()` only when `llm_client.is_configured()` is true.

- [x] **Step 2: Preserve fallback**

If the client raises or returns invalid cards, return the existing deterministic decision.

- [x] **Step 3: Pass client from FastAPI**

`create_app()` creates `DeepSeekClient.from_env()` and passes it into `build_decision()`.

- [x] **Step 4: Run backend tests**

Run: `python3 -m unittest discover -s tests_backend`

Expected: all backend tests pass.

## Task 4: Local Secret and Verification

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `AGENTS.md`

- [x] **Step 1: Add secret hygiene**

Ignore `.env`, `.env.local`, and `.env.*.local`. Commit `.env.example` only.

- [x] **Step 2: Add local `.env.local`**

Store the provided API key only in untracked `.env.local` so the current server can use it.

- [x] **Step 3: Run verification**

Run:

- `npm run check`
- restart `npm run dev`
- `POST /api/decision/today`

Expected: API returns three cards; if DeepSeek fails, response still succeeds through fallback.

## Task 5: Commit and Push

- [x] **Step 1: Confirm secrets are not tracked**

Run: `git status --short --ignored`

Expected: `.env.local` appears ignored, not staged.

- [x] **Step 2: Commit code**

Run:

```bash
git add .
git commit -m "feat: integrate deepseek decisions"
git push
```
