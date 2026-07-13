async function postJson(url, payload, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
}

async function getJson(url, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, { method: "GET" });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
}

async function buildApiError(response) {
  const detail = extractErrorDetail(await readJsonSafely(response));
  return createApiError(response.status, detail);
}

function createApiError(status, detail = "") {
  const message = detail ? `API request failed: ${status} ${detail}` : `API request failed: ${status}`;
  const error = new Error(message);
  error.status = status;
  error.detail = detail;
  return error;
}

export function isRecoverableApiFailure(error) {
  if (!error || typeof error.status !== "number") return true;
  return error.status >= 500;
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorDetail(body) {
  if (!body || typeof body !== "object") return "";

  const detail = body.detail ?? body.message ?? body.error;
  if (Array.isArray(detail)) {
    return detail.map(formatDetailItem).filter(Boolean).join("; ");
  }
  return formatDetailItem(detail);
}

function formatDetailItem(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value.msg ?? value.message ?? JSON.stringify(value)).trim();
  }
  return String(value).trim();
}

export function fetchTodayDecision({ userId, profile, context, forceRegenerate = false }, fetchImpl) {
  return postJson("/api/decision/today", { userId, profile, context, forceRegenerate }, fetchImpl);
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

export function submitFeedback({ decisionId, userId, cardId, tag, createdAt, mealSelectedAt }, fetchImpl) {
  return postJson(
    "/api/feedback",
    {
      decisionId,
      userId,
      cardId,
      tag,
      ...(createdAt ? { createdAt } : {}),
      ...(mealSelectedAt ? { mealSelectedAt } : {})
    },
    fetchImpl
  );
}

export function trackEvent({ userId, event, payload = {}, createdAt }, fetchImpl) {
  return postJson(
    "/api/events",
    {
      userId,
      event,
      payload,
      ...(createdAt ? { createdAt } : {})
    },
    fetchImpl
  );
}
