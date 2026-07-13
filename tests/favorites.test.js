import test from "node:test";
import assert from "node:assert/strict";

import {
  favoriteHasRecipeDetails,
  findRecipeCard,
  hydrateFavoriteRecipeDetails,
  isFavoriteMeal,
  toggleFavoriteMeal
} from "../src/favorites.js";

const sampleCard = {
  id: "cook-shrimp-tofu",
  type: "cook",
  title: "番茄虾仁豆腐饭",
  searchKeywords: ["番茄", "虾仁", "豆腐"]
};

const recipeCard = {
  ...sampleCard,
  subtitle: "25 分钟快手菜",
  reason: "高蛋白,少油",
  costText: "约¥28/人",
  timeText: "25分钟",
  difficulty: "easy",
  nutritionSummary: { protein: "约34g/人" },
  ingredients: [{ name: "虾仁", amount: "200g", group: "肉蛋奶" }],
  steps: ["番茄炒出汁", "加入虾仁和豆腐煮熟"],
  primaryAction: { label: "看菜谱", action: "view_recipe" }
};

test("toggleFavoriteMeal adds a compact favorite meal", () => {
  const state = {};

  const active = toggleFavoriteMeal(state, sampleCard, "2026-07-08T12:00:00.000Z");

  assert.equal(active, true);
  assert.deepEqual(state.favoriteMeals, [
    {
      id: "cook-shrimp-tofu",
      type: "cook",
      title: "番茄虾仁豆腐饭",
      searchKeywords: ["番茄", "虾仁", "豆腐"],
      favoritedAt: "2026-07-08T12:00:00.000Z"
    }
  ]);
  assert.equal(isFavoriteMeal(state, "cook-shrimp-tofu"), true);
});

test("toggleFavoriteMeal removes an existing favorite meal", () => {
  const state = {
    favoriteMeals: [
      {
        id: "cook-shrimp-tofu",
        type: "cook",
        title: "番茄虾仁豆腐饭",
        searchKeywords: ["番茄", "虾仁", "豆腐"],
        favoritedAt: "2026-07-08T12:00:00.000Z"
      }
    ]
  };

  const active = toggleFavoriteMeal(state, sampleCard, "2026-07-09T12:00:00.000Z");

  assert.equal(active, false);
  assert.deepEqual(state.favoriteMeals, []);
  assert.equal(isFavoriteMeal(state, "cook-shrimp-tofu"), false);
});

test("toggleFavoriteMeal keeps newest favorites first and limits the list", () => {
  const state = {
    favoriteMeals: Array.from({ length: 12 }, (_, index) => ({
      id: `old-${index}`,
      type: "cook",
      title: `旧收藏 ${index}`,
      searchKeywords: [`旧收藏${index}`],
      favoritedAt: "2026-07-07T12:00:00.000Z"
    }))
  };

  toggleFavoriteMeal(state, sampleCard, "2026-07-08T12:00:00.000Z");

  assert.equal(state.favoriteMeals.length, 12);
  assert.equal(state.favoriteMeals[0].id, "cook-shrimp-tofu");
  assert.equal(state.favoriteMeals.at(-1).id, "old-10");
});

test("toggleFavoriteMeal preserves recipe details for reopening favorites", () => {
  const state = {};
  const card = JSON.parse(JSON.stringify(recipeCard));

  toggleFavoriteMeal(state, card, "2026-07-08T12:00:00.000Z");

  assert.equal(favoriteHasRecipeDetails(state.favoriteMeals[0]), true);
  assert.deepEqual(state.favoriteMeals[0].ingredients, card.ingredients);
  assert.deepEqual(state.favoriteMeals[0].steps, card.steps);
  assert.deepEqual(state.favoriteMeals[0].nutritionSummary, card.nutritionSummary);

  card.ingredients[0].name = "已修改";
  assert.equal(state.favoriteMeals[0].ingredients[0].name, "虾仁");
});

test("favoriteHasRecipeDetails rejects compact non-recipe favorites", () => {
  assert.equal(favoriteHasRecipeDetails(sampleCard), false);
  assert.equal(
    favoriteHasRecipeDetails({ ...recipeCard, ingredients: [], steps: recipeCard.steps }),
    false
  );
});

test("findRecipeCard can prefer saved favorite recipe details over a current card with the same id", () => {
  const currentCard = {
    id: "cook-shrimp-tofu",
    type: "cook",
    title: "当前推荐里的简化卡",
    searchKeywords: ["虾仁"]
  };
  const favoriteRecipe = {
    ...recipeCard,
    title: "收藏里保存的完整菜谱"
  };

  assert.equal(findRecipeCard([currentCard], [favoriteRecipe], "cook-shrimp-tofu"), currentCard);
  assert.equal(
    findRecipeCard([currentCard], [favoriteRecipe], "cook-shrimp-tofu", { preferFavorite: true }),
    favoriteRecipe
  );
});

test("hydrateFavoriteRecipeDetails fills old compact favorites from current recipe cards", () => {
  const state = {
    favoriteMeals: [
      {
        id: "cook-shrimp-tofu",
        type: "cook",
        title: "旧收藏标题",
        searchKeywords: ["旧关键词"],
        favoritedAt: "2026-07-08T12:00:00.000Z"
      },
      {
        id: "takeout-noodle",
        type: "takeout",
        title: "热汤面",
        searchKeywords: ["热汤面"],
        favoritedAt: "2026-07-07T12:00:00.000Z"
      }
    ]
  };

  const changed = hydrateFavoriteRecipeDetails(state, [recipeCard]);

  assert.equal(changed, true);
  assert.equal(state.favoriteMeals[0].id, "cook-shrimp-tofu");
  assert.equal(state.favoriteMeals[0].title, "番茄虾仁豆腐饭");
  assert.equal(state.favoriteMeals[0].favoritedAt, "2026-07-08T12:00:00.000Z");
  assert.equal(favoriteHasRecipeDetails(state.favoriteMeals[0]), true);
  assert.deepEqual(state.favoriteMeals[0].ingredients, recipeCard.ingredients);
  assert.equal(state.favoriteMeals[1].id, "takeout-noodle");
});
