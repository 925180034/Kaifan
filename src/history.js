const typeLabels = {
  cook: "自己做",
  takeout: "点外卖",
  dine_out: "出去吃"
};

export function buildHistorySummary(state) {
  const recentMeals = (state.recentMeals ?? []).map((meal) => ({
    id: meal.id,
    type: meal.type,
    typeLabel: typeLabels[meal.type] ?? "晚餐",
    title: meal.title,
    selectedAt: meal.selectedAt,
    searchKeywords: [...(meal.searchKeywords ?? [])]
  }));
  const feedback = state.feedback ?? [];
  const positiveFeedbackCount = feedback.filter((item) => isPositiveFeedback(item.tag)).length;
  const negativeFeedbackCount = feedback.length - positiveFeedbackCount;
  const learning = state.feedbackLearning ?? {};
  const likedKeywords = [...(learning.likedKeywords ?? [])];
  const avoidedKeywords = [...(learning.avoidedKeywords ?? [])];
  const constraints = [...(learning.constraints ?? [])];

  return {
    hasHistory:
      recentMeals.length > 0 ||
      feedback.length > 0 ||
      likedKeywords.length > 0 ||
      avoidedKeywords.length > 0 ||
      constraints.length > 0,
    recentMeals,
    feedbackCount: feedback.length,
    positiveFeedbackCount,
    negativeFeedbackCount,
    likedKeywords,
    avoidedKeywords,
    constraints
  };
}

function isPositiveFeedback(tag = "") {
  return tag.includes("好吃") || tag.includes("下次还吃");
}
