import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBudgetAlert,
  buildDecisionTradeoffs,
  buildPreferenceMatchDetails,
  buildProfileTuningActions,
  buildDailyReviewImpacts,
  buildRecommendationBreakdown,
  buildRankingComparisons,
  buildRecommendationSignals,
  getMoodLabel,
  rankDecisionCards,
  refreshCard,
  scoreCard
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

test("budget overage memory boosts low-cost cook cards", () => {
  const cards = [
    { id: "dine-rich", type: "dine_out", baseScore: 82, estimatedCostPerPerson: 88 },
    { id: "takeout-normal", type: "takeout", baseScore: 80, estimatedCostPerPerson: 42 },
    { id: "cook-budget", type: "cook", baseScore: 66, complexity: "easy", estimatedCostPerPerson: 18 }
  ];

  const ranked = rankDecisionCards(cards, {
    profile: { budgetPerPerson: "30_60" },
    recentMeals: [
      { estimatedCostPerPerson: 88 },
      { estimatedCostPerPerson: 75 },
      { estimatedCostPerPerson: 34 }
    ]
  });

  assert.equal(ranked[0].id, "cook-budget");
});

test("unsatisfying feedback boosts filling budget-friendly cards", () => {
  const cards = [
    {
      id: "cheap-soup",
      type: "cook",
      title: "青菜豆腐汤",
      baseScore: 82,
      estimatedCostPerPerson: 12,
      searchKeywords: ["青菜", "豆腐"],
      nutritionSummary: { protein: "约10g/人" }
    },
    {
      id: "protein-rice",
      type: "cook",
      title: "鸡胸糙米饭",
      baseScore: 66,
      estimatedCostPerPerson: 28,
      searchKeywords: ["鸡胸", "糙米饭"],
      nutritionSummary: { protein: "约35g/人" }
    }
  ];

  const ranked = rankDecisionCards(cards, {
    profile: { budgetPerPerson: "30_60" },
    feedbackLearning: { constraints: ["提高满足感,预算内增加蛋白质和主食"] }
  });

  assert.equal(ranked[0].id, "protein-rice");
});

test("too much effort feedback boosts easy low-effort cards", () => {
  const cards = [
    {
      id: "rich-stew",
      type: "cook",
      title: "红烧牛腩煲",
      baseScore: 84,
      estimatedMinutes: 65,
      complexity: "rich",
      estimatedCostPerPerson: 48,
      searchKeywords: ["牛腩", "炖菜"],
      nutritionSummary: { protein: "约42g/人" }
    },
    {
      id: "easy-noodle",
      type: "cook",
      title: "青菜鸡蛋热汤面",
      baseScore: 66,
      estimatedMinutes: 15,
      complexity: "easy",
      estimatedCostPerPerson: 12,
      searchKeywords: ["挂面", "鸡蛋", "小青菜"],
      nutritionSummary: { protein: "约22g/人" }
    }
  ];

  const ranked = rankDecisionCards(cards, {
    feedbackLearning: { constraints: ["优先简单省事,少推荐复杂备菜"] }
  });

  assert.equal(ranked[0].id, "easy-noodle");
});

test("oily or salty feedback boosts light cards over heavy flavors", () => {
  const cards = [
    {
      id: "spicy-fry",
      type: "takeout",
      title: "重口香辣炸鸡饭",
      baseScore: 84,
      estimatedCostPerPerson: 32,
      searchKeywords: ["香辣", "炸鸡", "重口味"],
      nutritionSummary: { note: "偏油偏咸" }
    },
    {
      id: "light-congee",
      type: "takeout",
      title: "清淡砂锅粥",
      baseScore: 66,
      estimatedCostPerPerson: 28,
      searchKeywords: ["砂锅粥", "清淡", "少油"],
      nutritionSummary: { note: "清淡少油,热乎舒服" }
    }
  ];

  const ranked = rankDecisionCards(cards, {
    feedbackLearning: { constraints: ["少油少盐,避免重口味"] }
  });

  assert.equal(ranked[0].id, "light-congee");
});

test("bad taste feedback downranks cards with avoided keywords", () => {
  const cards = [
    {
      id: "same-flavor",
      type: "takeout",
      title: "可选菜麻辣烫",
      baseScore: 84,
      estimatedCostPerPerson: 32,
      searchKeywords: ["麻辣烫", "少油", "可选菜"]
    },
    {
      id: "different-flavor",
      type: "takeout",
      title: "清淡砂锅粥",
      baseScore: 68,
      estimatedCostPerPerson: 28,
      searchKeywords: ["砂锅粥", "清淡", "少油"]
    }
  ];

  const ranked = rankDecisionCards(cards, {
    feedbackLearning: {
      avoidedKeywords: ["麻辣烫", "可选菜"],
      constraints: ["减少相似口味和关键词"]
    }
  });

  assert.equal(ranked[0].id, "different-flavor");
});

test("nutrition goals boost matching high-protein low-oil cards", () => {
  const cards = [
    {
      id: "comfort-carb",
      type: "takeout",
      title: "葱油拌面",
      baseScore: 82,
      estimatedCostPerPerson: 24,
      searchKeywords: ["拌面", "葱油"],
      nutritionSummary: { protein: "约8g/人", note: "主食为主" }
    },
    {
      id: "protein-light",
      type: "cook",
      title: "鸡胸虾仁豆腐饭",
      baseScore: 66,
      estimatedCostPerPerson: 28,
      searchKeywords: ["鸡胸", "虾仁", "豆腐", "少油"],
      nutritionSummary: { protein: "约38g/人", note: "高蛋白少油" }
    }
  ];

  const ranked = rankDecisionCards(cards, {
    profile: { nutritionGoal: "高蛋白控油", budgetPerPerson: "30_60" }
  });

  assert.equal(ranked[0].id, "protein-light");
});

test("low cooking willingness boosts takeout over complex cooking", () => {
  const cards = [
    {
      id: "complex-cook",
      type: "cook",
      title: "土豆炖牛腩",
      baseScore: 82,
      estimatedMinutes: 55,
      complexity: "rich",
      estimatedCostPerPerson: 48,
      searchKeywords: ["牛腩", "土豆"]
    },
    {
      id: "easy-takeout",
      type: "takeout",
      title: "轻食鸡胸饭",
      baseScore: 68,
      estimatedMinutes: 35,
      estimatedCostPerPerson: 34,
      searchKeywords: ["轻食", "鸡胸"]
    }
  ];

  const ranked = rankDecisionCards(cards, {
    profile: { cookingWillingness: "low" }
  });

  assert.equal(ranked[0].id, "easy-takeout");
});

test("high cooking willingness boosts cooking over takeout", () => {
  const cards = [
    {
      id: "normal-cook",
      type: "cook",
      title: "土豆炖牛腩",
      baseScore: 68,
      estimatedMinutes: 55,
      complexity: "rich",
      estimatedCostPerPerson: 48,
      searchKeywords: ["牛腩", "土豆"]
    },
    {
      id: "takeout",
      type: "takeout",
      title: "轻食鸡胸饭",
      baseScore: 82,
      estimatedMinutes: 35,
      estimatedCostPerPerson: 34,
      searchKeywords: ["轻食", "鸡胸"]
    }
  ];

  const ranked = rankDecisionCards(cards, {
    profile: { cookingWillingness: "high" }
  });

  assert.equal(ranked[0].id, "normal-cook");
});

test("profile flavor preferences boost matching ingredients and cuisines", () => {
  const cards = [
    {
      id: "plain-noodle",
      type: "takeout",
      title: "葱油拌面",
      baseScore: 82,
      estimatedCostPerPerson: 24,
      searchKeywords: ["拌面", "葱油"]
    },
    {
      id: "profile-match",
      type: "cook",
      title: "虾仁豆腐家常饭",
      baseScore: 66,
      estimatedCostPerPerson: 28,
      searchKeywords: ["虾仁", "豆腐", "家常", "少油"],
      ingredients: [
        { name: "虾仁" },
        { name: "豆腐" }
      ]
    }
  ];

  const ranked = rankDecisionCards(cards, {
    profile: {
      favoriteIngredients: ["虾仁", "豆腐"],
      cuisinePreferences: ["家常"],
      tasteTags: ["少油", "清淡"]
    }
  });

  assert.equal(ranked[0].id, "profile-match");
});

test("recent takeout streak boosts a different dinner type", () => {
  const cards = [
    {
      id: "another-takeout",
      type: "takeout",
      title: "热汤面外卖",
      baseScore: 82,
      estimatedCostPerPerson: 34,
      searchKeywords: ["热汤面", "少油"]
    },
    {
      id: "home-rice",
      type: "cook",
      title: "虾仁豆腐饭",
      baseScore: 66,
      estimatedCostPerPerson: 28,
      searchKeywords: ["虾仁", "豆腐", "米饭"],
      nutritionSummary: { protein: "约34g/人" }
    }
  ];

  const ranked = rankDecisionCards(cards, {
    recentMeals: [
      { type: "takeout", title: "热汤面", searchKeywords: ["热汤面", "少油"] },
      { type: "takeout", title: "鸡胸饭", searchKeywords: ["鸡胸", "少油"] },
      { type: "takeout", title: "砂锅粥", searchKeywords: ["砂锅粥", "清淡"] }
    ]
  });

  assert.equal(ranked[0].id, "home-rice");
});

test("refreshing a lazy cook card returns an easy cook option", () => {
  const refreshed = refreshCard("cook", "lazy");

  assert.equal(refreshed.type, "cook");
  assert.equal(refreshed.complexity, "easy");
  assert.match(refreshed.primaryAction.label, /菜谱/);
});

test("builds recommendation signals from profile, context, and learning memory", () => {
  const signals = buildRecommendationSignals(
    {
      type: "cook",
      title: "番茄虾仁豆腐饭",
      complexity: "easy",
      searchKeywords: ["虾仁", "豆腐", "番茄"],
      nutritionSummary: { note: "蛋白质充足,油脂适中" }
    },
    { nutritionGoal: "高蛋白控油" },
    {
      mood: "lazy",
      recentMeals: [{ title: "青菜鸡蛋面" }],
      feedbackLearning: { likedKeywords: ["虾仁"] }
    }
  );

  assert.deepEqual(signals, ["匹配高蛋白控油", "适合偷懒模式", "靠近偏好 虾仁"]);
});

test("builds weather and budget signals for takeout cards", () => {
  const signals = buildRecommendationSignals(
    {
      type: "takeout",
      title: "热汤面",
      estimatedCostPerPerson: 28,
      searchKeywords: ["热汤面", "少油"]
    },
    { budgetPerPerson: "30_60" },
    { mood: "normal", weather: { isRaining: true } }
  );

  assert.deepEqual(signals, ["雨天省心", "符合预算 ¥30-60"]);
});

test("builds a budget recovery signal for low-cost cook cards", () => {
  const signals = buildRecommendationSignals(
    {
      type: "cook",
      title: "青菜鸡蛋热汤面",
      complexity: "easy",
      estimatedCostPerPerson: 12,
      searchKeywords: ["挂面", "鸡蛋"]
    },
    { budgetPerPerson: "30_60" },
    {
      recentMeals: [
        { estimatedCostPerPerson: 88 },
        { estimatedCostPerPerson: 75 },
        { estimatedCostPerPerson: 34 }
      ]
    }
  );

  assert.deepEqual(signals, ["帮你拉回预算", "符合预算 ¥30-60"]);
});

test("builds a satisfaction recovery signal for filling budget-friendly cards", () => {
  const signals = buildRecommendationSignals(
    {
      type: "cook",
      title: "鸡胸糙米饭",
      estimatedCostPerPerson: 28,
      searchKeywords: ["鸡胸", "糙米饭"],
      nutritionSummary: { protein: "约35g/人" }
    },
    { budgetPerPerson: "30_60" },
    { feedbackLearning: { constraints: ["提高满足感,预算内增加蛋白质和主食"] } }
  );

  assert.deepEqual(signals, ["补足满足感", "符合预算 ¥30-60"]);
});

test("builds an effort recovery signal after too much effort feedback", () => {
  const signals = buildRecommendationSignals(
    {
      type: "cook",
      title: "青菜鸡蛋热汤面",
      estimatedMinutes: 15,
      complexity: "easy",
      estimatedCostPerPerson: 12,
      searchKeywords: ["挂面", "鸡蛋"]
    },
    { budgetPerPerson: "30_60" },
    { feedbackLearning: { lastFeedback: { tag: "太麻烦" } } }
  );

  assert.deepEqual(signals, ["少折腾", "符合预算 ¥30-60"]);
});

test("builds a lightness recovery signal after oily or salty feedback", () => {
  const signals = buildRecommendationSignals(
    {
      type: "takeout",
      title: "清淡砂锅粥",
      estimatedCostPerPerson: 28,
      searchKeywords: ["砂锅粥", "清淡", "少油"],
      nutritionSummary: { note: "清淡少油,热乎舒服" }
    },
    { budgetPerPerson: "30_60" },
    { feedbackLearning: { lastFeedback: { tag: "太油/太咸" } } }
  );

  assert.deepEqual(signals, ["清爽少油", "符合预算 ¥30-60"]);
});

test("builds a taste avoidance signal after bad taste feedback", () => {
  const signals = buildRecommendationSignals(
    {
      type: "takeout",
      title: "清淡砂锅粥",
      estimatedCostPerPerson: 28,
      searchKeywords: ["砂锅粥", "清淡", "少油"]
    },
    { budgetPerPerson: "30_60" },
    {
      feedbackLearning: {
        avoidedKeywords: ["麻辣烫", "可选菜"],
        lastFeedback: { tag: "不合口味" }
      }
    }
  );

  assert.deepEqual(signals, ["避开上次口味", "符合预算 ¥30-60"]);
});

test("builds a cooking willingness signal for matching cards", () => {
  const signals = buildRecommendationSignals(
    {
      type: "cook",
      title: "土豆炖牛腩",
      estimatedMinutes: 55,
      complexity: "rich",
      estimatedCostPerPerson: 48,
      searchKeywords: ["牛腩", "土豆"]
    },
    { cookingWillingness: "high", budgetPerPerson: "30_60" },
    {}
  );

  assert.deepEqual(signals, ["符合做饭意愿", "符合预算 ¥30-60"]);
});

test("builds a profile preference signal for matching cards", () => {
  const signals = buildRecommendationSignals(
    {
      type: "cook",
      title: "虾仁豆腐家常饭",
      estimatedCostPerPerson: 28,
      searchKeywords: ["虾仁", "豆腐", "家常", "少油"],
      ingredients: [
        { name: "虾仁" },
        { name: "豆腐" }
      ]
    },
    {
      favoriteIngredients: ["虾仁", "豆腐"],
      cuisinePreferences: ["家常"],
      tasteTags: ["少油"],
      budgetPerPerson: "30_60"
    },
    {}
  );

  assert.deepEqual(signals, ["贴合画像偏好", "符合预算 ¥30-60"]);
});

test("builds visible preference match details from profile terms", () => {
  const details = buildPreferenceMatchDetails(
    {
      type: "cook",
      title: "虾仁豆腐家常饭",
      searchKeywords: ["虾仁", "豆腐", "家常", "少油"],
      ingredients: [{ name: "虾仁" }, { name: "豆腐" }]
    },
    {
      favoriteIngredients: ["虾仁", "豆腐", "虾仁"],
      cuisinePreferences: ["家常"],
      tasteTags: ["都行", "少油"]
    }
  );

  assert.deepEqual(details, ["喜欢虾仁", "喜欢豆腐", "偏好家常", "口味少油"]);
});

test("builds a recommendation score breakdown that matches the final score delta", () => {
  const card = {
    id: "profile-budget-match",
    type: "cook",
    title: "番茄虾仁豆腐饭",
    baseScore: 66,
    complexity: "easy",
    estimatedMinutes: 25,
    estimatedCostPerPerson: 28,
    searchKeywords: ["虾仁", "豆腐", "番茄", "家常", "少油"],
    ingredients: [{ name: "虾仁" }, { name: "豆腐" }],
    nutritionSummary: { protein: "约34g/人", note: "高蛋白少油" }
  };
  const context = {
    mood: "normal",
    profile: {
      nutritionGoal: "高蛋白控油",
      cookingWillingness: "normal",
      favoriteIngredients: ["虾仁", "豆腐"],
      cuisinePreferences: ["家常"],
      tasteTags: ["少油"],
      budgetPerPerson: "30_60"
    },
    recentMeals: [
      { estimatedCostPerPerson: 88 },
      { estimatedCostPerPerson: 75 },
      { estimatedCostPerPerson: 34 }
    ]
  };

  const breakdown = buildRecommendationBreakdown(card, context);

  assert.deepEqual(
    breakdown.map((item) => [item.id, item.label, item.value, item.text]),
    [
      ["nutrition", "营养目标", 24, "+24"],
      ["budget_recovery", "预算修正", 22, "+22"],
      ["profile_preference", "画像偏好", 18, "+18"],
      ["cooking_willingness", "做饭意愿", 8, "+8"]
    ]
  );
  assert.equal(
    breakdown.reduce((sum, item) => sum + item.value, 0),
    scoreCard(card, context) - card.baseScore
  );
});

test("builds profile tuning actions from the current top recommendation", () => {
  const actions = buildProfileTuningActions(
    {
      type: "cook",
      title: "番茄虾仁豆腐饭",
      complexity: "easy",
      estimatedMinutes: 25,
      estimatedCostPerPerson: 28,
      searchKeywords: ["虾仁", "豆腐", "番茄", "少油"],
      nutritionSummary: { protein: "约34g/人", note: "高蛋白少油" }
    },
    {
      nutritionGoal: "均衡",
      cookingWillingness: "normal",
      tasteTags: ["微辣"],
      budgetPerPerson: "30_60"
    },
    {}
  );

  assert.deepEqual(
    actions.map((action) => [action.id, action.label, action.detail]),
    [
      ["prefer_high_protein", "加强高蛋白", "下次更偏向蛋白质充足的方案"],
      ["prefer_light", "加强清淡少油", "把清淡、少油写进画像"],
      ["prefer_cooking", "多推自己做", "下次更偏向有菜谱的方案"]
    ]
  );
});

test("builds daily review impact details from learning-related scoring", () => {
  const impacts = buildDailyReviewImpacts(
    {
      type: "takeout",
      title: "清淡砂锅粥",
      estimatedCostPerPerson: 28,
      searchKeywords: ["砂锅粥", "清淡", "少油"],
      nutritionSummary: { note: "清淡少油" }
    },
    {
      profile: { budgetPerPerson: "30_60" },
      feedbackLearning: { lastFeedback: { tag: "太油/太咸" }, constraints: ["少油少盐,避免重口味"] }
    }
  );

  assert.deepEqual(impacts.map((item) => [item.id, item.label, item.text]), [
    ["lightness_recovery", "清爽少油", "+22"]
  ]);

  const tasteImpacts = buildDailyReviewImpacts(
    {
      type: "takeout",
      title: "清淡砂锅粥",
      estimatedCostPerPerson: 28,
      searchKeywords: ["砂锅粥", "清淡", "少油"]
    },
    {
      feedbackLearning: {
        avoidedKeywords: ["麻辣烫", "可选菜"],
        lastFeedback: { tag: "不合口味" }
      }
    }
  );

  assert.deepEqual(tasteImpacts.map((item) => [item.id, item.label, item.text]), [
    ["taste_avoidance", "避开上次口味", "+8"]
  ]);
});

test("builds ranking comparison summaries for ordered dinner cards", () => {
  const cards = [
    {
      id: "top-cook",
      type: "cook",
      title: "番茄虾仁豆腐饭",
      baseScore: 70,
      estimatedCostPerPerson: 28,
      complexity: "easy",
      searchKeywords: ["虾仁", "豆腐", "少油"],
      nutritionSummary: { protein: "约34g/人", note: "高蛋白少油" }
    },
    {
      id: "second-takeout",
      type: "takeout",
      title: "热汤面外卖",
      baseScore: 68,
      estimatedCostPerPerson: 34,
      searchKeywords: ["热汤面", "少油"]
    },
    {
      id: "third-dine",
      type: "dine_out",
      title: "附近粤菜小馆",
      baseScore: 64,
      estimatedCostPerPerson: 88,
      searchKeywords: ["粤菜", "清淡"]
    }
  ];

  const comparisons = buildRankingComparisons(cards, {
    weather: { isRaining: true },
    profile: { nutritionGoal: "高蛋白控油", budgetPerPerson: "30_60" }
  });

  assert.deepEqual(
    comparisons.map((item) => [item.cardId, item.rankLabel, item.deltaText, item.reason]),
    [
      ["top-cook", "第1名", "当前最优", "营养目标 +24"],
      ["second-takeout", "第2名", "落后 14 分", "天气 +12"],
      ["third-dine", "第3名", "落后 44 分", "天气 -14"]
    ]
  );
});

test("builds budget alerts and cheaper alternatives for over-budget cards", () => {
  const overBudgetDineOut = {
    id: "dine-yue",
    type: "dine_out",
    title: "附近粤菜小馆",
    estimatedCostPerPerson: 88,
    searchKeywords: ["粤菜", "清淡"]
  };

  assert.deepEqual(
    buildBudgetAlert(
      overBudgetDineOut,
      { budgetPerPerson: "30_60" }
    ),
    {
      title: "超预算 ¥28/人",
      detail: "先看团购套餐,或者改成相近外卖/自己做。",
      alternatives: ["团购套餐", "同类外卖", "自己做相近口味"],
      actions: [
        {
          id: "group_deal",
          label: "看团购套餐",
          type: "platform",
          platform: "meituan",
          keywords: ["附近粤菜小馆", "粤菜", "清淡", "团购", "套餐"]
        },
        {
          id: "similar_takeout",
          label: "搜同类外卖",
          type: "platform",
          platform: "meituan",
          keywords: ["粤菜", "清淡", "外卖", "低价"]
        },
        {
          id: "cook_similar",
          label: "买食材自己做",
          type: "platform",
          platform: "xiaoxiang",
          keywords: ["粤菜", "清淡", "家常", "食材"]
        }
      ]
    }
  );
  assert.equal(
    buildBudgetAlert({ type: "takeout", estimatedCostPerPerson: 28 }, { budgetPerPerson: "30_60" }),
    null
  );
  assert.deepEqual(
    buildBudgetAlert(overBudgetDineOut, { budgetPerPerson: "30_60" }, [
      overBudgetDineOut,
      { id: "takeout-noodle", title: "热汤面", type: "takeout", estimatedCostPerPerson: 34 },
      { id: "cook-shrimp", title: "番茄虾仁豆腐饭", type: "cook", estimatedCostPerPerson: 28 },
      { id: "cook-beef", title: "牛腩饭", type: "cook", estimatedCostPerPerson: 68 }
    ])?.swapSuggestion,
    {
      cardId: "cook-shrimp",
      title: "番茄虾仁豆腐饭",
      label: "改选更省钱",
      savingText: "省 ¥60/人",
      detail: "预算内,人均约 ¥28"
    }
  );
  assert.deepEqual(
    buildBudgetAlert(
      {
        type: "cook",
        title: "虾仁豆腐饭",
        estimatedCostPerPerson: 48,
        ingredients: [{ name: "虾仁" }, { name: "嫩豆腐" }]
      },
      { budgetPerPerson: "15_30" }
    ),
    {
      title: "超预算 ¥18/人",
      detail: "少买高价主材,用鸡蛋/鸡胸肉替代部分虾仁。",
      alternatives: ["鸡蛋", "鸡胸肉", "豆腐"],
      actions: [
        {
          id: "cheap_ingredients",
          label: "搜平价替代食材",
          type: "platform",
          platform: "xiaoxiang",
          keywords: ["鸡蛋", "鸡胸肉", "豆腐", "平价", "特价"]
        }
      ]
    }
  );
});

test("builds a variety signal after repeated recent meal types", () => {
  const signals = buildRecommendationSignals(
    {
      type: "cook",
      title: "虾仁豆腐饭",
      estimatedCostPerPerson: 28,
      searchKeywords: ["虾仁", "豆腐", "米饭"]
    },
    { budgetPerPerson: "30_60" },
    {
      recentMeals: [
        { type: "takeout", title: "热汤面", searchKeywords: ["热汤面", "少油"] },
        { type: "takeout", title: "鸡胸饭", searchKeywords: ["鸡胸", "少油"] },
        { type: "takeout", title: "砂锅粥", searchKeywords: ["砂锅粥", "清淡"] }
      ]
    }
  );

  assert.deepEqual(signals, ["换换口味", "符合预算 ¥30-60"]);
});

test("builds compact tradeoff metrics for dinner cards", () => {
  const metrics = buildDecisionTradeoffs(
    {
      type: "cook",
      estimatedMinutes: 25,
      estimatedCostPerPerson: 28,
      costText: "约¥28/人",
      timeText: "25分钟",
      complexity: "easy",
      nutritionSummary: { protein: "约34g/人", note: "蛋白质充足,油脂适中" }
    },
    { budgetPerPerson: "30_60" }
  );

  assert.deepEqual(
    metrics.map((metric) => [metric.id, metric.label, metric.value, metric.text]),
    [
      ["time", "省时", 85, "25分钟"],
      ["cost", "预算", 100, "约¥28/人"],
      ["nutrition", "营养", 90, "约34g/人"],
      ["effort", "省事", 90, "简单"]
    ]
  );
});

test("builds conservative tradeoffs when nutrition fields are missing", () => {
  const metrics = buildDecisionTradeoffs(
    {
      type: "dine_out",
      estimatedMinutes: 70,
      estimatedCostPerPerson: 88,
      complexity: "rich"
    },
    { budgetPerPerson: "30_60" }
  );

  assert.deepEqual(
    metrics.map((metric) => [metric.id, metric.value, metric.text]),
    [
      ["time", 25, "70分钟"],
      ["cost", 30, "约¥88/人"],
      ["nutrition", 55, "常规"],
      ["effort", 55, "要出门"]
    ]
  );
});
