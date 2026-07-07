async function postJson(url, payload, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

async function getJson(url, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, { method: "GET" });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export function fetchTodayDecision({ userId, profile, context }, fetchImpl) {
  return postJson("/api/decision/today", { userId, profile, context }, fetchImpl);
}

export function fetchProfile(userId, fetchImpl) {
  return getJson(`/api/profile/${encodeURIComponent(userId)}`, fetchImpl);
}

export function saveProfile(userId, profile, fetchImpl) {
  return postJson(`/api/profile/${encodeURIComponent(userId)}`, { profile }, fetchImpl);
}

export function fetchMemory(userId, fetchImpl) {
  return getJson(`/api/memory/${encodeURIComponent(userId)}`, fetchImpl);
}

export function saveMemory(userId, memory, fetchImpl) {
  return postJson(`/api/memory/${encodeURIComponent(userId)}`, { memory }, fetchImpl);
}

export function selectDecisionCard({ decisionId, userId, cardId }, fetchImpl) {
  return postJson("/api/decision/select", { decisionId, userId, cardId }, fetchImpl);
}

export function refreshDecisionCard({ decisionId, userId, type, currentId, mood }, fetchImpl) {
  return postJson(
    `/api/decision/${encodeURIComponent(decisionId)}/refresh`,
    { userId, type, currentId, mood },
    fetchImpl
  );
}

export function submitFeedback({ decisionId, userId, cardId, tag }, fetchImpl) {
  return postJson("/api/feedback", { decisionId, userId, cardId, tag }, fetchImpl);
}
