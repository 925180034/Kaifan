export function todayDateString(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function hasFreshTodayDecision(state, today = todayDateString()) {
  return Boolean(
    state?.context?.date === today &&
      Array.isArray(state.cards) &&
      state.cards.length > 0 &&
      !state.generationError &&
      (state.decisionId || state.generationSource)
  );
}

export function applyDecisionState(state, decision, cloneCards = (cards) => [...cards]) {
  state.decisionId = decision.decisionId;
  state.cards = cloneCards(decision.cards ?? state.cards);
  state.selectedCardId = decision.selectedCardId ?? null;
  state.selectedActionContext = null;
  state.generationSource = decision.generationSource ?? "api";
  state.fallbackReason = decision.fallbackReason ?? "";
  state.apiAvailable = true;
  return state;
}

export function markLocalDecisionState(state, fallbackReason = "已使用本地方案") {
  state.decisionId = null;
  state.apiAvailable = false;
  state.generationSource = "fallback";
  state.fallbackReason = fallbackReason;
  return state;
}

export function applyMemoryState(state, memory = {}) {
  if (state.memorySyncPending && hasUsefulMemory(state)) return state;

  const source = memory && typeof memory === "object" ? memory : {};

  if (hasOwn(source, "recentMeals")) {
    state.recentMeals = Array.isArray(source.recentMeals) ? source.recentMeals : [];
  }
  if (hasOwn(source, "favoriteMeals")) {
    state.favoriteMeals = Array.isArray(source.favoriteMeals) ? source.favoriteMeals : [];
  }
  if (hasOwn(source, "feedbackLearning")) {
    state.feedbackLearning = source.feedbackLearning ?? null;
  }
  if (hasOwn(source, "feedback")) {
    state.feedback = Array.isArray(source.feedback) ? source.feedback : [];
  }

  return state;
}

export function applyProfileState(state, response = {}) {
  const profile = response?.profile;
  if (!profile || typeof profile !== "object") return state;
  if (state.profileSyncPending && state.profileCompleted) return state;
  if (response.profileSource === "default" && state.profileCompleted) return state;

  state.profile = cloneProfile(profile);
  return state;
}

function cloneProfile(profile) {
  return Object.fromEntries(
    Object.entries(profile).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
  );
}

export function beginProfileSync(state) {
  state.profileSyncPending = true;
  return state;
}

export function completeProfileSync(state) {
  state.profileSyncPending = false;
  return state;
}

export function shouldRetryProfileSync(state) {
  return Boolean(state.profileSyncPending && state.profileCompleted);
}

export function beginMemorySync(state) {
  state.memorySyncPending = true;
  return state;
}

export function completeMemorySync(state) {
  state.memorySyncPending = false;
  return state;
}

export function shouldRetryMemorySync(state) {
  return Boolean(state.memorySyncPending && hasUsefulMemory(state));
}

function hasUsefulMemory(state) {
  return Boolean(
    state?.recentMeals?.length ||
      state?.favoriteMeals?.length ||
      state?.feedback?.length ||
      state?.feedbackLearning
  );
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function selectDecisionCardState(state, cardId, actionContext = null) {
  state.selectedCardId = cardId;
  state.selectedActionContext = actionContext
    ? {
        cardId,
        source: actionContext.source ?? "",
        label: actionContext.label ?? "",
        reasons: [...(actionContext.reasons ?? [])].filter(Boolean).slice(0, 3)
      }
    : null;
  return state;
}

export function replaceDecisionCardState(state, currentId, nextCard) {
  state.cards = (state.cards ?? []).map((card) => (card.id === currentId ? nextCard : card));
  if (state.selectedCardId === currentId) {
    state.selectedCardId = null;
  }
  if (state.selectedActionContext?.cardId === currentId) {
    state.selectedActionContext = null;
  }
  return state;
}

export function startDecisionRequest(state) {
  state.requestSequence = (state.requestSequence ?? 0) + 1;
  state.activeRequestId = state.requestSequence;
  state.isGenerating = true;
  state.generationError = "";
  return state.activeRequestId;
}

export function finishDecisionRequest(state, requestId, decision, cloneCards) {
  if (requestId !== state.activeRequestId) return false;
  applyDecisionState(state, decision, cloneCards);
  state.isGenerating = false;
  state.generationError = "";
  return true;
}

export function failDecisionRequest(state, requestId, message) {
  if (requestId !== state.activeRequestId) return false;
  state.isGenerating = false;
  state.apiAvailable = false;
  state.generationError = message;
  return true;
}

export function startCardRefresh(state) {
  if (state.isRefreshing) return false;
  state.isRefreshing = true;
  return true;
}

export function finishCardRefresh(state) {
  state.isRefreshing = false;
  return state;
}
