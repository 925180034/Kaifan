export function applyDecisionState(state, decision, cloneCards = (cards) => [...cards]) {
  state.decisionId = decision.decisionId;
  state.cards = cloneCards(decision.cards ?? state.cards);
  state.selectedCardId = decision.selectedCardId ?? null;
  state.apiAvailable = true;
  return state;
}
