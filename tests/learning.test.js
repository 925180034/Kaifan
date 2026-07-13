import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDailyReview,
  buildFeedbackProfileSuggestion,
  buildLearningSummary,
  buildNextMealPlan,
  buildQuickFeedbackPrompt,
  buildGenerationContext,
  recordCompletedMeal,
  recordMealFeedback,
  recordFeedbackLearning,
  recordSelectedMeal
} from "../src/learning.js";

const sampleCard = {
  id: "cook-shrimp-tofu",
  type: "cook",
  title: "虾仁豆腐饭",
  searchKeywords: ["虾仁", "豆腐", "番茄"],
  estimatedCostPerPerson: 28,
  costText: "约¥28/人"
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
  assert.equal(state.recentMeals[0].estimatedCostPerPerson, 28);
  assert.equal(state.recentMeals[0].costText, "约¥28/人");
  assert.equal(state.recentMeals.length, 2);
  assert.deepEqual(state.recentMeals.map((meal) => meal.id), ["cook-shrimp-tofu", "old-card"]);
});

test("recordMealFeedback records only one feedback per meal", () => {
  const state = { feedback: [] };

  const first = recordMealFeedback(state, sampleCard.id, "太贵", "2026-07-07T19:30:00.000Z");
  const duplicate = recordMealFeedback(state, sampleCard.id, "太麻烦", "2026-07-07T19:35:00.000Z");

  assert.equal(first.recorded, true);
  assert.equal(duplicate.recorded, false);
  assert.deepEqual(state.feedback, [
    {
      cardId: sampleCard.id,
      tag: "太贵",
      createdAt: "2026-07-07T19:30:00.000Z"
    }
  ]);
});

test("recordMealFeedback allows the same card after a new meal selection", () => {
  const state = {
    feedback: [
      {
        cardId: sampleCard.id,
        tag: "太贵",
        createdAt: "2026-07-07T19:30:00.000Z",
        mealSelectedAt: "2026-07-07T12:00:00.000Z"
      }
    ]
  };

  const nextMeal = { selectedAt: "2026-07-09T12:00:00.000Z" };
  const firstForNewMeal = recordMealFeedback(
    state,
    sampleCard.id,
    "好吃,下次还吃",
    "2026-07-09T19:30:00.000Z",
    nextMeal
  );
  const duplicateForNewMeal = recordMealFeedback(
    state,
    sampleCard.id,
    "太麻烦",
    "2026-07-09T19:35:00.000Z",
    nextMeal
  );

  assert.equal(firstForNewMeal.recorded, true);
  assert.equal(duplicateForNewMeal.recorded, false);
  assert.equal(state.feedback.length, 2);
  assert.deepEqual(state.feedback[0], {
    cardId: sampleCard.id,
    tag: "好吃,下次还吃",
    createdAt: "2026-07-09T19:30:00.000Z",
    mealSelectedAt: "2026-07-09T12:00:00.000Z"
  });
});

test("recordMealFeedback allows a new selected meal after timestamp-less legacy feedback", () => {
  const state = {
    feedback: [{ cardId: sampleCard.id, tag: "太贵" }]
  };

  const result = recordMealFeedback(
    state,
    sampleCard.id,
    "好吃,下次还吃",
    "2026-07-09T19:30:00.000Z",
    { selectedAt: "2026-07-09T12:00:00.000Z" }
  );

  assert.equal(result.recorded, true);
  assert.deepEqual(state.feedback[0], {
    cardId: sampleCard.id,
    tag: "好吃,下次还吃",
    createdAt: "2026-07-09T19:30:00.000Z",
    mealSelectedAt: "2026-07-09T12:00:00.000Z"
  });
});

test("recordCompletedMeal marks a cooked meal complete and moves it to the top", () => {
  const state = {
    recentMeals: [
      { id: "old-card", title: "青菜鸡蛋面", selectedAt: "2026-07-06T12:00:00.000Z" },
      { id: "cook-shrimp-tofu", title: "虾仁豆腐饭", selectedAt: "2026-07-05T12:00:00.000Z" }
    ]
  };

  recordCompletedMeal(state, sampleCard, "2026-07-07T19:20:00.000Z");

  assert.equal(state.recentMeals[0].id, "cook-shrimp-tofu");
  assert.equal(state.recentMeals[0].completedAt, "2026-07-07T19:20:00.000Z");
  assert.equal(state.recentMeals[0].selectedAt, "2026-07-05T12:00:00.000Z");
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

test("unsatisfying feedback keeps budget but asks for more substance", () => {
  const state = {};

  recordFeedbackLearning(state, sampleCard, "不够满足", "2026-07-07T12:00:00.000Z");

  assert.deepEqual(state.feedbackLearning.avoidedKeywords, ["虾仁", "豆腐", "番茄"]);
  assert.deepEqual(state.feedbackLearning.constraints, ["提高满足感,预算内增加蛋白质和主食"]);
});

test("buildGenerationContext adds learning memory without mutating base context", () => {
  const baseContext = { mood: "normal", weather: { isRaining: false } };
  const state = {
    recentMeals: [{ id: "cook-shrimp-tofu", title: "虾仁豆腐饭" }],
    favoriteMeals: [
      {
        id: "cook-tomato-egg",
        type: "cook",
        title: "番茄鸡蛋面",
        searchKeywords: ["番茄", "鸡蛋"]
      }
    ],
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
  assert.deepEqual(context.favoriteMeals, [
    {
      id: "cook-tomato-egg",
      type: "cook",
      title: "番茄鸡蛋面",
      searchKeywords: ["番茄", "鸡蛋"]
    }
  ]);
  assert.deepEqual(context.feedbackLearning.likedKeywords, ["鸡胸肉"]);
});

test("buildLearningSummary explains liked keywords and constraints", () => {
  const summary = buildLearningSummary({
    likedKeywords: ["虾仁", "豆腐", "番茄"],
    avoidedKeywords: ["肥肉"],
    constraints: ["少油少盐,避免重口味"],
    lastFeedback: { tag: "太油/太咸" }
  });

  assert.equal(summary.title, "正在学习你的晚餐偏好");
  assert.deepEqual(summary.chips, ["更偏向 虾仁/豆腐/番茄", "已避开 肥肉", "记住 少油少盐"]);
  assert.equal(summary.lastFeedbackText, "上次反馈: 太油/太咸");
  assert.deepEqual(summary.impact, {
    title: "下次会这样调整",
    items: ["少推油咸重口", "提高清淡少油权重"]
  });
});

test("buildLearningSummary explains budget feedback impact", () => {
  const summary = buildLearningSummary({
    avoidedKeywords: ["粤菜", "清淡"],
    constraints: ["控制预算,少推荐高价方案"],
    lastFeedback: { tag: "太贵" }
  });

  assert.deepEqual(summary.impact, {
    title: "下次会这样调整",
    items: ["少推高价方案", "优先预算内和自己做"]
  });
});

test("buildLearningSummary returns null without useful learning data", () => {
  assert.equal(buildLearningSummary(null), null);
  assert.equal(buildLearningSummary({ likedKeywords: [], avoidedKeywords: [], constraints: [] }), null);
});

test("builds a quick feedback prompt for the latest unreviewed meal", () => {
  assert.deepEqual(
    buildQuickFeedbackPrompt(
      [
        {
          id: "cook-shrimp-tofu",
          title: "虾仁豆腐饭"
        }
      ],
      []
    ),
    {
      cardId: "cook-shrimp-tofu",
      title: "这顿吃完了吗?",
      text: "给 虾仁豆腐饭 记一笔,下次推荐会更准。",
      tags: ["好吃,下次还吃", "太贵", "太麻烦", "不够满足", "太油/太咸", "不合口味"]
    }
  );
  assert.equal(
    buildQuickFeedbackPrompt(
      [{ id: "cook-shrimp-tofu", title: "虾仁豆腐饭" }],
      [{ cardId: "cook-shrimp-tofu", tag: "太贵" }]
    ),
    null
  );
  assert.equal(buildQuickFeedbackPrompt([], []), null);
});

test("builds a quick feedback prompt for a repeated card selected again", () => {
  assert.equal(
    buildQuickFeedbackPrompt(
      [{ id: "cook-shrimp-tofu", title: "虾仁豆腐饭", selectedAt: "2026-07-07T12:00:00.000Z" }],
      [{ cardId: "cook-shrimp-tofu", tag: "太贵", createdAt: "2026-07-07T19:30:00.000Z" }]
    ),
    null
  );

  const prompt = buildQuickFeedbackPrompt(
    [{ id: "cook-shrimp-tofu", title: "虾仁豆腐饭", selectedAt: "2026-07-09T12:00:00.000Z" }],
    [{ cardId: "cook-shrimp-tofu", tag: "太贵", createdAt: "2026-07-07T19:30:00.000Z" }]
  );

  assert.equal(prompt.cardId, "cook-shrimp-tofu");
});

test("builds a quick feedback prompt after timestamp-less legacy feedback for a new selection", () => {
  const prompt = buildQuickFeedbackPrompt(
    [{ id: "cook-shrimp-tofu", title: "虾仁豆腐饭", selectedAt: "2026-07-09T12:00:00.000Z" }],
    [{ cardId: "cook-shrimp-tofu", tag: "太贵" }]
  );

  assert.equal(prompt.cardId, "cook-shrimp-tofu");
  assert.equal(prompt.title, "这顿吃完了吗?");
});

test("builds a completed-meal quick feedback prompt", () => {
  assert.deepEqual(
    buildQuickFeedbackPrompt(
      [
        {
          id: "cook-shrimp-tofu",
          title: "虾仁豆腐饭",
          completedAt: "2026-07-07T19:20:00.000Z"
        }
      ],
      []
    ),
    {
      cardId: "cook-shrimp-tofu",
      title: "这顿吃得怎么样?",
      text: "给 虾仁豆腐饭 留个反馈,下次推荐会更准。",
      tags: ["好吃,下次还吃", "太贵", "太麻烦", "不够满足", "太油/太咸", "不合口味"]
    }
  );
});

test("builds a next meal plan from the latest selected meal", () => {
  assert.deepEqual(
    buildNextMealPlan(
      [
        {
          id: "dine-yue",
          type: "dine_out",
          title: "附近粤菜小馆",
          estimatedCostPerPerson: 88
        }
      ],
      { budgetPerPerson: "30_60" }
    ),
    {
      title: "下一餐建议",
      text: "上一餐人均 ¥88,下一餐建议选自己做或低价外卖把预算拉回来。",
      chips: ["预算拉回", "优先自己做", "人均 ¥30-60"]
    }
  );
  assert.deepEqual(
    buildNextMealPlan(
      [
        {
          id: "takeout-noodle",
          type: "takeout",
          title: "热汤面",
          estimatedCostPerPerson: 34
        }
      ],
      { budgetPerPerson: "30_60" }
    ),
    {
      title: "下一餐建议",
      text: "上一餐是外卖,下一餐可以准备一个 20 分钟内的家常方案换换节奏。",
      chips: ["换成自己做", "快手菜", "少洗碗"]
    }
  );
  assert.equal(buildNextMealPlan([], { budgetPerPerson: "30_60" }), null);
});

test("prioritizes feedback-specific next meal copy after too much effort", () => {
  const plan = buildNextMealPlan(
    [
      {
        id: "cook-beef",
        type: "cook",
        title: "土豆炖牛腩",
        estimatedCostPerPerson: 48
      }
    ],
    { budgetPerPerson: "30_60" },
    { lastFeedback: { tag: "太麻烦" } },
    [
      { id: "cook-beef", type: "cook", title: "土豆炖牛腩", estimatedMinutes: 55, complexity: "rich", estimatedCostPerPerson: 48 },
      { id: "cook-noodle", type: "cook", title: "青菜鸡蛋热汤面", estimatedMinutes: 15, complexity: "easy", estimatedCostPerPerson: 12 }
    ]
  );

  assert.equal(plan.text, "上次觉得太麻烦,下一餐优先 20 分钟内、少洗碗、低备菜压力的方案。");
  assert.deepEqual(plan.chips, ["少折腾", "20分钟内", "低负担"]);
  assert.equal(plan.action.label, "选这个少折腾");
});

test("builds a taste-switch next meal action after bad taste feedback", () => {
  const plan = buildNextMealPlan(
    [
      {
        id: "takeout-spicy",
        type: "takeout",
        title: "重口香辣炸鸡饭",
        searchKeywords: ["炸鸡", "香辣"],
        estimatedCostPerPerson: 36
      }
    ],
    { budgetPerPerson: "30_60" },
    { lastFeedback: { tag: "不合口味" }, avoidedKeywords: ["炸鸡", "香辣"] },
    [
      { id: "takeout-spicy", type: "takeout", title: "重口香辣炸鸡饭", searchKeywords: ["炸鸡", "香辣"], estimatedCostPerPerson: 36 },
      { id: "cook-shrimp", type: "cook", title: "番茄虾仁豆腐饭", searchKeywords: ["番茄", "虾仁", "豆腐"], estimatedCostPerPerson: 28 },
      { id: "takeout-fried", type: "takeout", title: "香辣鸡排饭", searchKeywords: ["香辣", "鸡排"], estimatedCostPerPerson: 32 }
    ]
  );

  assert.equal(plan.text, "上次觉得不合口味,下一餐先换一组关键词,避开相似口味。");
  assert.deepEqual(plan.chips, ["换口味", "避开相似", "重新试探"]);
  assert.deepEqual(plan.action, {
    cardId: "cook-shrimp",
    label: "选这个换口味",
    title: "番茄虾仁豆腐饭",
    detail: "避开 炸鸡/香辣,换一组关键词试探。",
    reasons: ["避开相似", "换关键词", "预算内"]
  });
});

test("builds a budget recovery action from expensive feedback", () => {
  assert.deepEqual(
    buildNextMealPlan(
      [
        {
          id: "dine-yue",
          type: "dine_out",
          title: "附近粤菜小馆",
          estimatedCostPerPerson: 88
        }
      ],
      { budgetPerPerson: "30_60" },
      { lastFeedback: { tag: "太贵" } },
      [
        { id: "dine-yue", type: "dine_out", title: "附近粤菜小馆", estimatedCostPerPerson: 88 },
        { id: "takeout-noodle", type: "takeout", title: "热汤面", estimatedCostPerPerson: 34 },
        { id: "cook-shrimp", type: "cook", title: "番茄虾仁豆腐饭", estimatedCostPerPerson: 28 }
      ]
    )?.action,
    {
      cardId: "cook-shrimp",
      label: "选这个省预算",
      title: "番茄虾仁豆腐饭",
      detail: "人均约 ¥28,比上一餐省 ¥60/人",
      reasons: ["省 ¥60/人", "预算内", "人均 ¥28"]
    }
  );
});

test("builds a low-effort action from too much effort feedback", () => {
  assert.deepEqual(
    buildNextMealPlan(
      [
        {
          id: "cook-beef",
          type: "cook",
          title: "土豆炖牛腩",
          estimatedCostPerPerson: 48
        }
      ],
      { budgetPerPerson: "30_60" },
      { lastFeedback: { tag: "太麻烦" } },
      [
        { id: "cook-beef", type: "cook", title: "土豆炖牛腩", estimatedMinutes: 55, complexity: "rich", estimatedCostPerPerson: 48 },
        { id: "cook-noodle", type: "cook", title: "青菜鸡蛋热汤面", estimatedMinutes: 15, complexity: "easy", estimatedCostPerPerson: 12 },
        { id: "dine-yue", type: "dine_out", title: "附近粤菜小馆", estimatedMinutes: 75, estimatedCostPerPerson: 88 }
      ]
    )?.action,
    {
      cardId: "cook-noodle",
      label: "选这个少折腾",
      title: "青菜鸡蛋热汤面",
      detail: "约 15 分钟,低负担备用",
      reasons: ["15 分钟", "低负担", "预算内"]
    }
  );
});

test("builds a lighter action from oily or salty feedback", () => {
  assert.deepEqual(
    buildNextMealPlan(
      [
        {
          id: "takeout-spicy",
          type: "takeout",
          title: "重口香辣炸鸡饭",
          estimatedCostPerPerson: 36
        }
      ],
      { budgetPerPerson: "30_60" },
      { lastFeedback: { tag: "太油/太咸" } },
      [
        { id: "takeout-spicy", type: "takeout", title: "重口香辣炸鸡饭", searchKeywords: ["炸鸡", "香辣"], estimatedCostPerPerson: 36 },
        {
          id: "takeout-light",
          type: "takeout",
          title: "轻食鸡胸饭",
          searchKeywords: ["轻食", "少油", "鸡胸"],
          nutritionSummary: { note: "清淡少油" },
          estimatedCostPerPerson: 32
        }
      ]
    )?.action,
    {
      cardId: "takeout-light",
      label: "选这个清淡点",
      title: "轻食鸡胸饭",
      detail: "清淡少油,避开重口",
      reasons: ["清淡少油", "避开重口", "预算内"]
    }
  );
});

test("builds a filling action from unsatisfying feedback", () => {
  assert.deepEqual(
    buildNextMealPlan(
      [
        {
          id: "cook-noodle",
          type: "cook",
          title: "青菜鸡蛋热汤面",
          estimatedCostPerPerson: 12
        }
      ],
      { budgetPerPerson: "30_60" },
      { lastFeedback: { tag: "不够满足" } },
      [
        { id: "cook-noodle", type: "cook", title: "青菜鸡蛋热汤面", estimatedCostPerPerson: 12, nutritionSummary: { protein: "约18g/人" } },
        {
          id: "cook-beef",
          type: "cook",
          title: "土豆炖牛腩 + 米饭",
          estimatedCostPerPerson: 48,
          nutritionSummary: { protein: "约42g/人", note: "饱腹感强" },
          searchKeywords: ["牛腩", "米饭"]
        }
      ]
    )?.action,
    {
      cardId: "cook-beef",
      label: "选这个更顶饱",
      title: "土豆炖牛腩 + 米饭",
      detail: "蛋白质 约42g/人,主食和蛋白更扎实",
      reasons: ["蛋白质 约42g/人", "更有饱腹感", "预算内"]
    }
  );
});

test("builds a daily review from the latest feedback memory", () => {
  assert.deepEqual(
    buildDailyReview({
      avoidedKeywords: ["炸鸡", "重口味"],
      constraints: ["少油少盐,避免重口味"],
      lastFeedback: { tag: "太油/太咸", cardTitle: "重口香辣炸鸡饭" }
    }),
    {
      title: "今日复盘",
      text: "上次觉得太油/太咸，今天默认更清淡少油。",
      chips: ["清淡少油", "避开重口"]
    }
  );
  assert.deepEqual(
    buildDailyReview({
      likedKeywords: ["虾仁", "豆腐"],
      lastFeedback: { tag: "好吃,下次还吃", cardTitle: "虾仁豆腐饭" }
    }),
    {
      title: "今日复盘",
      text: "上次喜欢虾仁豆腐饭，今天继续靠近你喜欢的口味。",
      chips: ["虾仁", "豆腐"]
    }
  );
  assert.equal(buildDailyReview(null), null);
});

test("builds profile update suggestions from actionable negative feedback", () => {
  assert.deepEqual(
    buildFeedbackProfileSuggestion({ lastFeedback: { tag: "太油/太咸" } }, { tasteTags: ["微辣"] }),
    {
      actionId: "prefer_light",
      title: "把画像调成清淡少油？",
      detail: "后续会更少推荐油咸重口的方案",
      buttonLabel: "确认写入画像"
    }
  );
  assert.equal(
    buildFeedbackProfileSuggestion({ lastFeedback: { tag: "太油/太咸" } }, { tasteTags: ["清淡", "少油"] }),
    null
  );
  assert.equal(
    buildFeedbackProfileSuggestion({ lastFeedback: { tag: "没吃饱" } }, { nutritionGoal: "均衡" })?.actionId,
    "prefer_high_protein"
  );
  assert.equal(
    buildFeedbackProfileSuggestion({ lastFeedback: { tag: "太麻烦" } }, { cookingWillingness: "normal" })?.actionId,
    "prefer_low_effort"
  );
  assert.equal(
    buildFeedbackProfileSuggestion({ lastFeedback: { tag: "太贵" } }, { budgetPerPerson: "30_60" })?.actionId,
    "tighten_budget"
  );
});
