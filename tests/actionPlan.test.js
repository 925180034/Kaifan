import test from "node:test";
import assert from "node:assert/strict";

import {
  buildActionPlan,
  buildAggregatedShoppingGroups,
  buildAggregatedShoppingList,
  buildIngredientKeywords,
  buildShoppingGroups,
  buildShoppingList
} from "../src/actionPlan.js";
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
  assert.ok(plan.actions[0].url.includes(encodeURIComponent("小象超市 虾仁 200g")));
  assert.deepEqual(plan.shoppingList.slice(0, 3), ["虾仁 200g", "嫩豆腐 1盒", "番茄 2个"]);
  assert.ok(plan.checklist.includes("按 2 人份核对主食、蛋白质和蔬菜数量"));
});

test("scales cooking shopping lists to the profile people count", () => {
  const plan = buildActionPlan(recipeOptions[0], {
    ...defaultProfile,
    peopleCount: "4"
  });

  assert.deepEqual(plan.shoppingList.slice(0, 4), ["虾仁 400g", "嫩豆腐 2盒", "番茄 4个", "黄瓜 2根"]);
  assert.ok(plan.checklist.includes("按 4 人份核对主食、蛋白质和蔬菜数量"));
});

test("adds budget recovery hints and substitutions for cooking plans", () => {
  const plan = buildActionPlan(recipeOptions[0], defaultProfile, {
    recentMeals: [
      { id: recipeOptions[0].id, estimatedCostPerPerson: 28 },
      { estimatedCostPerPerson: 88 },
      { estimatedCostPerPerson: 75 },
      { estimatedCostPerPerson: 34 }
    ]
  });

  assert.ok(plan.keywordChips.includes("平价"));
  assert.ok(plan.keywordChips.includes("特价"));
  assert.ok(plan.noteChips.includes("省预算优先"));
  assert.ok(plan.shoppingList.includes("可替代: 鸡蛋/鸡胸肉替代部分虾仁"));
  assert.ok(plan.checklist.includes("高价主材先买半份,用鸡蛋、豆腐或当季菜补足"));
});

test("builds a readiness summary for cooking plans with missing groceries", () => {
  const plan = buildActionPlan(recipeOptions[0], defaultProfile, {
    ownedIngredientNames: ["番茄", "嫩豆腐", "黄瓜", "米饭", "葱姜蒜"]
  });

  assert.deepEqual(plan.readinessSummary, {
    status: "need_grocery",
    title: "还缺 1 样食材",
    helper: "先补齐采购清单,再按备菜顺序开做。",
    metrics: [
      { label: "采购", value: "1 样 / 1 类" },
      { label: "时间", value: "25分钟" },
      { label: "预算", value: "约¥28/人" }
    ]
  });
});

test("builds a ready-to-cook summary when all ingredients are owned", () => {
  const plan = buildActionPlan(recipeOptions[0], defaultProfile, {
    ownedIngredientNames: ["番茄", "虾仁", "嫩豆腐", "黄瓜", "米饭", "葱姜蒜"]
  });

  assert.deepEqual(plan.shoppingList, []);
  assert.deepEqual(plan.readinessSummary, {
    status: "ready_to_cook",
    title: "食材已确认齐了",
    helper: "可以直接开火,按备菜顺序推进。",
    metrics: [
      { label: "采购", value: "无需补货" },
      { label: "时间", value: "25分钟" },
      { label: "预算", value: "约¥28/人" }
    ]
  });
});

test("uses missing shopping items for grocery search when ingredients are owned", () => {
  const plan = buildActionPlan(recipeOptions[0], defaultProfile, {
    ownedIngredientNames: ["番茄", "嫩豆腐", "黄瓜", "米饭", "葱姜蒜"]
  });

  assert.deepEqual(plan.shoppingList, ["虾仁 200g"]);
  assert.ok(plan.actions[0].url.includes(encodeURIComponent("小象超市 虾仁 200g")));
  assert.ok(!plan.actions[0].url.includes(encodeURIComponent("番茄")));
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

test("adds profile-driven notes without putting restrictions into search keywords", () => {
  const plan = buildActionPlan(takeoutOptions[0], {
    ...defaultProfile,
    allergies: ["花生过敏"],
    dislikes: ["香菜"],
    spicyLevel: "none",
    tasteTags: ["清淡", "少油"],
    cuisinePreferences: ["粤菜"],
    budgetPerPerson: "30_60"
  });

  assert.ok(plan.keywordChips.includes("清淡"));
  assert.ok(plan.keywordChips.includes("粤菜"));
  assert.ok(!plan.searchText.includes("香菜"));
  assert.ok(!plan.searchText.includes("花生"));
  assert.ok(plan.noteChips.includes("不要香菜"));
  assert.ok(plan.noteChips.includes("避开花生过敏"));
  assert.ok(plan.noteChips.includes("不要辣"));
  assert.ok(plan.noteChips.includes("预算 ¥30-60/人"));
}
);

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

test("adds budget and cuisine hints for dine-out searches", () => {
  const plan = buildActionPlan(dineOutOptions[0], {
    ...defaultProfile,
    cuisinePreferences: ["粤菜", "江浙"],
    tasteTags: ["清淡"],
    budgetPerPerson: "60_plus"
  });

  assert.ok(plan.keywordChips.includes("粤菜"));
  assert.ok(plan.keywordChips.includes("清淡"));
  assert.ok(plan.keywordChips.includes("人均60以上"));
  assert.ok(plan.noteChips.includes("预算 ¥60+/人"));
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

test("builds a copyable shopping list from recipe ingredients", () => {
  const list = buildShoppingList({
    ingredients: [
      { name: "番茄", amount: "2个" },
      { name: "虾仁", amount: "200g" },
      { name: "番茄", amount: "2个" }
    ],
    searchKeywords: ["豆腐"]
  }, { peopleCount: "1" });

  assert.deepEqual(list, ["番茄 1个", "虾仁 100g"]);
});

test("groups recipe shopping lists by ingredient category", () => {
  const groups = buildShoppingGroups(recipeOptions[0], defaultProfile, {
    ownedIngredientNames: ["番茄"]
  });

  assert.deepEqual(groups, [
    { label: "肉蛋奶", items: ["虾仁 200g"] },
    { label: "主食豆制品", items: ["嫩豆腐 1盒", "米饭 2碗"] },
    { label: "蔬菜水果", items: ["黄瓜 1根"] },
    { label: "调料干货", items: ["葱姜蒜 少量"] }
  ]);
});

test("excludes owned ingredients from recipe shopping lists", () => {
  const list = buildShoppingList(
    {
      ingredients: [
        { name: "番茄", amount: "2个" },
        { name: "虾仁", amount: "200g" },
        { name: "嫩豆腐", amount: "1盒" }
      ]
    },
    { peopleCount: "2" },
    { ownedIngredientNames: ["番茄", "嫩豆腐"] }
  );

  assert.deepEqual(list, ["虾仁 200g"]);
});

test("returns an empty shopping list when all recipe ingredients are owned", () => {
  const list = buildShoppingList(
    {
      ingredients: [
        { name: "番茄", amount: "2个" },
        { name: "鸡蛋", amount: "2个" }
      ],
      searchKeywords: ["番茄", "鸡蛋"]
    },
    { peopleCount: "2" },
    { ownedIngredientNames: ["番茄", "鸡蛋"] }
  );

  assert.deepEqual(list, []);
});

test("builds an aggregated shopping list from favorite cooking recipes", () => {
  const list = buildAggregatedShoppingList(
    [
      {
        type: "cook",
        title: "番茄虾仁豆腐饭",
        ingredients: [
          { name: "番茄", amount: "2个" },
          { name: "虾仁", amount: "200g" },
          { name: "嫩豆腐", amount: "1盒" }
        ]
      },
      {
        type: "cook",
        title: "番茄鸡蛋面",
        ingredients: [
          { name: "番茄", amount: "2个" },
          { name: "鸡蛋", amount: "2个" }
        ]
      },
      {
        type: "takeout",
        title: "热汤面",
        searchKeywords: ["热汤面"]
      },
      {
        type: "cook",
        title: "青菜豆腐汤",
        ingredients: [
          { name: "嫩豆腐", amount: "2盒" },
          { name: "青菜", amount: "" }
        ]
      }
    ],
    { peopleCount: "4" }
  );

  assert.deepEqual(list, ["番茄 8个", "虾仁 400g", "嫩豆腐 6盒", "鸡蛋 4个", "青菜"]);
});

test("excludes owned ingredients from aggregated favorite shopping lists", () => {
  const list = buildAggregatedShoppingList(
    [
      {
        type: "cook",
        ingredients: [
          { name: "番茄", amount: "2个" },
          { name: "鸡蛋", amount: "2个" }
        ]
      },
      {
        type: "cook",
        ingredients: [
          { name: "番茄", amount: "2个" },
          { name: "小青菜", amount: "200g" }
        ]
      }
    ],
    { peopleCount: "2" },
    { ownedIngredientNames: ["番茄"] }
  );

  assert.deepEqual(list, ["鸡蛋 2个", "小青菜 200g"]);
});

test("groups aggregated favorite shopping lists by ingredient category", () => {
  const groups = buildAggregatedShoppingGroups(
    [
      {
        type: "cook",
        ingredients: [
          { name: "番茄", amount: "2个", group: "蔬菜水果" },
          { name: "鸡蛋", amount: "2个", group: "肉蛋奶" }
        ]
      },
      {
        type: "cook",
        ingredients: [
          { name: "番茄", amount: "2个", group: "蔬菜水果" },
          { name: "小青菜", amount: "200g", group: "蔬菜水果" },
          { name: "挂面", amount: "200g", group: "主食豆制品" }
        ]
      }
    ],
    { peopleCount: "2" },
    { ownedIngredientNames: ["小青菜"] }
  );

  assert.deepEqual(groups, [
    { label: "蔬菜水果", items: ["番茄 4个"] },
    { label: "肉蛋奶", items: ["鸡蛋 2个"] },
    { label: "主食豆制品", items: ["挂面 200g"] }
  ]);
});

test("falls back to keyword-only shopping list when ingredients are missing", () => {
  const list = buildShoppingList({ searchKeywords: ["热汤面", "青菜"] });

  assert.deepEqual(list, ["热汤面", "青菜"]);
});

test("uses a neutral budget checklist for unknown budget values", () => {
  const plan = buildActionPlan(takeoutOptions[0], {
    ...defaultProfile,
    budgetPerPerson: "normal"
  });

  assert.ok(plan.checklist.includes("人均价格和今晚预算基本一致"));
  assert.ok(!plan.checklist.some((item) => item.includes("normal")));
});
