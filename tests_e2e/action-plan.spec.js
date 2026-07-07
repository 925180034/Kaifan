import { expect, test } from "@playwright/test";

import {
  defaultDailyContext,
  defaultProfile,
  initialDecisionCards
} from "../src/sampleData.js";

test.beforeEach(async ({ page }) => {
  const decision = {
    decisionId: "e2e-decision",
    profile: defaultProfile,
    context: defaultDailyContext,
    cards: initialDecisionCards,
    topRecommendation: initialDecisionCards[0]
  };

  await page.route("**/api/profile/local-user", async (route) => {
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
});

test("opens a platform action plan from the dinner cards", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/晚餐决策助手/);
  await expect(page.getByRole("heading", { name: "晚餐决策助手" })).toBeVisible();
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
