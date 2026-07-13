import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDecisionState,
  applyMemoryState,
  applyProfileState,
  beginMemorySync,
  beginProfileSync,
  completeMemorySync,
  completeProfileSync,
  failDecisionRequest,
  finishDecisionRequest,
  markLocalDecisionState,
  replaceDecisionCardState,
  selectDecisionCardState,
  shouldRetryMemorySync,
  startDecisionRequest
} from "../src/appState.js";

test("applying a decision keeps locally edited profile fields", () => {
  const state = {
    profile: {
      nutritionGoal: "低脂高蛋白",
      tasteTags: ["清淡", "鲜香", "少油"]
    },
    context: { mood: "treat" },
    cards: [],
    selectedActionContext: { cardId: "old-card", source: "next_meal", label: "旧建议", reasons: ["旧理由"] },
    apiAvailable: false
  };
  const decision = {
    decisionId: "decision-old-profile",
    profile: {
      nutritionGoal: "高蛋白控油",
      tasteTags: ["微辣"]
    },
    context: { mood: "normal" },
    cards: [{ id: "llm-cook", type: "cook" }],
    selectedCardId: null
  };

  applyDecisionState(state, decision, (cards) => cards.map((card) => ({ ...card })));

  assert.equal(state.decisionId, "decision-old-profile");
  assert.deepEqual(state.profile.tasteTags, ["清淡", "鲜香", "少油"]);
  assert.equal(state.profile.nutritionGoal, "低脂高蛋白");
  assert.deepEqual(state.context, { mood: "treat" });
  assert.equal(state.cards[0].id, "llm-cook");
  assert.equal(state.selectedActionContext, null);
  assert.equal(state.apiAvailable, true);
});

test("applying a decision stores generation source metadata", () => {
  const state = {
    profile: {},
    context: {},
    cards: [],
    apiAvailable: false,
    generationSource: ""
  };
  const decision = {
    decisionId: "decision-fallback",
    cards: [{ id: "fallback-cook", type: "cook" }],
    generationSource: "fallback",
    fallbackReason: "LLM card contains forbidden food: 虾仁"
  };

  applyDecisionState(state, decision, (cards) => cards.map((card) => ({ ...card })));

  assert.equal(state.generationSource, "fallback");
  assert.equal(state.fallbackReason, "LLM card contains forbidden food: 虾仁");
});

test("marking a decision local clears stale backend binding", () => {
  const state = {
    decisionId: "decision-api",
    apiAvailable: true,
    generationSource: "api",
    fallbackReason: ""
  };

  markLocalDecisionState(state, "后端换菜失败,已使用本地方案");

  assert.equal(state.decisionId, null);
  assert.equal(state.apiAvailable, false);
  assert.equal(state.generationSource, "fallback");
  assert.equal(state.fallbackReason, "后端换菜失败,已使用本地方案");
});

test("hydrating a default remote profile preserves a completed local profile", () => {
  const state = {
    profileCompleted: true,
    profile: {
      peopleCount: "1",
      spicyLevel: "none",
      budgetPerPerson: "60_plus",
      cookingWillingness: "high",
      nutritionGoal: "高蛋白控油"
    }
  };

  applyProfileState(state, {
    profileSource: "default",
    profile: {
      peopleCount: "2",
      spicyLevel: "mild",
      budgetPerPerson: "30_60",
      cookingWillingness: "normal",
      nutritionGoal: "均衡"
    }
  });

  assert.equal(state.profile.peopleCount, "1");
  assert.equal(state.profile.cookingWillingness, "high");
  assert.equal(state.profile.nutritionGoal, "高蛋白控油");
});

test("hydrating a stored remote profile replaces the local profile", () => {
  const state = {
    profileCompleted: true,
    profile: { peopleCount: "1", spicyLevel: "none" }
  };

  applyProfileState(state, {
    profileSource: "stored",
    profile: { peopleCount: "3-4", spicyLevel: "hot", budgetPerPerson: "60_plus" }
  });

  assert.deepEqual(state.profile, { peopleCount: "3-4", spicyLevel: "hot", budgetPerPerson: "60_plus" });
});

test("hydrating a stored remote profile preserves a completed local profile with pending sync", () => {
  const state = {
    profileCompleted: true,
    profileSyncPending: true,
    profile: { peopleCount: "1", spicyLevel: "none", budgetPerPerson: "60_plus" }
  };

  applyProfileState(state, {
    profileSource: "stored",
    profile: { peopleCount: "3-4", spicyLevel: "hot", budgetPerPerson: "15_30" }
  });

  assert.deepEqual(state.profile, { peopleCount: "1", spicyLevel: "none", budgetPerPerson: "60_plus" });
});

test("profile sync state helpers mark and clear pending sync", () => {
  const state = { profileSyncPending: false };

  beginProfileSync(state);
  assert.equal(state.profileSyncPending, true);

  completeProfileSync(state);
  assert.equal(state.profileSyncPending, false);
});

test("hydrating partial memory preserves local categories omitted by older backend snapshots", () => {
  const state = {
    recentMeals: [{ id: "local-recent", title: "本地晚餐" }],
    favoriteMeals: [{ id: "fav-cook", title: "常吃番茄蛋面" }],
    feedbackLearning: { likedKeywords: ["番茄"], avoidedKeywords: [], constraints: [] },
    feedback: [{ cardId: "fav-cook", tag: "好吃" }]
  };

  applyMemoryState(state, {
    recentMeals: [{ id: "remote-recent", title: "云端晚餐" }]
  });

  assert.deepEqual(state.recentMeals, [{ id: "remote-recent", title: "云端晚餐" }]);
  assert.deepEqual(state.favoriteMeals, [{ id: "fav-cook", title: "常吃番茄蛋面" }]);
  assert.deepEqual(state.feedbackLearning, { likedKeywords: ["番茄"], avoidedKeywords: [], constraints: [] });
  assert.deepEqual(state.feedback, [{ cardId: "fav-cook", tag: "好吃" }]);
});

test("hydrating explicit empty memory categories clears matching local categories", () => {
  const state = {
    recentMeals: [{ id: "local-recent", title: "本地晚餐" }],
    favoriteMeals: [{ id: "fav-cook", title: "常吃番茄蛋面" }],
    feedbackLearning: { likedKeywords: ["番茄"], avoidedKeywords: [], constraints: [] },
    feedback: [{ cardId: "fav-cook", tag: "好吃" }]
  };

  applyMemoryState(state, {
    favoriteMeals: [],
    feedback: [],
    feedbackLearning: null
  });

  assert.deepEqual(state.recentMeals, [{ id: "local-recent", title: "本地晚餐" }]);
  assert.deepEqual(state.favoriteMeals, []);
  assert.equal(state.feedbackLearning, null);
  assert.deepEqual(state.feedback, []);
});

test("hydrating remote memory preserves local memory with pending sync", () => {
  const state = {
    memorySyncPending: true,
    recentMeals: [{ id: "local-recent", title: "本地晚餐" }],
    favoriteMeals: [{ id: "fav-cook", title: "常吃番茄蛋面" }],
    feedbackLearning: { likedKeywords: ["番茄"], avoidedKeywords: [], constraints: [] },
    feedback: [{ cardId: "local-recent", tag: "好吃" }]
  };

  applyMemoryState(state, {
    recentMeals: [],
    favoriteMeals: [],
    feedbackLearning: null,
    feedback: []
  });

  assert.deepEqual(state.recentMeals, [{ id: "local-recent", title: "本地晚餐" }]);
  assert.deepEqual(state.favoriteMeals, [{ id: "fav-cook", title: "常吃番茄蛋面" }]);
  assert.deepEqual(state.feedbackLearning, { likedKeywords: ["番茄"], avoidedKeywords: [], constraints: [] });
  assert.deepEqual(state.feedback, [{ cardId: "local-recent", tag: "好吃" }]);
});

test("memory sync state helpers mark pending state and retry only useful local memory", () => {
  const state = {
    memorySyncPending: false,
    recentMeals: [{ id: "local-recent" }],
    favoriteMeals: [],
    feedback: [],
    feedbackLearning: null
  };

  beginMemorySync(state);
  assert.equal(state.memorySyncPending, true);
  assert.equal(shouldRetryMemorySync(state), true);

  completeMemorySync(state);
  assert.equal(state.memorySyncPending, false);
  assert.equal(shouldRetryMemorySync(state), false);
  assert.equal(shouldRetryMemorySync({ memorySyncPending: true, recentMeals: [], favoriteMeals: [], feedback: [] }), false);
});

test("starting a decision request marks generation as active", () => {
  const state = {
    isGenerating: false,
    generationError: "旧错误",
    requestSequence: 0
  };

  const requestId = startDecisionRequest(state);

  assert.equal(requestId, 1);
  assert.equal(state.requestSequence, 1);
  assert.equal(state.activeRequestId, 1);
  assert.equal(state.isGenerating, true);
  assert.equal(state.generationError, "");
});

test("stale decision responses do not replace newer cards", () => {
  const state = {
    cards: [{ id: "old-card" }],
    profile: {},
    context: {},
    apiAvailable: false
  };
  const firstRequest = startDecisionRequest(state);
  const secondRequest = startDecisionRequest(state);
  const cloneCards = (cards) => cards.map((card) => ({ ...card }));

  const staleApplied = finishDecisionRequest(
    state,
    firstRequest,
    { decisionId: "first", cards: [{ id: "stale-card" }] },
    cloneCards
  );
  const currentApplied = finishDecisionRequest(
    state,
    secondRequest,
    { decisionId: "second", cards: [{ id: "fresh-card" }] },
    cloneCards
  );

  assert.equal(staleApplied, false);
  assert.equal(currentApplied, true);
  assert.equal(state.decisionId, "second");
  assert.equal(state.cards[0].id, "fresh-card");
  assert.equal(state.isGenerating, false);
});

test("failed decision request keeps last good cards visible", () => {
  const state = {
    cards: [{ id: "last-good-card" }],
    apiAvailable: true
  };
  const requestId = startDecisionRequest(state);

  const failed = failDecisionRequest(state, requestId, "生成失败,已保留上一版");

  assert.equal(failed, true);
  assert.equal(state.cards[0].id, "last-good-card");
  assert.equal(state.isGenerating, false);
  assert.equal(state.apiAvailable, false);
  assert.equal(state.generationError, "生成失败,已保留上一版");
});

test("selecting a card stores optional action context", () => {
  const state = {
    selectedCardId: null,
    selectedActionContext: null
  };

  selectDecisionCardState(state, "cook-noodle", {
    source: "next_meal",
    label: "选这个少折腾",
    reasons: ["15 分钟", "低负担", "预算内"]
  });

  assert.equal(state.selectedCardId, "cook-noodle");
  assert.deepEqual(state.selectedActionContext, {
    cardId: "cook-noodle",
    source: "next_meal",
    label: "选这个少折腾",
    reasons: ["15 分钟", "低负担", "预算内"]
  });
});

test("selecting a card without context clears previous action context", () => {
  const state = {
    selectedCardId: "cook-noodle",
    selectedActionContext: {
      cardId: "cook-noodle",
      source: "next_meal",
      label: "选这个少折腾",
      reasons: ["15 分钟"]
    }
  };

  selectDecisionCardState(state, "dine-yue");

  assert.equal(state.selectedCardId, "dine-yue");
  assert.equal(state.selectedActionContext, null);
});

test("replacing the selected decision card clears stale selection state", () => {
  const state = {
    cards: [
      { id: "cook-old", type: "cook" },
      { id: "takeout-1", type: "takeout" }
    ],
    selectedCardId: "cook-old",
    selectedActionContext: { cardId: "cook-old", source: "next_meal", label: "旧建议", reasons: ["旧理由"] }
  };

  replaceDecisionCardState(state, "cook-old", { id: "cook-new", type: "cook" });

  assert.deepEqual(state.cards.map((card) => card.id), ["cook-new", "takeout-1"]);
  assert.equal(state.selectedCardId, null);
  assert.equal(state.selectedActionContext, null);
});

test("replacing another decision card preserves the current selection", () => {
  const state = {
    cards: [
      { id: "cook-old", type: "cook" },
      { id: "takeout-1", type: "takeout" }
    ],
    selectedCardId: "takeout-1",
    selectedActionContext: { cardId: "takeout-1", source: "next_meal", label: "保留", reasons: ["少折腾"] }
  };

  replaceDecisionCardState(state, "cook-old", { id: "cook-new", type: "cook" });

  assert.deepEqual(state.cards.map((card) => card.id), ["cook-new", "takeout-1"]);
  assert.equal(state.selectedCardId, "takeout-1");
  assert.deepEqual(state.selectedActionContext, {
    cardId: "takeout-1",
    source: "next_meal",
    label: "保留",
    reasons: ["少折腾"]
  });
});
