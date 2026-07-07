export function applyDecisionState(state, decision, cloneCards = (cards) => [...cards]) {
  state.decisionId = decision.decisionId;
  state.cards = cloneCards(decision.cards ?? state.cards);
  state.selectedCardId = decision.selectedCardId ?? null;
  state.apiAvailable = true;
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
