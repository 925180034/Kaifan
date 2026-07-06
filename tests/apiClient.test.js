import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchTodayDecision,
  refreshDecisionCard,
  saveProfile,
  selectDecisionCard,
  submitFeedback
} from "../src/apiClient.js";

function createFetchRecorder(responseBody = { ok: true }) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return responseBody;
      }
    };
  };
  return { calls, fetchImpl };
}

test("fetchTodayDecision posts profile and context to the backend", async () => {
  const { calls, fetchImpl } = createFetchRecorder({ decisionId: "decision-1" });

  const result = await fetchTodayDecision(
    {
      userId: "user-1",
      profile: { peopleCount: "2" },
      context: { mood: "normal" }
    },
    fetchImpl
  );

  assert.equal(result.decisionId, "decision-1");
  assert.equal(calls[0].url, "/api/decision/today");
  assert.equal(JSON.parse(calls[0].options.body).userId, "user-1");
});

test("saveProfile posts to the user profile endpoint", async () => {
  const { calls, fetchImpl } = createFetchRecorder();

  await saveProfile("user-1", { spicyLevel: "mild" }, fetchImpl);

  assert.equal(calls[0].url, "/api/profile/user-1");
  assert.equal(JSON.parse(calls[0].options.body).profile.spicyLevel, "mild");
});

test("decision mutations call their matching backend endpoints", async () => {
  const { calls, fetchImpl } = createFetchRecorder();

  await selectDecisionCard({ decisionId: "decision-1", userId: "user-1", cardId: "card-1" }, fetchImpl);
  await refreshDecisionCard(
    { decisionId: "decision-1", userId: "user-1", type: "cook", currentId: "card-1", mood: "lazy" },
    fetchImpl
  );
  await submitFeedback(
    { decisionId: "decision-1", userId: "user-1", cardId: "card-1", tag: "好吃" },
    fetchImpl
  );

  assert.equal(calls[0].url, "/api/decision/select");
  assert.equal(calls[1].url, "/api/decision/decision-1/refresh");
  assert.equal(calls[2].url, "/api/feedback");
});
