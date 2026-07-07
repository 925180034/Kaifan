# Feedback Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let user selections and feedback influence the next generated dinner plan while avoiding recently chosen meals.

**Architecture:** Add a small frontend learning module that stores recent selected meals and lightweight feedback preferences in local state. The generation request will send a derived context containing `recentMeals` and `feedbackLearning`; the DeepSeek prompt will explicitly use these fields to reduce repetition and react to feedback.

**Tech Stack:** Vanilla ES modules, Node `node:test`, Python `unittest`, existing FastAPI decision endpoint and DeepSeek JSON mode.

---

## File Structure

- Create `src/learning.js`: record selected meals, record feedback preferences, build generation context.
- Create `tests/learning.test.js`: focused unit tests for recent meals, feedback preference updates, and context output.
- Modify `src/app.js`: call learning helpers on card selection and feedback submission; pass enriched context into generation.
- Modify `server/llm_client.py`: prompt DeepSeek to avoid recent meals and respect feedback learning.
- Modify `tests_backend/test_llm_client.py`: assert prompts include feedback and recent-meal guidance.

## Task 1: Learning Module Tests

- [x] **Step 1: Add tests for recent meal de-duplication**

Create `tests/learning.test.js` and assert `recordSelectedMeal()` prepends the newest card, removes duplicate card ids, and caps the list.

- [x] **Step 2: Add tests for feedback learning**

Assert positive feedback adds keywords to `likedKeywords`; negative feedback adds keywords to `avoidedKeywords` and adds a plain-language constraint.

- [x] **Step 3: Add tests for generation context**

Assert `buildGenerationContext()` returns a copy of base context with `recentMeals` and `feedbackLearning`, without mutating the base context.

- [x] **Step 4: Verify RED**

Run `npm test -- tests/learning.test.js`; expected failure because `src/learning.js` does not exist.

## Task 2: Learning Module Implementation

- [x] **Step 1: Implement `recordSelectedMeal(state, card, timestamp)`**

Store compact meal records with `id`, `type`, `title`, `searchKeywords`, and `selectedAt`; keep only the newest eight.

- [x] **Step 2: Implement `recordFeedbackLearning(state, card, tag, timestamp)`**

Store compact preference memory under `state.feedbackLearning`.

- [x] **Step 3: Implement `buildGenerationContext(baseContext, state)`**

Return a cloned context with recent meals and feedback memory.

- [x] **Step 4: Verify GREEN**

Run `npm test -- tests/learning.test.js`; expected pass.

## Task 3: Frontend Wiring

- [x] **Step 1: Use enriched generation context**

Modify `regenerateDecision()` to call `buildGenerationContext(state.context, state)`.

- [x] **Step 2: Record selections**

Modify `selectCard()` to call `recordSelectedMeal()` before persistence.

- [x] **Step 3: Record feedback**

Modify feedback tag handling to call `recordFeedbackLearning()` and then trigger `regenerateDecision("feedback")`.

- [x] **Step 4: Add feedback button to every card**

Add a compact `反馈` button next to card actions so takeout and dine-out can also feed learning.

## Task 4: DeepSeek Prompt Guidance

- [x] **Step 1: Update system prompt**

Tell DeepSeek to avoid recent meals, lean into liked keywords, and reduce avoided keywords or constraints.

- [x] **Step 2: Add backend prompt test**

Assert `system_prompt()` mentions `recentMeals`, `feedbackLearning`, and avoiding repeated meals.

- [x] **Step 3: Run backend tests**

Run `npm run backend:test`; expected pass.

## Task 5: Verification and Push

- [x] **Step 1: Run full checks**

Run `npm run check`; expected pass.

- [x] **Step 2: Browser smoke**

Verify selecting a card records recent meals, feedback records learning, and the next generation request keeps the learning state.

- [x] **Step 3: Commit and push**

Commit with `feat: add feedback learning loop` and push to `main`.
