# Repository Guidelines

## Project Structure & Module Organization

This repository contains a static H5/PWA MVP for the Dinner Decision Assistant plus product documentation.

- `docs/晚餐决策助手-产品设计文档-v1.0.md`: product scope, MVP plan, decision engine, data model, and rollout strategy.
- `docs/晚餐决策助手-前端设计文档-v1.0.md`: H5/PWA frontend UX, pages, components, states, and interaction guidance.
- `index.html`, `styles.css`, `manifest.webmanifest`: static app shell, styling, and PWA metadata.
- `src/`: application modules, including decision logic, sample data, storage, links, and UI orchestration.
- `server/`: FastAPI backend, SQLite persistence, and recommendation helpers.
- `tests/`: Node.js tests for behavior-focused modules.
- `tests_e2e/`: Playwright browser tests for key H5/PWA flows.
- `tests_backend/`: Python `unittest` tests for backend persistence and recommendation behavior.
- `assets/concepts/`: generated visual reference assets.

## Build, Test, and Development Commands

- `npm test`: run Node.js built-in tests.
- `npm run e2e`: run Playwright browser tests against `http://127.0.0.1:6053`.
- `npm run e2e:headed`: run Playwright with a visible browser for debugging.
- `npm run backend:test`: run Python backend tests.
- `npm run dev`: start the FastAPI app and static frontend at `http://127.0.0.1:6053`.
- `npm run serve`: serve the static app at `http://127.0.0.1:4173`.
- `npm run check`: run the current verification suite.
- `rg "TODO|TBD" docs src server tests tests_backend`: scan for placeholders before review.

## Coding Style & Naming Conventions

For Markdown, use concise headings, short paragraphs, and tables only when they improve scanning. Keep product docs in Chinese unless a specific artifact requires English.

For JavaScript, use ES modules, two-space indentation, semicolons, and descriptive camelCase names. Keep business logic in small modules such as `decisionEngine.js` and browser wiring in `app.js`.

## Testing Guidelines

Use Node.js built-in `node:test` for module behavior. Add focused tests for decision rules, profile constraints, platform-link fallbacks, and frontend state helpers. Name tests after the module under test, for example `decisionEngine.test.js`. Use Playwright in `tests_e2e/` for rendered browser flows.

## Commit & Pull Request Guidelines

Git history is not available in this workspace, so no existing convention can be inferred. Use short, imperative commit messages such as `Add frontend design guide` or `Define decision engine MVP`.

Pull requests should include:

- A short summary of the change.
- Affected files or areas.
- Screenshots for UI changes.
- Test results or a note explaining why tests were not run.

## Security & Configuration Tips

Do not commit API keys, model tokens, platform cookies, private location data, or user health data. Keep third-party platform integrations limited to documented links or user-controlled search flows unless a compliant API is available.

For DeepSeek integration, put local credentials in `.env.local` using `.env.example` as the template. The app reads `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, and `DEEPSEEK_BASE_URL`; keep `.env.local` untracked.
