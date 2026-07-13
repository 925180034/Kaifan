import test from "node:test";
import assert from "node:assert/strict";

import { createLatestSync, createMemorySync } from "../src/memorySync.js";

test("memory sync serializes saves so the latest snapshot is written last", async () => {
  const calls = [];
  const deferred = [];
  const saveImpl = (userId, memory) => {
    calls.push({ userId, memory });
    return new Promise((resolve, reject) => deferred.push({ resolve, reject }));
  };
  const sync = createMemorySync(saveImpl);

  sync("user-1", { recentMeals: [{ id: "old" }] });
  sync("user-1", { recentMeals: [{ id: "new" }], feedback: [{ tag: "好吃" }] });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].memory.recentMeals[0].id, "old");

  deferred[0].resolve({ ok: true });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].memory.recentMeals[0].id, "new");
  assert.deepEqual(calls[1].memory.feedback, [{ tag: "好吃" }]);

  deferred[1].resolve({ ok: true });
  await Promise.resolve();
});

test("memory sync keeps only the newest pending snapshot while a save is in flight", async () => {
  const calls = [];
  const deferred = [];
  const saveImpl = (userId, memory) => {
    calls.push({ userId, memory });
    return new Promise((resolve, reject) => deferred.push({ resolve, reject }));
  };
  const sync = createMemorySync(saveImpl);

  sync("user-1", { recentMeals: [{ id: "first" }] });
  sync("user-1", { recentMeals: [{ id: "second" }] });
  sync("user-1", { recentMeals: [{ id: "third" }] });

  deferred[0].resolve({ ok: true });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].memory.recentMeals[0].id, "third");
});


test("memory sync snapshots queued memory before later local mutation", async () => {
  const calls = [];
  const saveImpl = async (userId, memory) => {
    calls.push({ userId, memory });
    return { ok: true };
  };
  const sync = createMemorySync(saveImpl);
  const memory = { recentMeals: [{ id: "before" }] };

  await sync("user-1", memory);
  memory.recentMeals[0].id = "after";

  assert.equal(calls[0].memory.recentMeals[0].id, "before");
});


test("latest sync serializes profile saves so the newest profile is written last", async () => {
  const calls = [];
  const deferred = [];
  const saveImpl = (userId, profile) => {
    calls.push({ userId, profile });
    return new Promise((resolve, reject) => deferred.push({ resolve, reject }));
  };
  const sync = createLatestSync(saveImpl);

  sync("user-1", { peopleCount: "1", tasteTags: ["清淡"] });
  sync("user-1", { peopleCount: "2", tasteTags: ["微辣"] });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].profile.peopleCount, "1");

  deferred[0].resolve({ ok: true });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].profile.peopleCount, "2");
  assert.deepEqual(calls[1].profile.tasteTags, ["微辣"]);
});


test("latest sync resolves when an older save fails but the newest save succeeds", async () => {
  const calls = [];
  const deferred = [];
  const saveImpl = (userId, profile) => {
    calls.push({ userId, profile });
    return new Promise((resolve, reject) => deferred.push({ resolve, reject }));
  };
  const sync = createLatestSync(saveImpl);

  const first = sync("user-1", { peopleCount: "1" });
  const latest = sync("user-1", { peopleCount: "2" });

  deferred[0].reject(new Error("offline"));
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].profile.peopleCount, "2");

  deferred[1].resolve({ ok: true });

  await assert.doesNotReject(first);
  await assert.doesNotReject(latest);
});

test("latest sync rejects when the newest attempted save fails", async () => {
  const saveImpl = async () => {
    throw new Error("offline");
  };
  const sync = createLatestSync(saveImpl);

  await assert.rejects(() => sync("user-1", { peopleCount: "2" }), /offline/);
});
