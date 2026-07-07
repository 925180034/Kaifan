const maxRecentMeals = 8;
const maxKeywords = 16;

const negativeConstraints = {
  "太贵": "控制预算,少推荐高价方案",
  "太麻烦": "优先简单省事,少推荐复杂备菜",
  "没吃饱": "提高饱腹感,兼顾主食和蛋白质",
  "太油/太咸": "少油少盐,避免重口味",
  "不合口味": "减少相似口味和关键词"
};

export function recordSelectedMeal(state, card, timestamp = new Date().toISOString()) {
  const meal = compactMeal(card, timestamp);
  const existing = state.recentMeals ?? [];
  state.recentMeals = [
    meal,
    ...existing.filter((item) => item.id !== meal.id)
  ].slice(0, maxRecentMeals);
  return state.recentMeals;
}

export function recordFeedbackLearning(state, card, tag, timestamp = new Date().toISOString()) {
  const learning = ensureFeedbackLearning(state);
  const keywords = compactKeywords(card.searchKeywords);
  const isPositive = tag.includes("好吃") || tag.includes("下次还吃");

  if (isPositive) {
    learning.likedKeywords = mergeUnique(keywords, learning.likedKeywords);
  } else {
    learning.avoidedKeywords = mergeUnique(keywords, learning.avoidedKeywords);
    const constraint = negativeConstraints[tag];
    if (constraint) {
      learning.constraints = mergeUnique([constraint], learning.constraints);
    }
  }

  learning.lastFeedback = {
    cardId: card.id,
    cardTitle: card.title,
    tag,
    createdAt: timestamp
  };
  state.feedbackLearning = learning;
  return learning;
}

export function buildGenerationContext(baseContext, state) {
  const context = deepClone(baseContext);
  context.recentMeals = deepClone(state.recentMeals ?? []);
  context.feedbackLearning = deepClone(ensureFeedbackLearning(state));
  return context;
}

function compactMeal(card, selectedAt) {
  return {
    id: card.id,
    type: card.type,
    title: card.title,
    searchKeywords: compactKeywords(card.searchKeywords),
    selectedAt
  };
}

function ensureFeedbackLearning(state) {
  return {
    likedKeywords: compactKeywords(state.feedbackLearning?.likedKeywords),
    avoidedKeywords: compactKeywords(state.feedbackLearning?.avoidedKeywords),
    constraints: compactKeywords(state.feedbackLearning?.constraints),
    lastFeedback: state.feedbackLearning?.lastFeedback ?? null
  };
}

function compactKeywords(values) {
  return [...new Set(values ?? [])]
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, maxKeywords);
}

function mergeUnique(newValues, oldValues) {
  return compactKeywords([...newValues, ...(oldValues ?? [])]);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}
