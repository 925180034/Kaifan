import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDecisionState,
  failDecisionRequest,
  finishDecisionRequest,
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
