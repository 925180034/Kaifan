import {
  dineOutOptions,
  moodOptions,
  recipeOptions,
  takeoutOptions
} from "./sampleData.js";

const optionPools = {
  cook: recipeOptions,
  takeout: takeoutOptions,
  dine_out: dineOutOptions
};

export function getMoodLabel(mood) {
  return moodOptions.find((option) => option.id === mood)?.label ?? "正常";
}

export function scoreCard(card, context = {}) {
  let score = card.baseScore ?? 0;

  if (context.weather?.isRaining) {
    if (card.type === "takeout") score += 12;
    if (card.type === "dine_out") score -= 14;
    if (card.type === "cook") score += 4;
  }

  if (context.mood === "lazy") {
    if (card.type === "cook" && card.complexity === "easy") score += 16;
    if (card.estimatedMinutes && card.estimatedMinutes > 45) score -= 18;
    if (card.type === "dine_out") score -= 8;
  }

  if (context.mood === "treat") {
    if (card.type === "dine_out") score += 14;
    if (card.complexity === "rich") score += 10;
  }

  return score;
}

export function rankDecisionCards(cards, context = {}) {
  return [...cards]
    .map((card) => ({ ...card, score: scoreCard(card, context) }))
    .sort((a, b) => b.score - a.score || a.estimatedCostPerPerson - b.estimatedCostPerPerson);
}

export function getTopRecommendation(cards, context = {}) {
  return rankDecisionCards(cards, context)[0];
}

export function refreshCard(type, mood = "normal", currentId) {
  const pool = optionPools[type] ?? [];
  const preferred = pool.filter((option) => {
    if (option.id === currentId) return false;
    if (type === "cook" && mood === "lazy") return option.complexity === "easy";
    if (type === "cook" && mood === "treat") return option.complexity !== "easy";
    return true;
  });

  return preferred[0] ?? pool.find((option) => option.id !== currentId) ?? pool[0];
}
