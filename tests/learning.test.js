import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGenerationContext,
  recordFeedbackLearning,
  recordSelectedMeal
} from "../src/learning.js";

const sampleCard = {
  id: "cook-shrimp-tofu",
  type: "cook",
  title: "虾仁豆腐饭",
  searchKeywords: ["虾仁", "豆腐", "番茄"]
};

test("recordSelectedMeal prepends and de-duplicates recent meals", () => {
  const state = {
    recentMeals: [
      { id: "old-card", title: "青菜鸡蛋面", selectedAt: "2026-07-06T12:00:00.000Z" },
      { id: "cook-shrimp-tofu", title: "旧虾仁豆腐饭", selectedAt: "2026-07-05T12:00:00.000Z" }
    ]
  };

  recordSelectedMeal(state, sampleCard, "2026-07-07T12:00:00.000Z");

  assert.equal(state.recentMeals[0].id, "cook-shrimp-tofu");
  assert.equal(state.recentMeals[0].title, "虾仁豆腐饭");
  assert.equal(state.recentMeals.length, 2);
  assert.deepEqual(state.recentMeals.map((meal) => meal.id), ["cook-shrimp-tofu", "old-card"]);
});

test("recordSelectedMeal keeps only the newest eight meals", () => {
  const state = {
    recentMeals: Array.from({ length: 8 }, (_, index) => ({
      id: `old-${index}`,
      title: `旧菜 ${index}`,
      selectedAt: "2026-07-06T12:00:00.000Z"
    }))
  };

  recordSelectedMeal(state, sampleCard, "2026-07-07T12:00:00.000Z");

  assert.equal(state.recentMeals.length, 8);
  assert.equal(state.recentMeals[0].id, "cook-shrimp-tofu");
  assert.equal(state.recentMeals.at(-1).id, "old-6");
});

test("positive feedback adds liked keywords", () => {
  const state = {};

  recordFeedbackLearning(state, sampleCard, "好吃,下次还吃", "2026-07-07T12:00:00.000Z");

  assert.deepEqual(state.feedbackLearning.likedKeywords, ["虾仁", "豆腐", "番茄"]);
  assert.deepEqual(state.feedbackLearning.avoidedKeywords, []);
  assert.equal(state.feedbackLearning.lastFeedback.tag, "好吃,下次还吃");
});

test("negative feedback adds avoided keywords and constraints", () => {
  const state = {};

  recordFeedbackLearning(state, sampleCard, "太油/太咸", "2026-07-07T12:00:00.000Z");

  assert.deepEqual(state.feedbackLearning.likedKeywords, []);
  assert.deepEqual(state.feedbackLearning.avoidedKeywords, ["虾仁", "豆腐", "番茄"]);
  assert.deepEqual(state.feedbackLearning.constraints, ["少油少盐,避免重口味"]);
});

test("buildGenerationContext adds learning memory without mutating base context", () => {
  const baseContext = { mood: "normal", weather: { isRaining: false } };
  const state = {
    recentMeals: [{ id: "cook-shrimp-tofu", title: "虾仁豆腐饭" }],
    feedbackLearning: {
      likedKeywords: ["鸡胸肉"],
      avoidedKeywords: ["肥肉"],
      constraints: ["控制预算"],
      lastFeedback: { cardId: "takeout-fatty", tag: "太贵" }
    }
  };

  const context = buildGenerationContext(baseContext, state);

  assert.notEqual(context, baseContext);
  assert.notEqual(context.weather, baseContext.weather);
  assert.deepEqual(baseContext, { mood: "normal", weather: { isRaining: false } });
  assert.deepEqual(context.recentMeals, [{ id: "cook-shrimp-tofu", title: "虾仁豆腐饭" }]);
  assert.deepEqual(context.feedbackLearning.likedKeywords, ["鸡胸肉"]);
});
