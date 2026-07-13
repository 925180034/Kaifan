import test from "node:test";
import assert from "node:assert/strict";

import {
  applyProfilePreset,
  applyProfileTuningAction,
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

test("applies a healthy home-cooking preset without overwriting people or taboos", () => {
  const draft = applyProfilePreset(
    {
      peopleCount: "3-4",
      taboos: ["花生过敏"],
      allergies: ["花生过敏"],
      dislikes: []
    },
    "healthy_home"
  );

  assert.equal(draft.peopleCount, "3-4");
  assert.deepEqual(draft.taboos, ["花生过敏"]);
  assert.equal(draft.spicyLevel, "mild");
  assert.equal(draft.budgetPerPerson, "30_60");
  assert.equal(draft.cookingWillingness, "normal");
  assert.equal(draft.nutritionGoal, "高蛋白控油");
  assert.deepEqual(draft.tasteTags, ["清淡", "少油", "家常"]);
  assert.deepEqual(draft.favoriteIngredients.slice(0, 3), ["虾仁", "豆腐", "鸡胸肉"]);
});

test("ignores unknown profile preset ids", () => {
  const draft = { peopleCount: "2", spicyLevel: "hot" };

  assert.deepEqual(applyProfilePreset(draft, "unknown"), draft);
});

test("applies quick profile tuning actions without duplicating list values", () => {
  const profile = {
    budgetPerPerson: "30_60",
    cookingWillingness: "normal",
    nutritionGoal: "均衡",
    tasteTags: ["微辣", "少油"]
  };

  assert.deepEqual(applyProfileTuningAction(profile, "prefer_light"), {
    ...profile,
    tasteTags: ["微辣", "少油", "清淡"]
  });
  assert.equal(applyProfileTuningAction(profile, "prefer_cooking").cookingWillingness, "high");
  assert.equal(applyProfileTuningAction(profile, "prefer_low_effort").cookingWillingness, "low");
  assert.equal(applyProfileTuningAction(profile, "tighten_budget").budgetPerPerson, "15_30");
  assert.equal(applyProfileTuningAction(profile, "prefer_high_protein").nutritionGoal, "高蛋白控油");
  assert.deepEqual(applyProfileTuningAction(profile, "unknown"), profile);
});
