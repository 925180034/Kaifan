import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProfileSummary,
  formatListInput,
  parseListInput
} from "../src/profile.js";

test("parses Chinese and Western separators into trimmed unique values", () => {
  assert.deepEqual(parseListInput("虾仁、豆腐, 番茄\n虾仁；鸡蛋"), [
    "虾仁",
    "豆腐",
    "番茄",
    "鸡蛋"
  ]);
});

test("formats list values for textarea editing", () => {
  assert.equal(formatListInput(["虾仁", "豆腐", "番茄"]), "虾仁、豆腐、番茄");
});

test("builds a compact profile summary with nutrition and favorites", () => {
  const summary = buildProfileSummary({
    peopleCount: "2",
    spicyLevel: "mild",
    budgetPerPerson: "30_60",
    nutritionGoal: "高蛋白控油",
    favoriteIngredients: ["虾仁", "豆腐", "番茄"]
  });

  assert.equal(summary, "2 人 · 微辣 · ¥30-60/人 · 高蛋白控油 · 爱吃虾仁/豆腐");
});
