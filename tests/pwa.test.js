import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  serviceWorkerCacheFiles,
  registerServiceWorker
} from "../src/pwa.js";

test("service worker cache list includes the app shell assets", () => {
  assert.deepEqual(
    serviceWorkerCacheFiles.slice(0, 5),
    ["/", "/index.html", "/styles.css", "/manifest.webmanifest", "/assets/favicon.svg"]
  );
  assert.ok(serviceWorkerCacheFiles.includes("/src/upgradeBridge.js"));
});

test("root service worker precaches exactly the same app shell files", () => {
  const serviceWorkerSource = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

  assert.deepEqual(extractAppShellFiles(serviceWorkerSource), serviceWorkerCacheFiles);
});

test("service worker cache files exist in the repository", () => {
  serviceWorkerCacheFiles.forEach((file) => {
    const path = file === "/" ? "../index.html" : `..${file}`;
    assert.equal(existsSync(new URL(path, import.meta.url)), true, `${file} should exist`);
  });
});

test("manifest install resources are covered by the service worker cache", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  const installResources = [manifest.start_url, ...(manifest.icons ?? []).map((icon) => icon.src)].map(manifestPathToCachePath);

  assert.equal(manifest.id, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(installResources.filter((file) => !serviceWorkerCacheFiles.includes(file)), []);
});

test("HTML and module imports are versionless and use a stable offline cache", () => {
  const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const serviceWorkerSource = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const assetVersions = [...indexSource.matchAll(/\?v=([A-Za-z0-9-]+)/g), ...appSource.matchAll(/\?v=([A-Za-z0-9-]+)/g)].map(
    (match) => match[1]
  );
  const localImports = [...appSource.matchAll(/from "\.\/([^"]+\.js)(?:\?v=([^"]+))?"/g)];

  assert.match(serviceWorkerSource, /const CACHE_NAME = "kaifan-pwa";/);
  assert.equal(assetVersions.length, 0);
  assert.ok(localImports.length > 0);
  assert.deepEqual(localImports.filter((match) => match[2]).map((match) => match[1]), []);
  assert.match(serviceWorkerSource, /fetch\(request, \{ cache: "no-cache" \}\)/);
  assert.match(serviceWorkerSource, /caches\.match\(request\)/);
});

test("app imports every appState helper it calls", () => {
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const importBlocks = [...appSource.matchAll(/import\s+\{([\s\S]*?)\}\s+from "([^"]+)";/g)];
  const appStateImport = importBlocks.find((match) => match[2].startsWith("./appState.js"));
  assert.ok(appStateImport);

  const importedHelpers = appStateImport[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const knownHelpers = [
    "applyDecisionState",
    "applyMemoryState",
    "applyProfileState",
    "beginMemorySync",
    "beginProfileSync",
    "completeMemorySync",
    "completeProfileSync",
    "failDecisionRequest",
    "finishDecisionRequest",
    "selectDecisionCardState",
    "shouldRetryMemorySync",
    "shouldRetryProfileSync",
    "startDecisionRequest"
  ];
  const missingImports = knownHelpers.filter(
    (helper) => new RegExp(`\\b${helper}\\(`).test(appSource) && !importedHelpers.includes(helper)
  );

  assert.deepEqual(missingImports, []);
});

test("registerServiceWorker registers the app service worker when supported", async () => {
  const calls = [];
  const navigatorObj = {
    serviceWorker: {
      async register(url, options) {
        calls.push({ url, options });
        return { scope: options.scope };
      }
    }
  };

  const registered = await registerServiceWorker(navigatorObj);

  assert.equal(registered, true);
  assert.deepEqual(calls, [{ url: "/sw.js", options: { scope: "/" } }]);
});

test("registerServiceWorker skips unsupported browsers", async () => {
  const registered = await registerServiceWorker({});

  assert.equal(registered, false);
});

function extractAppShellFiles(source) {
  const match = source.match(/const APP_SHELL_FILES = (\[[\s\S]*?\]);/);
  assert.ok(match);
  return JSON.parse(match[1]);
}

function manifestPathToCachePath(value) {
  return new URL(value, "https://kaifan.local/").pathname;
}
