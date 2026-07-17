import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchMemory,
  fetchProfile,
  createSession,
  fetchTodayDecision,
  isRecoverableApiFailure,
  refreshDecisionCard,
  saveMemory,
  saveProfile,
  selectDecisionCard,
  submitFeedback,
  trackEvent
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

function createFailedFetch(responseBody, { status = 500, jsonThrows = false } = {}) {
  return async () => ({
    ok: false,
    status,
    async json() {
      if (jsonThrows) {
        throw new Error("Invalid JSON");
      }
      return responseBody;
    }
  });
}

test("failed API requests include backend error detail", async () => {
  const fetchImpl = createFailedFetch({ detail: "Decision not found" }, { status: 404 });

  await assert.rejects(
    () =>
      fetchTodayDecision(
        {
          userId: "user-1",
          profile: { peopleCount: "2" },
          context: { mood: "normal" }
        },
        fetchImpl
      ),
    /API request failed: 404 Decision not found/
  );
});

test("failed API requests fall back to status when the error body is not JSON", async () => {
  const fetchImpl = createFailedFetch(null, { status: 502, jsonThrows: true });

  await assert.rejects(() => fetchProfile("user-1", fetchImpl), { message: "API request failed: 502" });
});

test("failed API requests expose status and detail metadata", async () => {
  const fetchImpl = createFailedFetch({ detail: "Card not found" }, { status: 404 });

  await assert.rejects(
    () => fetchProfile("user-1", fetchImpl),
    (error) => {
      assert.equal(error.message, "API request failed: 404 Card not found");
      assert.equal(error.status, 404);
      assert.equal(error.detail, "Card not found");
      return true;
    }
  );
});

test("isRecoverableApiFailure only falls back for network and server errors", () => {
  assert.equal(isRecoverableApiFailure(new TypeError("Failed to fetch")), true);

  const serverError = new Error("API request failed: 502");
  serverError.status = 502;
  assert.equal(isRecoverableApiFailure(serverError), true);

  const invalidRequest = new Error("API request failed: 404 Card not found");
  invalidRequest.status = 404;
  assert.equal(isRecoverableApiFailure(invalidRequest), false);
});

test("fetchTodayDecision posts profile and context with the session token", async () => {
  const { calls, fetchImpl } = createFetchRecorder({ decisionId: "decision-1" });

  const result = await fetchTodayDecision(
    {
      userId: "user-1",
      sessionToken: "session-secret",
      profile: { peopleCount: "2" },
      context: { mood: "normal" }
    },
    fetchImpl
  );

  assert.equal(result.decisionId, "decision-1");
  assert.equal(calls[0].url, "/api/decision/today");
  assert.equal(JSON.parse(calls[0].options.body).userId, "user-1");
  assert.equal(calls[0].options.headers["X-Kaifan-Session"], "session-secret");
});

test("createSession starts a new anonymous session without credentials", async () => {
  const { calls, fetchImpl } = createFetchRecorder({ userId: "user-1", sessionToken: "secret" });

  const session = await createSession(fetchImpl);

  assert.equal(session.userId, "user-1");
  assert.equal(calls[0].url, "/api/session");
  assert.equal(calls[0].options.headers["X-Kaifan-Session"], undefined);
});

test("profile and memory helpers include the anonymous session token", async () => {
  const { calls, fetchImpl } = createFetchRecorder();

  await saveProfile("user-1", { spicyLevel: "mild" }, fetchImpl, "session-secret");
  await fetchProfile("user-1", fetchImpl, "session-secret");
  await saveMemory("user-1", { recentMeals: [] }, fetchImpl, "session-secret");
  await fetchMemory("user-1", fetchImpl, "session-secret");

  assert.equal(calls[0].url, "/api/profile/user-1");
  assert.equal(JSON.parse(calls[0].options.body).profile.spicyLevel, "mild");
  assert.equal(calls[1].url, "/api/profile/user-1");
  assert.equal(calls[1].options.method, "GET");
  assert.equal(calls[2].url, "/api/memory/user-1");
  assert.equal(calls[3].url, "/api/memory/user-1");
  for (const call of calls) {
    assert.equal(call.options.headers["X-Kaifan-Session"], "session-secret");
  }
});

test("trackEvent posts analytics events to the backend", async () => {
  const { calls, fetchImpl } = createFetchRecorder({ event: "card_selected" });

  await trackEvent(
    {
      userId: "user-1",
      sessionToken: "session-secret",
      event: "card_selected",
      payload: { cardId: "cook-1", source: "today" },
      createdAt: "2026-07-13T20:00:00.000Z"
    },
    fetchImpl
  );

  assert.equal(calls[0].url, "/api/events");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    userId: "user-1",
    event: "card_selected",
    payload: { cardId: "cook-1", source: "today" },
    createdAt: "2026-07-13T20:00:00.000Z"
  });
  assert.equal(calls[0].options.headers["X-Kaifan-Session"], "session-secret");
});

test("decision mutations call their matching backend endpoints", async () => {
  const { calls, fetchImpl } = createFetchRecorder();

  await selectDecisionCard({ decisionId: "decision-1", userId: "user-1", sessionToken: "session-secret", cardId: "card-1" }, fetchImpl);
  await refreshDecisionCard(
    { decisionId: "decision-1", userId: "user-1", sessionToken: "session-secret", type: "cook", currentId: "card-1", mood: "lazy" },
    fetchImpl
  );
  await submitFeedback(
    {
      decisionId: "decision-1",
      userId: "user-1",
      sessionToken: "session-secret",
      cardId: "card-1",
      tag: "好吃",
      createdAt: "2026-07-09T19:30:00.000Z",
      mealSelectedAt: "2026-07-09T12:00:00.000Z"
    },
    fetchImpl
  );

  assert.equal(calls[0].url, "/api/decision/select");
  assert.equal(calls[1].url, "/api/decision/decision-1/refresh");
  assert.equal(calls[2].url, "/api/feedback");
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    decisionId: "decision-1",
    userId: "user-1",
    cardId: "card-1",
    tag: "好吃",
    createdAt: "2026-07-09T19:30:00.000Z",
    mealSelectedAt: "2026-07-09T12:00:00.000Z"
  });
  for (const call of calls) {
    assert.equal(call.options.headers["X-Kaifan-Session"], "session-secret");
  }
});
