import test from "node:test";
import assert from "node:assert/strict";

import { buildActionPlan, buildIngredientKeywords } from "../src/actionPlan.js";
import {
  defaultProfile,
  dineOutOptions,
  recipeOptions,
  takeoutOptions
} from "../src/sampleData.js";

test("builds grocery-focused actions for a cooking card", () => {
  const plan = buildActionPlan(recipeOptions[0], defaultProfile);

  assert.equal(plan.title, "自己做执行方案");
  assert.deepEqual(plan.keywordChips.slice(0, 4), ["番茄", "虾仁", "嫩豆腐", "黄瓜"]);
  assert.deepEqual(
    plan.actions.map((action) => action.platform),
    ["xiaoxiang", "meituan"]
  );
  assert.ok(plan.actions[0].url.includes(encodeURIComponent("小象超市 番茄 虾仁 嫩豆腐 黄瓜")));
  assert.ok(plan.checklist.includes("按 2 人份核对主食、蛋白质和蔬菜数量"));
});

test("builds takeout actions with Meituan as the primary path", () => {
  const plan = buildActionPlan(takeoutOptions[0], defaultProfile);

  assert.equal(plan.title, "点外卖执行方案");
  assert.equal(plan.primaryPlatform, "meituan");
  assert.deepEqual(
    plan.actions.map((action) => action.platform),
    ["meituan", "dianping"]
  );
  assert.ok(plan.searchText.includes("少油"));
  assert.ok(plan.checklist.includes("备注少油少盐,避开过敏和不喜欢的食材"));
});

test("builds dine-out actions with Dianping as the primary path", () => {
  const plan = buildActionPlan(dineOutOptions[0], defaultProfile);

  assert.equal(plan.title, "出去吃执行方案");
  assert.equal(plan.primaryPlatform, "dianping");
  assert.deepEqual(
    plan.actions.map((action) => action.platform),
    ["dianping", "meituan"]
  );
  assert.ok(plan.searchText.includes("附近"));
  assert.ok(plan.checklist.includes("优先看距离、排队时长、人均和最近差评"));
});

test("deduplicates ingredient keywords while preserving order", () => {
  const keywords = buildIngredientKeywords({
    searchKeywords: ["番茄", "虾仁"],
    ingredients: [
      { name: "番茄", amount: "2个" },
      { name: "虾仁", amount: "200g" },
      { name: "嫩豆腐", amount: "1盒" }
    ]
  });

  assert.deepEqual(keywords, ["番茄", "虾仁", "嫩豆腐"]);
});

test("uses a neutral budget checklist for unknown budget values", () => {
  const plan = buildActionPlan(takeoutOptions[0], {
    ...defaultProfile,
    budgetPerPerson: "normal"
  });

  assert.ok(plan.checklist.includes("人均价格和今晚预算基本一致"));
  assert.ok(!plan.checklist.some((item) => item.includes("normal")));
});
