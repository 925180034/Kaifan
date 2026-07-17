async function postJson(url, payload, fetchImpl = globalThis.fetch, sessionToken = "") {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: requestHeaders(sessionToken),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
}

async function getJson(url, fetchImpl = globalThis.fetch, sessionToken = "") {
  const response = await fetchImpl(url, { method: "GET", headers: requestHeaders(sessionToken) });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
}

function requestHeaders(sessionToken = "") {
  return {
    "Content-Type": "application/json",
    ...(sessionToken ? { "X-Kaifan-Session": sessionToken } : {})
  };
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

export function createSession(fetchImpl) {
  return postJson("/api/session", {}, fetchImpl);
}

export function fetchTodayDecision({ userId, sessionToken = "", profile, context, forceRegenerate = false }, fetchImpl) {
  return postJson("/api/decision/today", { userId, profile, context, forceRegenerate }, fetchImpl, sessionToken);
}

export function fetchProfile(userId, fetchImpl, sessionToken = "") {
  return getJson(`/api/profile/${encodeURIComponent(userId)}`, fetchImpl, sessionToken);
}

export function saveProfile(userId, profile, fetchImpl, sessionToken = "") {
  return postJson(`/api/profile/${encodeURIComponent(userId)}`, { profile }, fetchImpl, sessionToken);
}

export function fetchMemory(userId, fetchImpl, sessionToken = "") {
  return getJson(`/api/memory/${encodeURIComponent(userId)}`, fetchImpl, sessionToken);
}

export function saveMemory(userId, memory, fetchImpl, sessionToken = "") {
  return postJson(`/api/memory/${encodeURIComponent(userId)}`, { memory }, fetchImpl, sessionToken);
}

export function selectDecisionCard({ decisionId, userId, sessionToken = "", cardId }, fetchImpl) {
  return postJson("/api/decision/select", { decisionId, userId, cardId }, fetchImpl, sessionToken);
}

export function refreshDecisionCard({ decisionId, userId, sessionToken = "", type, currentId, mood }, fetchImpl) {
  return postJson(
    `/api/decision/${encodeURIComponent(decisionId)}/refresh`,
    { userId, type, currentId, mood },
    fetchImpl,
    sessionToken
  );
}

export function submitFeedback({ decisionId, userId, sessionToken = "", cardId, tag, createdAt, mealSelectedAt }, fetchImpl) {
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
    fetchImpl,
    sessionToken
  );
}

export function trackEvent({ userId, sessionToken = "", event, payload = {}, createdAt }, fetchImpl) {
  return postJson(
    "/api/events",
    {
      userId,
      event,
      payload,
      ...(createdAt ? { createdAt } : {})
    },
    fetchImpl,
    sessionToken
  );
}
