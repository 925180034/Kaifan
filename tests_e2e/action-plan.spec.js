import { expect, test } from "@playwright/test";

import {
  defaultDailyContext,
  defaultProfile,
  initialDecisionCards
} from "../src/sampleData.js";

const stateKey = "kaifan.mvp.state";

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
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: stateKey, value: completedState(overrides) }
  );
}

test.beforeEach(async ({ page }) => {
  const decision = {
    decisionId: "e2e-decision",
    profile: defaultProfile,
    context: defaultDailyContext,
    cards: initialDecisionCards,
    topRecommendation: initialDecisionCards[0]
  };

  await page.route("**/api/profile/local-user", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      await route.fulfill({ json: { userId: "local-user", profile: payload.profile } });
      return;
    }
    await route.fulfill({ json: { userId: "local-user", profile: defaultProfile } });
  });

  await page.route("**/api/memory/local-user", async (route) => {
    await route.fulfill({
      json: {
        userId: "local-user",
        memory: { recentMeals: [], feedbackLearning: null, feedback: [] }
      }
    });
  });

  await page.route("**/api/decision/today", async (route) => {
    await route.fulfill({ json: decision });
  });

  await page.route("**/api/decision/select", async (route) => {
    await route.fulfill({ json: { ...decision, selectedCardId: "takeout-noodle" } });
  });

  await page.route("**/api/feedback", async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
});

test("opens a platform action plan from the dinner cards", async ({ page }) => {
  await seedCompletedProfile(page);
  await page.goto("/");

  await expect(page).toHaveTitle(/晚餐决策助手/);
  await expect(page.locator(".date-weather")).toContainText("7月6日");
  await expect(page.locator(".top-panel")).toContainText("今晚最推荐");
  await expect(page.locator(".decision-card")).toHaveCount(3);
  await expect(page.locator("#generationStatus")).toContainText("已根据画像生成");

  await page.locator('[data-action="open_meituan"]').first().click();

  const actionSheet = page.locator("#actionSheet");
  await expect(actionSheet).toHaveAttribute("aria-hidden", "false");
  await expect(actionSheet).toContainText("点外卖执行方案");
  await expect(actionSheet).toContainText("去美团搜外卖");
  await expect(actionSheet).toContainText("复制搜索词");
  await expect(actionSheet).toContainText("下单前看一眼");
});

test("collects the cold-start profile before generating dinner choices", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "几个人吃？" })).toBeVisible();
  await page.getByRole("button", { name: "2 人" }).click();

  await expect(page.getByRole("heading", { name: "有忌口或过敏吗？" })).toBeVisible();
  await page.getByRole("button", { name: "没有忌口" }).click();
  await page.getByRole("button", { name: "下一步" }).click();

  await expect(page.getByRole("heading", { name: "吃辣程度？" })).toBeVisible();
  await page.getByRole("button", { name: /微辣/ }).click();

  await expect(page.getByRole("heading", { name: "每人预算？" })).toBeVisible();
  await page.getByRole("button", { name: /¥30-60/ }).click();

  await expect(page.getByRole("heading", { name: "做饭意愿？" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "食材" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "步骤" })).toBeVisible();

  await page.locator("[data-ingredient-id]").first().click();
  await expect(page.locator("[data-ingredient-id]").first()).toHaveClass(/is-done/);

  await page.locator("[data-step-index]").first().click();
  await expect(page.locator("[data-step-index]").first()).toHaveClass(/is-done/);

  await page.getByRole("button", { name: "复制购物清单" }).click();
  await expect(page.locator("#toast")).toContainText("购物清单已复制");

  await page.getByRole("button", { name: "做完了" }).click();
  await expect(page.locator("#feedbackSheet")).toHaveAttribute("aria-hidden", "false");
});
