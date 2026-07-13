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
  return (card.baseScore ?? 0) + scoreContributionEntries(card, context).reduce((sum, item) => sum + item.value, 0);
}

export function rankDecisionCards(cards, context = {}) {
  return [...cards]
    .map((card) => ({ ...card, score: scoreCard(card, context) }))
    .sort((a, b) => b.score - a.score || a.estimatedCostPerPerson - b.estimatedCostPerPerson);
}

export function getTopRecommendation(cards, context = {}) {
  return rankDecisionCards(cards, context)[0];
}

export function buildRankingComparisons(cards, context = {}) {
  const ranked = rankDecisionCards(cards, context);
  const topScore = ranked[0]?.score ?? 0;

  return ranked.map((card, index) => {
    const lead = Math.max(0, Math.round(topScore - card.score));
    return {
      cardId: card.id,
      rank: index + 1,
      rankLabel: `第${index + 1}名`,
      deltaText: index === 0 ? "当前最优" : `落后 ${lead} 分`,
      reason: rankingReason(card, context)
    };
  });
}

export function buildRecommendationSignals(card, profile = {}, context = {}) {
  return uniqueClean([
    nutritionSignal(card, profile),
    moodSignal(card, context),
    weatherSignal(card, context),
    likedKeywordSignal(card, context),
    profilePreferenceSignal(card, profile),
    cookingWillingnessSignal(card, profile),
    effortRecoverySignal(card, context),
    lightnessRecoverySignal(card, context),
    tasteAvoidanceSignal(card, context),
    varietySignal(card, context),
    satisfactionRecoverySignal(card, profile, context),
    budgetRecoverySignal(card, profile, context),
    budgetSignal(card, profile)
  ]).slice(0, 3);
}

export function buildPreferenceMatchDetails(card, profile = {}, limit = 4) {
  const searchable = cardSearchText(card);
  const groups = [
    { values: profile.favoriteIngredients, prefix: "喜欢", excluded: [] },
    { values: profile.cuisinePreferences, prefix: "偏好", excluded: [] },
    { values: profile.tasteTags, prefix: "口味", excluded: ["都行"] }
  ];
  const seen = new Set();
  const details = [];

  for (const group of groups) {
    for (const term of normalizedProfileTerms(group.values, group.excluded)) {
      if (!searchable.includes(term)) continue;
      const label = `${group.prefix}${term}`;
      if (seen.has(label)) continue;
      seen.add(label);
      details.push(label);
      if (details.length >= limit) return details;
    }
  }

  return details;
}

export function buildRecommendationBreakdown(card, context = {}, limit = 4) {
  return scoreContributionEntries(card, context)
    .filter((item) => item.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || b.value - a.value)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      direction: item.value > 0 ? "positive" : "negative",
      text: formatAdjustment(item.value)
    }));
}

export function buildDailyReviewImpacts(card, context = {}, limit = 2) {
  const learningImpactIds = new Set([
    "budget_recovery",
    "satisfaction_recovery",
    "effort_recovery",
    "lightness_recovery",
    "taste_avoidance"
  ]);

  return scoreContributionEntries(card, context)
    .filter((item) => learningImpactIds.has(item.id))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      label: dailyReviewImpactLabel(item.id),
      direction: "positive",
      text: formatAdjustment(item.value)
    }));
}

export function buildProfileTuningActions(card, profile = {}, context = {}, limit = 3) {
  const actions = [];
  const goal = normalizeText(profile.nutritionGoal);
  const tasteTags = normalizedProfileTerms(profile.tasteTags, ["都行"]);

  if (isHighProteinCard(card) && !goal.includes("高蛋白") && !goal.includes("增肌")) {
    actions.push(profileTuningAction("prefer_high_protein", "加强高蛋白", "下次更偏向蛋白质充足的方案"));
  }

  if (isLightCard(card) && !(tasteTags.includes("清淡") && tasteTags.includes("少油"))) {
    actions.push(profileTuningAction("prefer_light", "加强清淡少油", "把清淡、少油写进画像"));
  }

  if (shouldRecoverBudget(context, profile) && !["under_15", "15_30"].includes(profile.budgetPerPerson)) {
    actions.push(profileTuningAction("tighten_budget", "预算收紧", "下次优先控制在人均 ¥15-30"));
  }

  if (card.type === "cook" && profile.cookingWillingness !== "high") {
    actions.push(profileTuningAction("prefer_cooking", "多推自己做", "下次更偏向有菜谱的方案"));
  }

  if (card.type === "takeout" && !["low", "avoid"].includes(profile.cookingWillingness)) {
    actions.push(profileTuningAction("prefer_low_effort", "今晚少做饭", "下次更偏向外卖或简单方案"));
  }

  return actions.slice(0, limit);
}

export function buildBudgetAlert(card, profile = {}, candidateCards = []) {
  const range = budgetRange(profile.budgetPerPerson);
  const cost = numberFrom(card.estimatedCostPerPerson);
  if (!range || range[1] === Infinity || !cost || cost <= range[1]) return null;

  const overage = cost - range[1];
  const swapSuggestion = budgetSwapSuggestion(card, profile, candidateCards);
  return {
    title: `超预算 ¥${overage}/人`,
    ...budgetAlternativeCopy(card),
    ...(swapSuggestion ? { swapSuggestion } : {})
  };
}

export function buildDecisionTradeoffs(card, profile = {}) {
  return [
    {
      id: "time",
      label: "省时",
      value: timeScore(card.estimatedMinutes),
      text: card.timeText || `${card.estimatedMinutes ?? "?"}分钟`
    },
    {
      id: "cost",
      label: "预算",
      value: costScore(card.estimatedCostPerPerson, profile.budgetPerPerson),
      text: card.costText || `约¥${card.estimatedCostPerPerson ?? "?"}/人`
    },
    {
      id: "nutrition",
      label: "营养",
      value: nutritionScore(card),
      text: nutritionText(card)
    },
    {
      id: "effort",
      label: "省事",
      value: effortScore(card),
      text: effortText(card)
    }
  ];
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

function timeScore(minutes) {
  if (minutes <= 15) return 100;
  if (minutes <= 25) return 85;
  if (minutes <= 40) return 65;
  if (minutes <= 60) return 45;
  return 25;
}

function costScore(cost, budget) {
  const range = budgetRange(budget);
  if (!range) {
    if (cost <= 20) return 100;
    if (cost <= 35) return 85;
    if (cost <= 60) return 60;
    return 35;
  }
  const [, max] = range;
  if (max === Infinity) return cost >= 60 ? 85 : 70;
  if (cost <= max * 0.6) return 100;
  if (cost <= max) return 85;
  if (cost <= max * 1.25) return 55;
  return 30;
}

function nutritionScore(card) {
  const protein = proteinGrams(card.nutritionSummary?.protein);
  const searchable = normalizeText([
    card.title,
    card.reason,
    card.nutritionSummary?.note,
    ...(card.searchKeywords ?? [])
  ].join(" "));

  if (protein >= 30) return 90;
  if (protein >= 20) return 75;
  if (searchable.includes("高蛋白") || searchable.includes("蛋白")) return 80;
  if (searchable.includes("轻食") || searchable.includes("少油") || searchable.includes("清淡")) return 65;
  return 55;
}

function nutritionText(card) {
  return card.nutritionSummary?.protein || card.nutritionSummary?.note?.split(/[，,]/)[0] || "常规";
}

function effortScore(card) {
  if (card.type === "takeout") return 95;
  if (card.type === "dine_out") return 55;
  return {
    easy: 90,
    normal: 65,
    hard: 35,
    rich: 40
  }[card.complexity || card.difficulty] ?? 60;
}

function effortText(card) {
  if (card.type === "takeout") return "直接下单";
  if (card.type === "dine_out") return "要出门";
  return {
    easy: "简单",
    normal: "普通",
    hard: "复杂",
    rich: "复杂"
  }[card.complexity || card.difficulty] ?? "普通";
}

function proteinGrams(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function nutritionSignal(card, profile) {
  if (!profile.nutritionGoal || profile.nutritionGoal === "均衡") return "";
  const searchable = cardSearchText(card);
  const goal = normalizeText(profile.nutritionGoal);
  if (goal.includes("高蛋白") && (searchable.includes("蛋白") || searchable.includes("虾仁") || searchable.includes("鸡胸"))) {
    return `匹配${profile.nutritionGoal}`;
  }
  if (goal.includes("少盐") && searchable.includes("清淡")) return `匹配${profile.nutritionGoal}`;
  if (goal.includes("低脂") && (searchable.includes("低脂") || searchable.includes("少油"))) return `匹配${profile.nutritionGoal}`;
  return "";
}

function moodSignal(card, context) {
  if (context.mood === "lazy" && (card.type === "takeout" || card.complexity === "easy" || card.estimatedMinutes <= 25)) {
    return "适合偷懒模式";
  }
  if (context.mood === "treat" && (card.type === "dine_out" || card.complexity === "rich")) {
    return "适合想吃好点";
  }
  return "";
}

function weatherSignal(card, context) {
  if (!context.weather?.isRaining) return "";
  if (card.type === "takeout") return "雨天省心";
  if (card.type === "cook") return "雨天在家吃";
  return "";
}

function likedKeywordSignal(card, context) {
  const liked = context.feedbackLearning?.likedKeywords ?? [];
  const terms = cardTerms(card);
  const match = liked.find((keyword) => terms.includes(normalizeText(keyword)));
  return match ? `靠近偏好 ${match}` : "";
}

function profilePreferenceSignal(card, profile) {
  return profilePreferenceScore(card, profile).score > 0 ? "贴合画像偏好" : "";
}

function cookingWillingnessSignal(card, profile) {
  return matchesCookingWillingness(card, profile.cookingWillingness) ? "符合做饭意愿" : "";
}

function effortRecoverySignal(card, context) {
  if (!shouldRecoverEffort(context)) return "";
  return isLowEffortCard(card) ? "少折腾" : "";
}

function lightnessRecoverySignal(card, context) {
  if (!shouldRecoverLightness(context)) return "";
  return isLightCard(card) ? "清爽少油" : "";
}

function tasteAvoidanceSignal(card, context) {
  if (!shouldRecoverTaste(context)) return "";
  const avoidedKeywords = normalizedAvoidedKeywords(context);
  if (!avoidedKeywords.length || cardSharesAvoidedKeyword(card, avoidedKeywords)) return "";
  return "避开上次口味";
}

function varietySignal(card, context) {
  const pattern = recentMealPattern(context.recentMeals);
  if (!pattern.needsVariety) return "";
  if (pattern.dominantType && card.type === pattern.dominantType) return "";
  if (cardSharesRepeatedKeyword(card, pattern.repeatedKeywords)) return "";
  return "换换口味";
}

function budgetSignal(card, profile) {
  const range = budgetRange(profile.budgetPerPerson);
  const cost = card.estimatedCostPerPerson;
  if (!range || typeof cost !== "number") return "";
  if (cost >= range[0] && cost <= range[1]) return `符合预算 ${budgetShortLabel(profile.budgetPerPerson)}`;
  return "";
}

function budgetRecoverySignal(card, profile, context) {
  if (!shouldRecoverBudget(context, profile)) return "";
  if (!isLowCostCook(card, profile.budgetPerPerson)) return "";
  return "帮你拉回预算";
}

function satisfactionRecoverySignal(card, profile, context) {
  if (!shouldRecoverSatisfaction(context)) return "";
  if (!isBudgetFriendly(card, profile.budgetPerPerson)) return "";
  if (!isFillingCard(card)) return "";
  return "补足满足感";
}

function scoreContributionEntries(card, context = {}) {
  return [
    { id: "weather", label: "天气", value: weatherAdjustment(card, context) },
    { id: "mood", label: "今日状态", value: moodAdjustment(card, context) },
    { id: "nutrition", label: "营养目标", value: nutritionGoalAdjustment(card, context.profile) },
    { id: "cooking_willingness", label: "做饭意愿", value: cookingWillingnessAdjustment(card, context.profile) },
    { id: "profile_preference", label: "画像偏好", value: profilePreferenceAdjustment(card, context.profile) },
    { id: "budget_recovery", label: "预算修正", value: budgetRecoveryAdjustment(card, context) },
    { id: "satisfaction_recovery", label: "满足感修正", value: satisfactionRecoveryAdjustment(card, context) },
    { id: "effort_recovery", label: "省事修正", value: effortRecoveryAdjustment(card, context) },
    { id: "lightness_recovery", label: "清爽修正", value: lightnessRecoveryAdjustment(card, context) },
    { id: "taste_avoidance", label: "口味避雷", value: tasteAvoidanceAdjustment(card, context) },
    { id: "variety", label: "换口味", value: varietyAdjustment(card, context) }
  ];
}

function rankingReason(card, context) {
  const strongest = buildRecommendationBreakdown(card, context, 1)[0];
  return strongest ? `${strongest.label} ${strongest.text}` : "无明显加分项";
}

function weatherAdjustment(card, context) {
  if (!context.weather?.isRaining) return 0;
  if (card.type === "takeout") return 12;
  if (card.type === "dine_out") return -14;
  if (card.type === "cook") return 4;
  return 0;
}

function moodAdjustment(card, context) {
  if (context.mood === "lazy") {
    let adjustment = 0;
    if (card.type === "cook" && card.complexity === "easy") adjustment += 16;
    if (card.estimatedMinutes && card.estimatedMinutes > 45) adjustment -= 18;
    if (card.type === "dine_out") adjustment -= 8;
    return adjustment;
  }

  if (context.mood === "treat") {
    let adjustment = 0;
    if (card.type === "dine_out") adjustment += 14;
    if (card.complexity === "rich") adjustment += 10;
    return adjustment;
  }

  return 0;
}

function budgetRecoveryAdjustment(card, context) {
  const profile = context.profile ?? {};
  if (!shouldRecoverBudget(context, profile)) return 0;

  const range = budgetRange(profile.budgetPerPerson);
  const cost = numberFrom(card.estimatedCostPerPerson);
  if (!range || !cost) return 0;

  const [, max] = range;
  if (card.type === "cook" && cost <= max * 0.7) return 22;
  if (card.type === "cook" && cost <= max) return 10;
  if (cost <= max * 0.6) return 6;
  if (cost > max) return -8;
  return 0;
}

function satisfactionRecoveryAdjustment(card, context) {
  const profile = context.profile ?? {};
  if (!shouldRecoverSatisfaction(context)) return 0;
  if (!isBudgetFriendly(card, profile.budgetPerPerson)) return 0;
  if (!isFillingCard(card)) return 0;
  return 22;
}

function nutritionGoalAdjustment(card, profile = {}) {
  const goal = normalizeText(profile.nutritionGoal);
  if (!goal || goal.includes("均衡")) return 0;

  let adjustment = 0;
  if (goal.includes("高蛋白") || goal.includes("增肌")) {
    adjustment += proteinGrams(card.nutritionSummary?.protein) >= 25 || hasAnyTerm(card, ["蛋白", "鸡胸", "虾仁", "牛肉"])
      ? 14
      : -6;
  }
  if (goal.includes("控油") || goal.includes("低脂")) {
    if (hasAnyTerm(card, ["少油", "控油", "低脂", "轻食", "清淡"])) adjustment += 10;
    if (hasAnyTerm(card, ["油炸", "炸鸡", "肥肉", "辣椒油", "葱油"])) adjustment -= 8;
  }
  if (goal.includes("少盐")) {
    adjustment += hasAnyTerm(card, ["少盐", "清淡", "粤菜"]) ? 10 : 0;
    adjustment -= hasAnyTerm(card, ["重口", "麻辣", "火锅", "烧烤"]) ? 6 : 0;
  }
  if (goal.includes("饱腹")) {
    adjustment += isFillingCard(card) ? 10 : 0;
  }
  return adjustment;
}

function cookingWillingnessAdjustment(card, profile = {}) {
  const willingness = profile.cookingWillingness;
  if (willingness === "avoid" || willingness === "low") {
    if (card.type === "takeout") return 18;
    if (card.type === "cook" && isLowEffortCard(card)) return 8;
    if (card.type === "cook" && isHighEffortCard(card)) return -16;
    return 0;
  }

  if (willingness === "normal") {
    if (card.type === "cook" && !isHighEffortCard(card)) return 8;
    if (card.type === "cook" && isHighEffortCard(card)) return -4;
    return 0;
  }

  if (willingness === "high") {
    if (card.type === "cook" && isHighEffortCard(card)) return 18;
    if (card.type === "cook") return 12;
    if (card.type === "takeout") return -6;
    return 0;
  }

  return 0;
}

function profilePreferenceAdjustment(card, profile = {}) {
  const { score } = profilePreferenceScore(card, profile);
  return Math.min(score, 18);
}

function effortRecoveryAdjustment(card, context) {
  if (!shouldRecoverEffort(context)) return 0;
  if (isLowEffortCard(card)) return 26;
  if (isHighEffortCard(card)) return -16;
  return 0;
}

function lightnessRecoveryAdjustment(card, context) {
  if (!shouldRecoverLightness(context)) return 0;
  if (isLightCard(card)) return 22;
  if (isHeavyFlavorCard(card)) return -16;
  return 0;
}

function tasteAvoidanceAdjustment(card, context) {
  if (!shouldRecoverTaste(context)) return 0;
  const avoidedKeywords = normalizedAvoidedKeywords(context);
  if (!avoidedKeywords.length) return 0;
  return cardSharesAvoidedKeyword(card, avoidedKeywords) ? -18 : 8;
}

function varietyAdjustment(card, context) {
  const pattern = recentMealPattern(context.recentMeals);
  if (!pattern.needsVariety) return 0;

  let adjustment = 0;
  if (pattern.dominantType) {
    adjustment += card.type === pattern.dominantType ? -14 : 22;
  }
  if (pattern.repeatedKeywords.length) {
    adjustment += cardSharesRepeatedKeyword(card, pattern.repeatedKeywords) ? -8 : 4;
  }
  return adjustment;
}

function shouldRecoverBudget(context, profile = {}) {
  const range = budgetRange(profile.budgetPerPerson);
  if (!range || range[1] === Infinity) return false;

  const costs = (context.recentMeals ?? [])
    .map((meal) => numberFrom(meal.estimatedCostPerPerson))
    .filter(Boolean);
  if (costs.length < 2) return false;

  const averageCost = costs.reduce((sum, value) => sum + value, 0) / costs.length;
  return averageCost > range[1];
}

function shouldRecoverSatisfaction(context) {
  const learning = context.feedbackLearning ?? {};
  const values = [
    ...(learning.constraints ?? []),
    learning.lastFeedback?.tag
  ].map(normalizeText);
  return values.some((value) => value.includes("提高满足感") || value.includes("不够满足") || value.includes("没吃饱"));
}

function shouldRecoverEffort(context) {
  const learning = context.feedbackLearning ?? {};
  const values = [
    ...(learning.constraints ?? []),
    learning.lastFeedback?.tag
  ].map(normalizeText);
  return values.some(
    (value) => value.includes("太麻烦") || value.includes("简单省事") || value.includes("复杂备菜")
  );
}

function shouldRecoverLightness(context) {
  const learning = context.feedbackLearning ?? {};
  const values = [
    ...(learning.constraints ?? []),
    learning.lastFeedback?.tag
  ].map(normalizeText);
  return values.some(
    (value) =>
      value.includes("太油") ||
      value.includes("太咸") ||
      value.includes("少油少盐") ||
      value.includes("重口味")
  );
}

function shouldRecoverTaste(context) {
  const learning = context.feedbackLearning ?? {};
  const values = [
    ...(learning.constraints ?? []),
    learning.lastFeedback?.tag
  ].map(normalizeText);
  return values.some((value) => value.includes("不合口味") || value.includes("减少相似口味"));
}

function isLowCostCook(card, budgetPerPerson) {
  const range = budgetRange(budgetPerPerson);
  const cost = numberFrom(card.estimatedCostPerPerson);
  return Boolean(range && card.type === "cook" && cost && cost <= range[1] * 0.7);
}

function isBudgetFriendly(card, budgetPerPerson) {
  const cost = numberFrom(card.estimatedCostPerPerson);
  if (!cost) return false;
  const range = budgetRange(budgetPerPerson);
  if (!range) return cost <= 35;
  return cost >= range[0] && cost <= range[1];
}

function isFillingCard(card) {
  if (proteinGrams(card.nutritionSummary?.protein) >= 25) return true;
  const searchable = normalizeText([
    card.title,
    card.reason,
    card.nutritionSummary?.note,
    ...(card.searchKeywords ?? []),
    ...(card.ingredients ?? []).map((item) => item.name)
  ].join(" "));
  return ["米饭", "糙米", "鸡胸", "牛腩", "牛肉", "虾仁", "盖饭", "拌饭", "热汤面"].some((term) =>
    searchable.includes(term)
  );
}

function isHighProteinCard(card) {
  return proteinGrams(card.nutritionSummary?.protein) >= 25 || hasAnyTerm(card, ["高蛋白", "蛋白", "鸡胸", "虾仁", "牛肉"]);
}

function profileTuningAction(id, label, detail) {
  return { id, label, detail };
}

function budgetAlternativeCopy(card) {
  if (card.type === "cook") {
    const names = (card.ingredients ?? []).map((item) => String(item.name ?? ""));
    if (names.some((name) => name.includes("虾仁"))) {
      const alternatives = ["鸡蛋", "鸡胸肉", "豆腐"];
      return {
        detail: "少买高价主材,用鸡蛋/鸡胸肉替代部分虾仁。",
        alternatives,
        actions: [budgetPlatformAction("cheap_ingredients", "搜平价替代食材", "xiaoxiang", [...alternatives, "平价", "特价"])]
      };
    }
    if (names.some((name) => name.includes("牛腩") || name.includes("牛肉"))) {
      const alternatives = ["鸡腿肉", "鸡胸肉", "豆腐"];
      return {
        detail: "少买高价牛肉,用鸡腿肉/鸡胸肉补足蛋白质。",
        alternatives,
        actions: [budgetPlatformAction("cheap_ingredients", "搜平价替代食材", "xiaoxiang", [...alternatives, "平价", "特价"])]
      };
    }
    const alternatives = ["鸡蛋", "豆腐", "当季菜"];
    return {
      detail: "先减少高价主材,用鸡蛋/豆腐补足蛋白质。",
      alternatives,
      actions: [budgetPlatformAction("cheap_ingredients", "搜平价替代食材", "xiaoxiang", [...alternatives, "平价", "特价"])]
    };
  }

  if (card.type === "dine_out") {
    const keywords = uniqueClean([card.title, ...(card.searchKeywords ?? [])]);
    const foodKeywords = uniqueClean(card.searchKeywords ?? []);
    return {
      detail: "先看团购套餐,或者改成相近外卖/自己做。",
      alternatives: ["团购套餐", "同类外卖", "自己做相近口味"],
      actions: [
        budgetPlatformAction("group_deal", "看团购套餐", "meituan", [...keywords, "团购", "套餐"]),
        budgetPlatformAction("similar_takeout", "搜同类外卖", "meituan", [...foodKeywords, "外卖", "低价"]),
        budgetPlatformAction("cook_similar", "买食材自己做", "xiaoxiang", [...foodKeywords, "家常", "食材"])
      ]
    };
  }

  return {
    detail: "优先搜满减套餐、低客单价店铺或换成家常热汤面。",
    alternatives: ["满减套餐", "低价店铺", "热汤面/盖饭"],
    actions: [
      budgetPlatformAction("takeout_deal", "搜满减套餐", "meituan", [
        ...(card.searchKeywords ?? []),
        "满减",
        "低价"
      ])
    ]
  };
}

function budgetPlatformAction(id, label, platform, keywords) {
  return {
    id,
    label,
    type: "platform",
    platform,
    keywords: uniqueClean(keywords)
  };
}

function budgetSwapSuggestion(card, profile = {}, candidateCards = []) {
  const range = budgetRange(profile.budgetPerPerson);
  const currentCost = numberFrom(card.estimatedCostPerPerson);
  if (!range || range[1] === Infinity || !currentCost || !candidateCards.length) return null;

  const candidate = candidateCards
    .filter((item) => item?.id !== card.id)
    .map((item) => ({ card: item, cost: numberFrom(item.estimatedCostPerPerson) }))
    .filter((item) => item.cost && item.cost <= range[1] && item.cost < currentCost)
    .sort((a, b) => a.cost - b.cost)[0];

  if (!candidate) return null;

  return {
    cardId: candidate.card.id,
    title: candidate.card.title,
    label: "改选更省钱",
    savingText: `省 ¥${currentCost - candidate.cost}/人`,
    detail: `预算内,人均约 ¥${candidate.cost}`
  };
}

function isLowEffortCard(card) {
  if (card.type === "takeout") return true;
  if (card.estimatedMinutes && card.estimatedMinutes <= 25) return true;
  return ["easy"].includes(card.complexity || card.difficulty);
}

function isHighEffortCard(card) {
  if (card.estimatedMinutes && card.estimatedMinutes > 45) return true;
  return ["hard", "rich"].includes(card.complexity || card.difficulty);
}

function matchesCookingWillingness(card, willingness) {
  if (willingness === "avoid" || willingness === "low") {
    return card.type === "takeout" || (card.type === "cook" && isLowEffortCard(card));
  }
  if (willingness === "normal") {
    return card.type === "cook" && !isHighEffortCard(card);
  }
  if (willingness === "high") {
    return card.type === "cook";
  }
  return false;
}

function isLightCard(card) {
  const searchable = cardSearchText(card);
  return ["清淡", "少油", "少盐", "轻食", "砂锅粥", "粤菜", "控油", "低脂"].some((term) =>
    searchable.includes(term)
  );
}

function isHeavyFlavorCard(card) {
  const searchable = cardSearchText(card);
  return ["重口", "香辣", "麻辣", "火锅", "烧烤", "烤肉", "油炸", "炸鸡", "肥肉", "辣椒油"].some((term) =>
    searchable.includes(term)
  );
}

function hasAnyTerm(card, terms) {
  const searchable = cardSearchText(card);
  return terms.some((term) => searchable.includes(term));
}

function profilePreferenceScore(card, profile = {}) {
  const searchable = cardSearchText(card);
  const favoriteMatches = normalizedProfileTerms(profile.favoriteIngredients).filter((term) => searchable.includes(term));
  const cuisineMatches = normalizedProfileTerms(profile.cuisinePreferences).filter((term) => searchable.includes(term));
  const tasteMatches = normalizedProfileTerms(profile.tasteTags, ["都行"]).filter((term) => searchable.includes(term));

  return {
    score: favoriteMatches.length * 6 + cuisineMatches.length * 4 + tasteMatches.length * 3,
    matches: [...favoriteMatches, ...cuisineMatches, ...tasteMatches]
  };
}

function normalizedProfileTerms(values, excluded = []) {
  const excludedSet = new Set(excluded.map(normalizeText));
  return [...new Set(values ?? [])]
    .map(normalizeText)
    .filter(Boolean)
    .filter((term) => !excludedSet.has(term));
}

function formatAdjustment(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function dailyReviewImpactLabel(id) {
  return {
    budget_recovery: "帮你控预算",
    satisfaction_recovery: "补足满足感",
    effort_recovery: "少折腾",
    lightness_recovery: "清爽少油",
    taste_avoidance: "避开上次口味"
  }[id] ?? "复盘影响";
}

function normalizedAvoidedKeywords(context) {
  return (context.feedbackLearning?.avoidedKeywords ?? []).map(normalizeText).filter(Boolean);
}

function cardSharesAvoidedKeyword(card, avoidedKeywords) {
  const terms = cardTerms(card);
  return avoidedKeywords.some((keyword) => terms.includes(keyword));
}

function recentMealPattern(recentMeals = []) {
  const recent = recentMeals.slice(0, 4);
  if (recent.length < 3) {
    return { needsVariety: false, dominantType: "", repeatedKeywords: [] };
  }

  const typeEntries = Object.entries(countBy(recent.map((meal) => meal.type))).sort((a, b) => b[1] - a[1]);
  const [dominantType, dominantCount = 0] = typeEntries[0] ?? [];
  const repeatedKeywords = Object.entries(
    countBy(recent.flatMap((meal) => meal.searchKeywords ?? []).map(normalizeText))
  )
    .filter(([, count]) => count >= 2)
    .map(([keyword]) => keyword);

  const hasDominantType = Boolean(dominantType && dominantCount >= 3);
  return {
    needsVariety: hasDominantType || repeatedKeywords.length > 0,
    dominantType: hasDominantType ? dominantType : "",
    repeatedKeywords
  };
}

function cardSharesRepeatedKeyword(card, repeatedKeywords) {
  if (!repeatedKeywords.length) return false;
  const terms = cardTerms(card);
  return repeatedKeywords.some((keyword) => terms.includes(keyword));
}

function countBy(values) {
  return values.filter(Boolean).reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function cardTerms(card) {
  return [
    card.title,
    card.reason,
    card.subtitle,
    ...(card.searchKeywords ?? []),
    ...(card.ingredients ?? []).map((item) => item.name)
  ].map(normalizeText);
}

function cardSearchText(card) {
  return normalizeText([
    card.title,
    card.reason,
    card.subtitle,
    card.nutritionSummary?.note,
    ...(card.searchKeywords ?? []),
    ...(card.ingredients ?? []).map((item) => item.name)
  ].join(" "));
}

function budgetRange(value) {
  return {
    under_15: [0, 15],
    "15_30": [0, 30],
    "30_60": [0, 60],
    "60_plus": [60, Infinity]
  }[value];
}

function budgetShortLabel(value) {
  return {
    under_15: "¥15以下",
    "15_30": "¥15-30",
    "30_60": "¥30-60",
    "60_plus": "¥60+"
  }[value];
}

function numberFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function uniqueClean(values) {
  const seen = new Set();
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}
