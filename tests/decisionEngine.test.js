import test from "node:test";
import assert from "node:assert/strict";

import {
  getMoodLabel,
  rankDecisionCards,
  refreshCard
} from "../src/decisionEngine.js";

test("returns the Chinese label for lazy mood", () => {
  assert.equal(getMoodLabel("lazy"), "偷懒");
});

test("rainy weather ranks takeout above dine-out", () => {
  const cards = [
    { id: "cook-1", type: "cook", baseScore: 72, complexity: "normal" },
    { id: "takeout-1", type: "takeout", baseScore: 68 },
    { id: "dine-1", type: "dine_out", baseScore: 70 }
  ];

  const ranked = rankDecisionCards(cards, {
    mood: "normal",
    weather: { isRaining: true }
  });

  assert.equal(ranked[0].type, "takeout");
  assert.ok(
    ranked.findIndex((card) => card.type === "takeout") <
      ranked.findIndex((card) => card.type === "dine_out")
  );
});

test("refreshing a lazy cook card returns an easy cook option", () => {
  const refreshed = refreshCard("cook", "lazy");

  assert.equal(refreshed.type, "cook");
  assert.equal(refreshed.complexity, "easy");
  assert.match(refreshed.primaryAction.label, /菜谱/);
});
