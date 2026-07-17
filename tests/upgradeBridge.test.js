import test from "node:test";
import assert from "node:assert/strict";

import { clearLegacyPwa } from "../src/upgradeBridge.js";

test("legacy PWA bridge removes old caches, unregisters workers, and reloads", async () => {
  const deleted = [];
  let unregistered = 0;
  let reloads = 0;
  const cacheStorage = {
    async keys() {
      return ["kaifan-pwa-20260713-fresh-decision-cache", "kaifan-pwa"];
    },
    async delete(name) {
      deleted.push(name);
      return true;
    }
  };
  const serviceWorker = {
    async getRegistrations() {
      return [{ async unregister() { unregistered += 1; return true; } }];
    }
  };

  const upgraded = await clearLegacyPwa({
    cacheStorage,
    serviceWorker,
    reload: () => { reloads += 1; }
  });

  assert.equal(upgraded, true);
  assert.deepEqual(deleted, ["kaifan-pwa-20260713-fresh-decision-cache"]);
  assert.equal(unregistered, 1);
  assert.equal(reloads, 1);
});

test("legacy PWA bridge does nothing when only the current cache exists", async () => {
  let reloads = 0;
  const upgraded = await clearLegacyPwa({
    cacheStorage: { async keys() { return ["kaifan-pwa"]; } },
    serviceWorker: { async getRegistrations() { throw new Error("should not be called"); } },
    reload: () => { reloads += 1; }
  });

  assert.equal(upgraded, false);
  assert.equal(reloads, 0);
});
