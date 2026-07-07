import test from "node:test";
import assert from "node:assert/strict";

import { applyDecisionState } from "../src/appState.js";

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
