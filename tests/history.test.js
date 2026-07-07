import test from "node:test";
import assert from "node:assert/strict";

import { buildHistorySummary } from "../src/history.js";

test("history summary reports empty state", () => {
  const summary = buildHistorySummary({});

  assert.equal(summary.hasHistory, false);
  assert.deepEqual(summary.recentMeals, []);
  assert.equal(summary.feedbackCount, 0);
  assert.deepEqual(summary.likedKeywords, []);
});

test("history summary keeps recent meals in stored order", () => {
  const summary = buildHistorySummary({
    recentMeals: [
      {
        id: "dine-yue",
        type: "dine_out",
        title: "附近粤菜小馆",
        selectedAt: "2026-07-07T12:00:00.000Z",
        searchKeywords: ["粤菜", "清淡"]
      }
    ]
  });

  assert.equal(summary.hasHistory, true);
  assert.deepEqual(summary.recentMeals[0], {
    id: "dine-yue",
    type: "dine_out",
    typeLabel: "出去吃",
    title: "附近粤菜小馆",
    selectedAt: "2026-07-07T12:00:00.000Z",
    searchKeywords: ["粤菜", "清淡"]
  });
});

test("history summary counts positive and negative feedback", () => {
  const summary = buildHistorySummary({
    feedback: [
      { tag: "好吃,下次还吃" },
      { tag: "太贵" },
      { tag: "不合口味" }
    ]
  });

  assert.equal(summary.feedbackCount, 3);
  assert.equal(summary.positiveFeedbackCount, 1);
  assert.equal(summary.negativeFeedbackCount, 2);
});

test("history summary exposes feedback learning chips", () => {
  const summary = buildHistorySummary({
    feedbackLearning: {
      likedKeywords: ["虾仁", "豆腐"],
      avoidedKeywords: ["肥肉"],
      constraints: ["控制预算,少推荐高价方案"]
    }
  });

  assert.equal(summary.hasHistory, true);
  assert.deepEqual(summary.likedKeywords, ["虾仁", "豆腐"]);
  assert.deepEqual(summary.avoidedKeywords, ["肥肉"]);
  assert.deepEqual(summary.constraints, ["控制预算,少推荐高价方案"]);
});
