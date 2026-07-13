import test from "node:test";
import assert from "node:assert/strict";

import { buildHistorySummary } from "../src/history.js";

test("history summary reports empty state", () => {
  const summary = buildHistorySummary({});

  assert.equal(summary.hasHistory, false);
  assert.deepEqual(summary.recentMeals, []);
  assert.deepEqual(summary.favoriteMeals, []);
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
        searchKeywords: ["粤菜", "清淡"],
        estimatedCostPerPerson: 88,
        costText: "约¥88/人"
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
    displayedAt: "2026-07-07T12:00:00.000Z",
    searchKeywords: ["粤菜", "清淡"],
    estimatedCostPerPerson: 88,
    costText: "约¥88/人"
  });
});

test("history summary keeps completed meal timestamps", () => {
  const summary = buildHistorySummary({
    recentMeals: [
      {
        id: "cook-1",
        type: "cook",
        title: "虾仁豆腐饭",
        selectedAt: "2026-07-07T12:00:00.000Z",
        completedAt: "2026-07-07T19:20:00.000Z",
        searchKeywords: ["虾仁"]
      }
    ]
  });

  assert.equal(summary.recentMeals[0].completedAt, "2026-07-07T19:20:00.000Z");
  assert.equal(summary.recentMeals[0].displayedAt, "2026-07-07T19:20:00.000Z");
  assert.equal(summary.recentMeals[0].statusText, "已完成");
});

test("history summary estimates recent dinner spending", () => {
  const summary = buildHistorySummary({
    recentMeals: [
      { id: "cook-1", type: "cook", title: "虾仁豆腐饭", estimatedCostPerPerson: 28 },
      { id: "takeout-1", type: "takeout", title: "热汤面", estimatedCostPerPerson: 34 },
      { id: "dine-1", type: "dine_out", title: "粤菜小馆", estimatedCostPerPerson: 88 },
      { id: "old-no-cost", type: "cook", title: "旧记录" }
    ]
  });

  assert.deepEqual(summary.spendSummary, {
    hasSpend: true,
    mealCount: 3,
    totalEstimatedCost: 150,
    averageCostPerPerson: 50,
    label: "近 3 次约 ¥150",
    averageLabel: "平均 ¥50/人"
  });
});

test("history summary compares recent spending with profile budget", () => {
  const summary = buildHistorySummary({
    profile: { budgetPerPerson: "30_60" },
    recentMeals: [
      { id: "dine-1", type: "dine_out", title: "烤肉", estimatedCostPerPerson: 88 },
      { id: "dine-2", type: "dine_out", title: "火锅", estimatedCostPerPerson: 75 },
      { id: "takeout-1", type: "takeout", title: "盖饭", estimatedCostPerPerson: 34 }
    ]
  });

  assert.equal(summary.spendSummary.budgetStatus, "over");
  assert.equal(summary.spendSummary.budgetLabel, "¥30-60/人");
  assert.equal(summary.spendSummary.budgetMessage, "最近平均 ¥66/人,高于预算 ¥30-60/人");
});

test("history summary suggests a cheaper next meal when recent spending exceeds budget", () => {
  const summary = buildHistorySummary({
    profile: { budgetPerPerson: "30_60" },
    recentMeals: [
      { id: "dine-1", type: "dine_out", title: "烤肉", searchKeywords: ["烤肉"], estimatedCostPerPerson: 88 },
      { id: "dine-2", type: "dine_out", title: "火锅", searchKeywords: ["火锅"], estimatedCostPerPerson: 75 },
      { id: "takeout-1", type: "takeout", title: "盖饭", searchKeywords: ["盖饭"], estimatedCostPerPerson: 34 }
    ],
    feedback: [{ tag: "太贵" }]
  });

  assert.ok(
    summary.insights.some(
      (insight) =>
        insight.label === "下次建议" &&
        insight.value === "下一餐优先自己做,把人均拉回预算内" &&
        insight.tone === "amber"
    )
  );
});

test("history summary exposes favorite meals", () => {
  const summary = buildHistorySummary({
    favoriteMeals: [
      {
        id: "cook-tomato-egg",
        type: "cook",
        title: "番茄鸡蛋面",
        favoritedAt: "2026-07-08T12:00:00.000Z",
        searchKeywords: ["番茄", "鸡蛋"],
        ingredients: [{ name: "鸡蛋", amount: "2 个" }],
        steps: ["炒鸡蛋"]
      }
    ]
  });

  assert.equal(summary.hasHistory, true);
  assert.deepEqual(summary.favoriteMeals, [
    {
      id: "cook-tomato-egg",
      type: "cook",
      typeLabel: "自己做",
      title: "番茄鸡蛋面",
      favoritedAt: "2026-07-08T12:00:00.000Z",
      searchKeywords: ["番茄", "鸡蛋"],
      canOpenRecipe: true
    }
  ]);
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

test("history summary builds meal pattern insights", () => {
  const summary = buildHistorySummary({
    recentMeals: [
      { id: "takeout-1", type: "takeout", title: "热汤面", searchKeywords: ["热汤面", "少油"] },
      { id: "takeout-2", type: "takeout", title: "鸡胸饭", searchKeywords: ["鸡胸", "少油"] },
      { id: "takeout-3", type: "takeout", title: "砂锅粥", searchKeywords: ["砂锅粥", "清淡"] },
      { id: "cook-1", type: "cook", title: "虾仁豆腐饭", searchKeywords: ["虾仁", "少油"] }
    ],
    feedback: [{ tag: "太贵" }, { tag: "太油/太咸" }]
  });

  assert.deepEqual(summary.insights, [
    { label: "最近偏好", value: "点外卖 3/4 次", tone: "amber" },
    { label: "高频关键词", value: "少油", tone: "green" },
    { label: "下次建议", value: "穿插一次自己做,平衡预算和油盐", tone: "blue" }
  ]);
});

test("history summary suggests more substance after unsatisfying feedback", () => {
  const summary = buildHistorySummary({
    recentMeals: [
      { id: "cook-1", type: "cook", title: "青菜鸡蛋面", searchKeywords: ["青菜", "鸡蛋"], estimatedCostPerPerson: 12 },
      { id: "cook-2", type: "cook", title: "豆腐汤饭", searchKeywords: ["豆腐", "汤饭"], estimatedCostPerPerson: 14 }
    ],
    feedback: [{ tag: "不够满足" }]
  });

  assert.ok(
    summary.insights.some(
      (insight) =>
        insight.label === "下次建议" &&
        insight.value === "预算内加一份蛋白质或主食,别只追求省钱" &&
        insight.tone === "blue"
    )
  );
});
