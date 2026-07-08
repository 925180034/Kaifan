import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const generatedPaths = [
  "test-results",
  "playwright-report",
  "coverage",
  "dist"
];

const generatedDirectoryNames = new Set([
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache"
]);

const ignoredRoots = new Set([
  ".git",
  ".agents",
  ".codex",
  "node_modules",
  "data"
]);

for (const path of generatedPaths) {
  remove(join(root, path));
}

removeGeneratedDirectories(root, true);

function removeGeneratedDirectories(directory, isRoot = false) {
  let entries = [];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (isRoot && ignoredRoots.has(entry.name)) continue;

    const fullPath = join(directory, entry.name);
    if (generatedDirectoryNames.has(entry.name)) {
      remove(fullPath);
      continue;
    }

    removeGeneratedDirectories(fullPath);
  }
}

function remove(path) {
  rmSync(path, { recursive: true, force: true });
}
