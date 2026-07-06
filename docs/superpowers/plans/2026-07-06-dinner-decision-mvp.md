# Dinner Decision MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable static H5/PWA MVP for the Dinner Decision Assistant with tested recommendation helpers and an interactive mobile-first UI.

**Architecture:** Use dependency-free HTML/CSS/ES modules so the app can run immediately in the current repository without package installation. Keep business logic in small testable modules under `src/`, UI orchestration in `src/app.js`, and browser assets at the project root and `assets/`.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript ES modules, Node.js built-in test runner.

---

## File Structure

- Create `package.json`: project metadata and scripts for tests, static serving, and checks.
- Create `index.html`: mobile-first app shell.
- Create `styles.css`: visual system and responsive layout based on `assets/concepts/today-decision-mobile-concept.png`.
- Create `manifest.webmanifest`: installable PWA metadata.
- Create `src/sampleData.js`: initial profile, daily context, recipes, and decision cards.
- Create `src/decisionEngine.js`: ranking, mood labels, fallback recommendation, and card refresh helpers.
- Create `src/platformLinks.js`: search keyword and platform URL helpers.
- Create `src/storage.js`: localStorage wrapper with in-memory fallback.
- Create `src/app.js`: UI rendering, event handling, local state, and feedback flow.
- Create `tests/decisionEngine.test.js`: recommendation behavior tests.
- Create `tests/platformLinks.test.js`: platform link behavior tests.

## Task 1: Project Scripts and Decision Tests

**Files:**
- Create: `package.json`
- Create: `tests/decisionEngine.test.js`

- [ ] **Step 1: Add project scripts**

Create `package.json` with:

```json
{
  "name": "kaifan-dinner-decision-assistant",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "serve": "python3 -m http.server 4173",
    "check": "npm test"
  }
}
```

- [ ] **Step 2: Write failing decision engine tests**

Create `tests/decisionEngine.test.js` importing `rankDecisionCards`, `getMoodLabel`, and `refreshCard` from `../src/decisionEngine.js`. Include tests that verify:

- `getMoodLabel("lazy")` returns `偷懒`;
- rain increases takeout above dine-out when dine-out is otherwise present;
- a selected mood returns a matching cooking card after refresh.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test`

Expected: fails because `src/decisionEngine.js` does not exist.

## Task 2: Decision Engine Implementation

**Files:**
- Create: `src/sampleData.js`
- Create: `src/decisionEngine.js`

- [ ] **Step 1: Add sample data**

Create `src/sampleData.js` with three mood states, default user profile, daily context, recipe options, takeout options, dine-out options, and initial decision cards matching the MVP product document.

- [ ] **Step 2: Implement decision helpers**

Create `src/decisionEngine.js` exporting:

- `getMoodLabel(mood)`;
- `rankDecisionCards(cards, context)`;
- `refreshCard(type, mood)`;
- `getTopRecommendation(cards, context)`.

Rules:

- rainy weather adds 12 points to takeout and subtracts 14 points from dine-out;
- lazy mood adds 16 points to cook cards with `complexity: "easy"`;
- treat mood adds 14 points to dine-out;
- lower `baseScore` is never allowed to beat hard context boosts when scores differ.

- [ ] **Step 3: Run tests and verify GREEN**

Run: `npm test`

Expected: decision engine tests pass.

## Task 3: Platform Link Tests and Implementation

**Files:**
- Create: `tests/platformLinks.test.js`
- Create: `src/platformLinks.js`

- [ ] **Step 1: Write failing platform link tests**

Create `tests/platformLinks.test.js` importing `buildSearchUrl` and `formatKeywords`. Verify:

- `formatKeywords(["热汤面", "少油", "高评分"])` returns `热汤面 少油 高评分`;
- Meituan links include encoded keywords;
- Xiaoxiang links fall back to a web search URL with encoded ingredient keywords.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: fails because `src/platformLinks.js` does not exist.

- [ ] **Step 3: Implement platform link helpers**

Create `src/platformLinks.js` exporting:

- `formatKeywords(keywords)`;
- `buildSearchUrl(platform, keywords)`.

Use safe web URLs:

- Meituan: `https://www.meituan.com/s/?w=<encoded>`;
- Dianping: `https://www.dianping.com/search/keyword/1/0_<encoded>`;
- Xiaoxiang: `https://www.google.com/search?q=<encoded>`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test`

Expected: all tests pass.

## Task 4: App Shell and Styling

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `manifest.webmanifest`

- [ ] **Step 1: Build static app shell**

Create a semantic app shell with:

- header brand `晚餐决策助手`;
- weather bar;
- mood segmented control;
- top recommendation panel;
- decision card list;
- recipe view;
- shopping drawer;
- settings panel;
- feedback sheet.

- [ ] **Step 2: Add CSS design system**

Implement the concept-inspired visual system:

- warm neutral background;
- green, amber, blue accents;
- 8px card radii;
- 44px minimum touch targets;
- max content width 480px;
- responsive single-column mobile layout.

## Task 5: Interactive UI

**Files:**
- Create: `src/storage.js`
- Create: `src/app.js`
- Modify: `index.html`

- [ ] **Step 1: Implement storage helper**

Create `src/storage.js` exporting `loadState`, `saveState`, and `clearState`, with an in-memory fallback if `localStorage` is unavailable.

- [ ] **Step 2: Implement app interactions**

Create `src/app.js` to:

- render current mood and cards;
- update top recommendation when mood changes;
- refresh a single card;
- open recipe details for cook cards;
- open platform search links for takeout and dine-out cards;
- copy shopping list and keywords;
- save feedback tags;
- update settings fields.

- [ ] **Step 3: Wire the module**

Update `index.html` to load `src/app.js` with `type="module"` and link the manifest.

## Task 6: Verification and Git Publish

**Files:**
- Modify: `AGENTS.md` if scripts need to be reflected.

- [ ] **Step 1: Run automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run static server**

Run: `npm run serve`

Expected: server starts on port `4173`.

- [ ] **Step 3: Verify rendered app**

Open `http://127.0.0.1:4173`, inspect desktop and mobile widths, and click:

- mood changes;
- top recommendation CTA;
- each decision card primary action;
- single-card refresh;
- shopping list copy;
- feedback tag;
- settings save.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add .
git commit -m "feat: build dinner decision MVP"
git remote add origin git@github.com:925180034/Kaifan.git
git push -u origin main
```

Expected: branch `main` is pushed to GitHub.
