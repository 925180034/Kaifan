import { expect, test } from "@playwright/test";

import {
  defaultDailyContext,
  defaultProfile,
  initialDecisionCards
} from "../src/sampleData.js";

const stateKey = "kaifan.mvp.state";

let apiProfile = defaultProfile;
let apiMemory = { recentMeals: [], favoriteMeals: [], feedbackLearning: null, feedback: [] };

function completedState(overrides = {}) {
  return {
    userId: "local-user",
    decisionId: null,
    profile: defaultProfile,
    context: defaultDailyContext,
    cards: initialDecisionCards,
    selectedCardId: null,
    selectedRecipeId: null,
    view: "today",
    profileCompleted: true,
    onboardingStep: 0,
    draftProfile: null,
    settingsPicker: null,
    clearDataArmed: false,
    checkedIngredients: {},
    doneSteps: {},
    feedback: [],
    recentMeals: [],
    favoriteMeals: [],
    feedbackLearning: null,
    apiAvailable: false,
    isGenerating: false,
    generationError: "",
    requestSequence: 0,
    activeRequestId: 0,
    ...overrides
  };
}

async function seedCompletedProfile(page, overrides = {}) {
  const seededState = completedState(overrides);
  apiProfile = seededState.profile;
  apiMemory = {
    recentMeals: seededState.recentMeals ?? [],
    favoriteMeals: seededState.favoriteMeals ?? [],
    feedbackLearning: seededState.feedbackLearning ?? null,
    feedback: seededState.feedback ?? []
  };

  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: stateKey, value: seededState }
  );
}

test.beforeEach(async ({ page }) => {
  apiProfile = defaultProfile;
  apiMemory = { recentMeals: [], favoriteMeals: [], feedbackLearning: null, feedback: [] };

  const buildDecision = (selectedCardId = null) => ({
    decisionId: "e2e-decision",
    profile: apiProfile,
    context: defaultDailyContext,
    cards: initialDecisionCards,
    selectedCardId,
    topRecommendation: initialDecisionCards[0]
  });

  await page.route("**/api/profile/local-user", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      apiProfile = payload.profile;
      await route.fulfill({ json: { userId: "local-user", profile: apiProfile } });
      return;
    }
    await route.fulfill({ json: { userId: "local-user", profile: apiProfile } });
  });

  await page.route("**/api/memory/local-user", async (route) => {
    await route.fulfill({
      json: {
        userId: "local-user",
        memory: apiMemory
      }
    });
  });

  await page.route("**/api/decision/today", async (route) => {
    await route.fulfill({ json: buildDecision() });
  });

  await page.route("**/api/decision/select", async (route) => {
    await route.fulfill({ json: buildDecision("takeout-noodle") });
  });

  await page.route("**/api/feedback", async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
});

test("opens a platform action plan from the dinner cards", async ({ page }) => {
  await seedCompletedProfile(page, {
    feedbackLearning: {
      likedKeywords: ["热汤面"],
      avoidedKeywords: [],
      constraints: [],
      lastFeedback: null
    }
  });
  await page.goto("/");

  await expect(page).toHaveTitle(/晚餐决策助手/);
  await expect(page.locator(".date-weather")).toContainText("7月6日");
  await expect(page.locator(".top-panel")).toContainText("今晚最推荐");
  await expect(page.locator(".top-panel")).toContainText("匹配高蛋白控油");
  await expect(page.locator(".top-panel")).toContainText("省时");
  await expect(page.locator(".top-panel")).toContainText("预算");
  await expect(page.locator(".decision-card")).toHaveCount(3);
  await expect(page.locator(".decision-card").first()).toContainText("第1名");
  await expect(page.locator(".decision-card").first()).toContainText("当前最优");
  await expect(page.locator(".decision-card").first()).toContainText("画像偏好");
  await expect(page.locator(".decision-card").first()).toContainText("营养");
  const budgetCard = page.locator('.decision-card[data-card-id="dine-yue"]');
  await expect(budgetCard).toContainText("超预算 ¥28/人");
  await expect(budgetCard).toContainText("团购套餐");
  await expect(budgetCard).toContainText("改选更省钱");
  await expect(budgetCard).toContainText("省 ¥60/人");
  await expect(budgetCard.getByRole("link", { name: "看团购套餐" })).toHaveAttribute("href", /meituan\.com/);
  await expect(budgetCard.getByRole("link", { name: "买食材自己做" })).toHaveAttribute("href", /wd=.*%E9%A3%9F%E6%9D%90/);
  await expect(page.locator("#generationStatus")).toContainText("已根据画像生成");

  await page.locator('[data-action="open_meituan"]').first().click();

  const actionSheet = page.locator("#actionSheet");
  await expect(actionSheet).toHaveAttribute("aria-hidden", "false");
  await expect(actionSheet).toContainText("点外卖执行方案");
  await expect(actionSheet).toContainText("去美团搜外卖");
  await expect(actionSheet).toContainText("不要香菜");
  await expect(actionSheet).toContainText("预算 ¥30-60/人");
  await expect(actionSheet).toContainText("复制搜索词");
  await expect(actionSheet).toContainText("下单前看一眼");
});

test("uses nutrition goals when choosing the top recommendation", async ({ page }) => {
  await seedCompletedProfile(page);
  await page.goto("/");

  const topPanel = page.locator(".top-panel");
  await expect(topPanel).toContainText("今晚最推荐 · 自己做");
  await expect(topPanel).toContainText("番茄虾仁豆腐饭");
  await expect(topPanel).toContainText("匹配高蛋白控油");
  await expect(topPanel).toContainText("营养目标");
  await expect(topPanel).toContainText("+14");
});

test("uses cooking willingness when choosing the top recommendation", async ({ page }) => {
  await seedCompletedProfile(page, {
    profile: {
      ...defaultProfile,
      cookingWillingness: "low",
      nutritionGoal: "均衡",
      favoriteIngredients: [],
      cuisinePreferences: [],
      tasteTags: []
    }
  });
  await page.goto("/");

  const topPanel = page.locator(".top-panel");
  await expect(topPanel).toContainText("今晚最推荐 · 点外卖");
  await expect(topPanel).toContainText("符合做饭意愿");
});

test("uses flavor profile preferences when choosing the top recommendation", async ({ page }) => {
  await seedCompletedProfile(page, {
    profile: {
      ...defaultProfile,
      nutritionGoal: "均衡",
      cookingWillingness: "normal",
      favoriteIngredients: ["虾仁", "豆腐", "番茄"],
      cuisinePreferences: ["家常"],
      tasteTags: ["清淡", "少油"]
    }
  });
  await page.goto("/");

  const topPanel = page.locator(".top-panel");
  await expect(topPanel).toContainText("番茄虾仁豆腐饭");
  await expect(topPanel).toContainText("贴合画像偏好");
  await expect(topPanel).toContainText("喜欢虾仁");
  await expect(topPanel).toContainText("喜欢豆腐");
});

test("applies quick profile tuning from the top recommendation", async ({ page }) => {
  const tunedProfile = {
    ...defaultProfile,
    nutritionGoal: "均衡",
    cookingWillingness: "normal",
    tasteTags: ["微辣"],
    favoriteIngredients: ["虾仁", "豆腐", "番茄"],
    cuisinePreferences: ["家常"]
  };
  await page.unroute("**/api/profile/local-user");
  await page.route("**/api/profile/local-user", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      await route.fulfill({ json: { userId: "local-user", profile: payload.profile } });
      return;
    }
    await route.fulfill({ json: { userId: "local-user", profile: tunedProfile } });
  });
  await seedCompletedProfile(page, { profile: tunedProfile });
  await page.goto("/");

  const topPanel = page.locator(".top-panel");
  await expect(topPanel).toContainText("想让推荐更准");
  await topPanel.getByRole("button", { name: /加强高蛋白/ }).click();

  await expect(page.locator("#profileSummary")).toContainText("高蛋白控油");
});

test("keeps local choices visible and offers retry when generation fails", async ({ page }) => {
  await seedCompletedProfile(page);
  await page.unroute("**/api/decision/today");
  await page.route("**/api/decision/today", async (route) => {
    await route.fulfill({ status: 503, json: { detail: "service unavailable" } });
  });

  await page.goto("/");

  await expect(page.locator(".decision-card")).toHaveCount(3);
  const recoveryPanel = page.locator("#recoveryPanel");
  await expect(recoveryPanel).toBeVisible();
  await expect(recoveryPanel).toContainText("生成暂时失败");
  await expect(recoveryPanel).toContainText("已保留本地方案");
  await expect(recoveryPanel.getByRole("button", { name: "重试生成" })).toBeVisible();
});

test("shows meal pattern insights in history", async ({ page }) => {
  await seedCompletedProfile(page, {
    recentMeals: [
      { id: "takeout-1", type: "takeout", title: "热汤面", selectedAt: "2026-07-08T11:00:00.000Z", searchKeywords: ["热汤面", "少油"] },
      { id: "takeout-2", type: "takeout", title: "鸡胸饭", selectedAt: "2026-07-07T11:00:00.000Z", searchKeywords: ["鸡胸", "少油"], estimatedCostPerPerson: 34 },
      { id: "takeout-3", type: "takeout", title: "砂锅粥", selectedAt: "2026-07-06T11:00:00.000Z", searchKeywords: ["砂锅粥", "清淡"], estimatedCostPerPerson: 32 },
      { id: "cook-1", type: "cook", title: "虾仁豆腐饭", selectedAt: "2026-07-05T11:00:00.000Z", searchKeywords: ["虾仁", "少油"], estimatedCostPerPerson: 28 }
    ],
    feedback: [{ tag: "太贵" }, { tag: "太油/太咸" }]
  });
  await page.goto("/");

  await page.getByRole("button", { name: /最近吃过/ }).click();

  const historySheet = page.locator("#historySheet");
  await expect(historySheet).toHaveAttribute("aria-hidden", "false");
  await expect(historySheet).toContainText("近况洞察");
  await expect(historySheet).toContainText("预计花费");
  await expect(historySheet).toContainText("近 3 次约 ¥94");
  await expect(historySheet).toContainText("符合预算 ¥30-60/人");
  await expect(historySheet).toContainText("点外卖 3/4 次");
  await expect(historySheet).toContainText("高频关键词");
  await expect(historySheet).toContainText("穿插一次自己做");
});

test("shows a cheaper next-meal suggestion when recent spending exceeds budget", async ({ page }) => {
  await seedCompletedProfile(page, {
    recentMeals: [
      { id: "dine-1", type: "dine_out", title: "烤肉", selectedAt: "2026-07-08T11:00:00.000Z", searchKeywords: ["烤肉"], estimatedCostPerPerson: 88 },
      { id: "dine-2", type: "dine_out", title: "火锅", selectedAt: "2026-07-07T11:00:00.000Z", searchKeywords: ["火锅"], estimatedCostPerPerson: 75 },
      { id: "takeout-1", type: "takeout", title: "盖饭", selectedAt: "2026-07-06T11:00:00.000Z", searchKeywords: ["盖饭"], estimatedCostPerPerson: 34 }
    ],
    feedback: [{ tag: "太贵" }]
  });
  await page.goto("/");

  await page.getByRole("button", { name: /最近吃过/ }).click();

  const historySheet = page.locator("#historySheet");
  await expect(historySheet).toContainText("高于预算 ¥30-60/人");
  await expect(historySheet).toContainText("下一餐优先自己做,把人均拉回预算内");
});

test("prioritizes low-cost cooking when recent spending exceeds budget", async ({ page }) => {
  await seedCompletedProfile(page, {
    recentMeals: [
      { id: "dine-1", type: "dine_out", title: "烤肉", selectedAt: "2026-07-08T11:00:00.000Z", searchKeywords: ["烤肉"], estimatedCostPerPerson: 88 },
      { id: "dine-2", type: "dine_out", title: "火锅", selectedAt: "2026-07-07T11:00:00.000Z", searchKeywords: ["火锅"], estimatedCostPerPerson: 75 },
      { id: "takeout-1", type: "takeout", title: "盖饭", selectedAt: "2026-07-06T11:00:00.000Z", searchKeywords: ["盖饭"], estimatedCostPerPerson: 34 }
    ]
  });
  await page.goto("/");

  const topPanel = page.locator(".top-panel");
  await expect(topPanel).toContainText("今晚最推荐 · 自己做");
  await expect(topPanel).toContainText("番茄虾仁豆腐饭");
  await expect(topPanel).toContainText("预算修正");
  await expect(topPanel).toContainText("+22");
});

test("surfaces a variety reason after repeated takeout meals", async ({ page }) => {
  await seedCompletedProfile(page, {
    recentMeals: [
      { id: "takeout-1", type: "takeout", title: "热汤面", selectedAt: "2026-07-08T11:00:00.000Z", searchKeywords: ["热汤面", "少油"], estimatedCostPerPerson: 34 },
      { id: "takeout-2", type: "takeout", title: "鸡胸饭", selectedAt: "2026-07-07T11:00:00.000Z", searchKeywords: ["鸡胸", "少油"], estimatedCostPerPerson: 32 },
      { id: "takeout-3", type: "takeout", title: "砂锅粥", selectedAt: "2026-07-06T11:00:00.000Z", searchKeywords: ["砂锅粥", "清淡"], estimatedCostPerPerson: 28 }
    ]
  });
  await page.goto("/");

  const topPanel = page.locator(".top-panel");
  await expect(topPanel).toContainText("今晚最推荐 · 自己做");
  await expect(topPanel).toContainText("番茄虾仁豆腐饭");
  await expect(topPanel).toContainText("换口味");
});

test("shows budget recovery grocery substitutions from a cooking recipe", async ({ page }) => {
  await seedCompletedProfile(page, {
    recentMeals: [
      { id: "dine-1", type: "dine_out", title: "烤肉", selectedAt: "2026-07-08T11:00:00.000Z", searchKeywords: ["烤肉"], estimatedCostPerPerson: 88 },
      { id: "dine-2", type: "dine_out", title: "火锅", selectedAt: "2026-07-07T11:00:00.000Z", searchKeywords: ["火锅"], estimatedCostPerPerson: 75 },
      { id: "takeout-1", type: "takeout", title: "盖饭", selectedAt: "2026-07-06T11:00:00.000Z", searchKeywords: ["盖饭"], estimatedCostPerPerson: 34 }
    ]
  });
  await page.goto("/");

  await page.locator(".top-panel").getByRole("button", { name: "别问了，就这个" }).click();
  await page.getByRole("button", { name: "去小象搜" }).click();

  const actionSheet = page.locator("#actionSheet");
  await expect(actionSheet).toHaveAttribute("aria-hidden", "false");
  await expect(actionSheet).toContainText("自己做执行方案");
  await expect(actionSheet).toContainText("省预算优先");
  await expect(actionSheet).toContainText("可替代: 鸡蛋/鸡胸肉替代部分虾仁");
});

test("collects the cold-start profile before generating dinner choices", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "几个人吃？" })).toBeVisible();
  await expect(page.getByRole("button", { name: /健康家常/ })).toBeVisible();
  await page.getByRole("button", { name: /健康家常/ }).click();
  await page.getByRole("button", { name: "2 人" }).click();

  await expect(page.getByRole("heading", { name: "有忌口或过敏吗？" })).toBeVisible();
  await page.getByRole("button", { name: "没有忌口" }).click();
  await page.getByRole("button", { name: "下一步" }).click();

  await expect(page.getByRole("heading", { name: "吃辣程度？" })).toBeVisible();
  await expect(page.getByRole("button", { name: /微辣/ })).toHaveClass(/is-selected/);
  await page.getByRole("button", { name: /微辣/ }).click();

  await expect(page.getByRole("heading", { name: "每人预算？" })).toBeVisible();
  await expect(page.getByRole("button", { name: /¥30-60/ })).toHaveClass(/is-selected/);
  await page.getByRole("button", { name: /¥30-60/ }).click();

  await expect(page.getByRole("heading", { name: "做饭意愿？" })).toBeVisible();
  await expect(page.getByRole("button", { name: /常做家常菜/ })).toHaveClass(/is-selected/);
  await page.getByRole("button", { name: /常做家常菜/ }).click();
  await page.getByRole("button", { name: "生成今晚方案" }).click();

  await expect(page.locator(".top-panel")).toContainText("今晚最推荐");
  await expect(page.locator(".decision-card")).toHaveCount(3);
});

test("edits profile settings from the dedicated settings page", async ({ page }) => {
  await seedCompletedProfile(page);
  await page.goto("/");

  await page.getByLabel("打开设置").click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();

  await page.getByRole("button", { name: /每人预算/ }).click();
  await page.getByRole("button", { name: "¥60+" }).click();
  await expect(page.getByRole("button", { name: /每人预算/ })).toContainText("¥60+");

  await page.getByRole("button", { name: "返回" }).click();
  await expect(page.locator(".top-panel")).toContainText("今晚最推荐");
});

test("opens the recipe detail page and tracks cooking progress", async ({ page }) => {
  await seedCompletedProfile(page);
  await page.goto("/");

  await page.locator('[data-action="view_recipe"]').first().click();

  await expect(page.getByRole("heading", { name: /番茄虾仁豆腐饭/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "备菜顺序" })).toBeVisible();
  await expect(page.locator(".prep-timeline")).toContainText("先处理蔬菜和配菜");
  await expect(page.getByRole("heading", { name: "食材" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "步骤" })).toBeVisible();

  await page.getByLabel("收藏").click();
  await expect(page.getByLabel("取消收藏")).toHaveAttribute("aria-pressed", "true");

  await page.locator("[data-ingredient-id]").first().click();
  await expect(page.locator("[data-ingredient-id]").first()).toHaveClass(/is-done/);

  await page.locator("[data-step-index]").first().click();
  await expect(page.locator("[data-step-index]").first()).toHaveClass(/is-done/);

  await page.getByRole("button", { name: "复制购物清单" }).click();
  await expect(page.locator("#toast")).toContainText("购物清单已复制");

  await page.getByRole("button", { name: "做完了" }).click();
  await expect(page.locator("#feedbackSheet")).toHaveAttribute("aria-hidden", "false");
});

test("opens a favorite recipe from history", async ({ page }) => {
  await seedCompletedProfile(page);
  await page.goto("/");

  await page.locator('[data-action="view_recipe"]').first().click();
  await page.getByLabel("收藏").click();
  await page.getByLabel("返回").click();

  await page.getByRole("button", { name: /最近吃过/ }).click();
  const historySheet = page.locator("#historySheet");
  await expect(historySheet).toContainText("常吃收藏");
  await expect(historySheet).toContainText("收藏采购清单");
  await expect(historySheet.getByRole("button", { name: "复制" })).toBeVisible();
  await expect(historySheet.getByRole("button", { name: "去小象搜" })).toBeVisible();
  await historySheet.getByRole("button", { name: "打开菜谱" }).click();

  await expect(page.getByRole("heading", { name: /番茄虾仁豆腐饭/ })).toBeVisible();
});

test("shows feedback learning summary after rating a meal", async ({ page }) => {
  await seedCompletedProfile(page);
  await page.goto("/");

  await page.locator('[data-action="view_recipe"]').first().click();
  await page.getByRole("button", { name: "做完了" }).click();
  await page.getByRole("button", { name: "太油/太咸" }).click();

  const learningSummary = page.locator("#learningSummary");
  await expect(learningSummary).toBeVisible();
  await expect(learningSummary).toContainText("正在学习你的晚餐偏好");
  await expect(learningSummary).toContainText("记住 少油少盐");
  await expect(learningSummary).toContainText("下次会这样调整");
  await expect(learningSummary).toContainText("少推油咸重口");
});

test("shows quick feedback after a selected meal", async ({ page }) => {
  await seedCompletedProfile(page, {
    recentMeals: [
      {
        id: "dine-yue",
        type: "dine_out",
        title: "附近粤菜小馆",
        selectedAt: "2026-07-08T11:00:00.000Z",
        searchKeywords: ["粤菜", "清淡"],
        estimatedCostPerPerson: 88
      }
    ],
    feedback: []
  });
  await page.goto("/");

  const quickFeedback = page.locator("#quickFeedbackPanel");
  await expect(quickFeedback).toBeVisible();
  await expect(quickFeedback).toContainText("这顿吃完了吗?");
  await expect(quickFeedback).toContainText("附近粤菜小馆");

  await quickFeedback.getByRole("button", { name: "太贵" }).click();

  await expect(quickFeedback).toBeHidden();
  await expect(page.locator("#learningSummary")).toContainText("记住 控制预算");
  await expect(page.locator("#learningSummary")).toContainText("少推高价方案");
  await expect(page.locator("#nextMealPlan")).toContainText("选这个省预算");
  await expect(page.locator("#nextMealPlan")).toContainText("番茄虾仁豆腐饭");
  await page.locator("[data-next-meal-card='cook-tomato-shrimp-tofu']").click();

  const selectedCard = page.locator("[data-card-id='cook-tomato-shrimp-tofu']");
  await expect(selectedCard).toContainText("来自下一餐建议");
  await expect(selectedCard).toContainText("省 ¥60/人");
});

test("shows a daily review when there is recent feedback memory", async ({ page }) => {
  await seedCompletedProfile(page, {
    feedbackLearning: {
      likedKeywords: [],
      avoidedKeywords: ["炸鸡", "重口味"],
      constraints: ["少油少盐,避免重口味"],
      lastFeedback: { tag: "太油/太咸", cardTitle: "重口香辣炸鸡饭" }
    }
  });
  await page.goto("/");

  const dailyReview = page.locator("#dailyReview");
  await expect(dailyReview).toBeVisible();
  await expect(dailyReview).toContainText("今日复盘");
  await expect(dailyReview).toContainText("上次觉得太油/太咸，今天默认更清淡少油。");
  await expect(dailyReview).toContainText("清淡少油");
  await expect(dailyReview).toContainText("清爽少油");
  await expect(dailyReview).toContainText("+22");
});

test("suggests a profile update after actionable feedback", async ({ page }) => {
  await seedCompletedProfile(page, {
    profile: {
      ...defaultProfile,
      tasteTags: ["微辣"],
      nutritionGoal: "均衡"
    }
  });
  await page.goto("/");

  await page.locator('[data-action="view_recipe"]').first().click();
  await page.getByRole("button", { name: "做完了" }).click();
  await page.getByRole("button", { name: "太油/太咸" }).click();

  const learningSummary = page.locator("#learningSummary");
  await expect(learningSummary).toContainText("把画像调成清淡少油？");
  await learningSummary.getByRole("button", { name: "确认写入画像" }).click();

  await expect(learningSummary).not.toContainText("把画像调成清淡少油？");
  await expect(page.locator("#toast")).toContainText("已写入画像");
});

test("learns when a budget meal is not satisfying enough", async ({ page }) => {
  await seedCompletedProfile(page);
  await page.goto("/");

  await page.locator('[data-action="view_recipe"]').first().click();
  await page.getByRole("button", { name: "做完了" }).click();
  await page.getByRole("button", { name: "不够满足" }).click();

  const learningSummary = page.locator("#learningSummary");
  await expect(learningSummary).toBeVisible();
  await expect(learningSummary).toContainText("上次反馈: 不够满足");
  await expect(learningSummary).toContainText("记住 提高满足感");
});

test("prioritizes low-effort choices after too much effort feedback", async ({ page }) => {
  await seedCompletedProfile(page, {
    feedbackLearning: {
      likedKeywords: [],
      avoidedKeywords: ["牛腩", "炖菜"],
      constraints: ["优先简单省事,少推荐复杂备菜"],
      lastFeedback: { tag: "太麻烦" }
    }
  });
  await page.goto("/");

  await expect(page.locator(".top-panel")).toContainText("省事修正");
});

test("prioritizes lighter choices after oily or salty feedback", async ({ page }) => {
  await seedCompletedProfile(page, {
    feedbackLearning: {
      likedKeywords: [],
      avoidedKeywords: ["香辣", "炸鸡", "重口味"],
      constraints: ["少油少盐,避免重口味"],
      lastFeedback: { tag: "太油/太咸" }
    }
  });
  await page.goto("/");

  await expect(page.locator(".top-panel")).toContainText("清爽修正");
});

test("avoids similar flavors after bad taste feedback", async ({ page }) => {
  await seedCompletedProfile(page, {
    feedbackLearning: {
      likedKeywords: [],
      avoidedKeywords: ["麻辣烫", "可选菜"],
      constraints: ["减少相似口味和关键词"],
      lastFeedback: { tag: "不合口味" }
    }
  });
  await page.goto("/");

  await expect(page.locator(".top-panel")).toContainText("口味避雷");
});

test("prioritizes satisfying budget-friendly meals after unsatisfying feedback", async ({ page }) => {
  await seedCompletedProfile(page, {
    feedbackLearning: {
      likedKeywords: [],
      avoidedKeywords: ["青菜", "汤饭"],
      constraints: ["提高满足感,预算内增加蛋白质和主食"],
      lastFeedback: { tag: "不够满足" }
    }
  });
  await page.goto("/");

  const topPanel = page.locator(".top-panel");
  await expect(topPanel).toContainText("今晚最推荐 · 自己做");
  await expect(topPanel).toContainText("番茄虾仁豆腐饭");
  await expect(topPanel).toContainText("满足感修正");
});
