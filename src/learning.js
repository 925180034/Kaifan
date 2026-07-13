const maxRecentMeals = 8;
const maxKeywords = 16;
const quickFeedbackTags = ["好吃,下次还吃", "太贵", "太麻烦", "不够满足", "太油/太咸", "不合口味"];

const negativeConstraints = {
  "太贵": "控制预算,少推荐高价方案",
  "太麻烦": "优先简单省事,少推荐复杂备菜",
  "没吃饱": "提高饱腹感,兼顾主食和蛋白质",
  "不够满足": "提高满足感,预算内增加蛋白质和主食",
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

export function recordCompletedMeal(state, card, timestamp = new Date().toISOString()) {
  const existing = state.recentMeals ?? [];
  const previous = existing.find((item) => item.id === card.id);
  const meal = {
    ...compactMeal(card, previous?.selectedAt ?? timestamp),
    completedAt: timestamp
  };
  state.recentMeals = [
    meal,
    ...existing.filter((item) => item.id !== meal.id)
  ].slice(0, maxRecentMeals);
  return state.recentMeals;
}

export function recordMealFeedback(state, cardId, tag, timestamp = new Date().toISOString(), meal = null) {
  state.feedback ??= [];
  const feedbackMeal = { id: cardId, selectedAt: meal?.selectedAt };
  const existing = state.feedback.find((item) => feedbackMatchesMeal(item, feedbackMeal));
  if (existing) {
    return { feedback: existing, recorded: false };
  }

  const feedback = {
    cardId,
    tag,
    createdAt: timestamp,
    ...(meal?.selectedAt ? { mealSelectedAt: meal.selectedAt } : {})
  };
  state.feedback = [feedback, ...state.feedback];
  return { feedback, recorded: true };
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
  context.favoriteMeals = deepClone(state.favoriteMeals ?? []);
  context.feedbackLearning = deepClone(ensureFeedbackLearning(state));
  return context;
}

export function buildLearningSummary(feedbackLearning) {
  const learning = normalizeLearning(feedbackLearning);
  const chips = [
    learning.likedKeywords.length && `更偏向 ${learning.likedKeywords.slice(0, 3).join("/")}`,
    learning.avoidedKeywords.length && `已避开 ${learning.avoidedKeywords.slice(0, 3).join("/")}`,
    learning.constraints.length && `记住 ${shortConstraint(learning.constraints[0])}`
  ].filter(Boolean);

  if (!chips.length) return null;

  return {
    title: "正在学习你的晚餐偏好",
    chips,
    lastFeedbackText: learning.lastFeedback?.tag ? `上次反馈: ${learning.lastFeedback.tag}` : "",
    impact: feedbackImpact(learning.lastFeedback?.tag)
  };
}

export function buildQuickFeedbackPrompt(recentMeals = [], feedback = []) {
  const latest = recentMeals[0];
  if (!latest?.id) return null;

  const alreadyReviewed = (feedback ?? []).some((item) => feedbackMatchesMeal(item, latest));
  if (alreadyReviewed) return null;

  const completed = Boolean(latest.completedAt);
  return {
    cardId: latest.id,
    title: completed ? "这顿吃得怎么样?" : "这顿吃完了吗?",
    text: completed
      ? `给 ${latest.title || "这顿饭"} 留个反馈,下次推荐会更准。`
      : `给 ${latest.title || "这顿饭"} 记一笔,下次推荐会更准。`,
    tags: quickFeedbackTags
  };
}

export function buildNextMealPlan(recentMeals = [], profile = {}, feedbackLearning = null, candidateCards = []) {
  const latest = recentMeals[0];
  if (!latest) return null;

  const cost = numberFrom(latest.estimatedCostPerPerson);
  const budget = budgetRange(profile.budgetPerPerson);
  const budgetLabel = budgetShortLabel(profile.budgetPerPerson);
  const action = buildFeedbackRecoveryAction(latest, profile, feedbackLearning, candidateCards);
  const feedbackPlan = buildFeedbackNextMealPlan(feedbackLearning, action);
  if (feedbackPlan) return feedbackPlan;

  if (cost && budget && budget[1] !== Infinity && cost > budget[1]) {
    return nextMealPlan(
      "上一餐人均 ¥" + cost + ",下一餐建议选自己做或低价外卖把预算拉回来。",
      ["预算拉回", "优先自己做", `人均 ${budgetLabel}`],
      action
    );
  }

  if (latest.type === "takeout") {
    return nextMealPlan(
      "上一餐是外卖,下一餐可以准备一个 20 分钟内的家常方案换换节奏。",
      ["换成自己做", "快手菜", "少洗碗"],
      action
    );
  }

  if (latest.type === "dine_out") {
    return nextMealPlan(
      "上一餐出门吃了,下一餐可以优先选家常或外卖轻食,少一点决策成本。",
      ["家常一点", "少排队", "控预算"],
      action
    );
  }

  if (latest.type === "cook") {
    return nextMealPlan(
      "上一餐自己做了,下一餐可以保留一个低负担备用方案,不想做时也不乱点。",
      ["备用外卖", "简单收尾", "不纠结"],
      action
    );
  }

  return null;
}

export function buildDailyReview(feedbackLearning) {
  const learning = normalizeLearning(feedbackLearning);
  const tag = learning.lastFeedback?.tag ?? "";
  if (!tag) return null;

  if (tag.includes("好吃") || tag.includes("下次还吃")) {
    const title = learning.lastFeedback?.cardTitle || "上次那顿";
    return dailyReview(
      `上次喜欢${title}，今天继续靠近你喜欢的口味。`,
      learning.likedKeywords.slice(0, 3)
    );
  }

  if (tag === "太油/太咸") {
    return dailyReview("上次觉得太油/太咸，今天默认更清淡少油。", ["清淡少油", "避开重口"]);
  }

  if (tag === "没吃饱" || tag === "不够满足") {
    return dailyReview("上次觉得不够满足，今天优先更扎实的主食和蛋白质。", ["补足满足感", "蛋白质"]);
  }

  if (tag === "太麻烦") {
    return dailyReview("上次觉得太麻烦，今天优先更省事的方案。", ["少折腾", "快手"]);
  }

  if (tag === "太贵") {
    return dailyReview("上次觉得太贵，今天优先控制人均预算。", ["预算优先", "少花一点"]);
  }

  if (tag === "不合口味") {
    return dailyReview("上次觉得不合口味，今天会避开相似关键词。", learning.avoidedKeywords.slice(0, 2));
  }

  return null;
}

export function buildFeedbackProfileSuggestion(feedbackLearning, profile = {}) {
  const learning = normalizeLearning(feedbackLearning);
  const tag = learning.lastFeedback?.tag ?? "";
  const tasteTags = profile.tasteTags ?? [];

  if (tag === "太油/太咸" && !(tasteTags.includes("清淡") && tasteTags.includes("少油"))) {
    return feedbackSuggestion(
      "prefer_light",
      "把画像调成清淡少油？",
      "后续会更少推荐油咸重口的方案"
    );
  }

  if ((tag === "没吃饱" || tag === "不够满足") && !String(profile.nutritionGoal ?? "").includes("高蛋白")) {
    return feedbackSuggestion(
      "prefer_high_protein",
      "把营养目标调成高蛋白？",
      "后续会更偏向蛋白质和主食更扎实的方案"
    );
  }

  if (tag === "太麻烦" && !["low", "avoid"].includes(profile.cookingWillingness)) {
    return feedbackSuggestion(
      "prefer_low_effort",
      "把做饭意愿调低一点？",
      "后续会更多推荐外卖或简单省事方案"
    );
  }

  if (tag === "太贵" && !["under_15", "15_30"].includes(profile.budgetPerPerson)) {
    return feedbackSuggestion(
      "tighten_budget",
      "把预算收紧到 ¥15-30？",
      "后续会更优先控制人均花费"
    );
  }

  return null;
}

function feedbackMatchesMeal(feedback, meal) {
  if (feedback.cardId !== meal.id) return false;
  if (!meal.selectedAt) return true;
  if (feedback.mealSelectedAt) return feedback.mealSelectedAt === meal.selectedAt;
  if (!feedback.createdAt) return false;
  return isSameOrAfter(feedback.createdAt, meal.selectedAt);
}

function isSameOrAfter(value, baseline) {
  const current = Date.parse(value);
  const reference = Date.parse(baseline);
  if (!Number.isFinite(current) || !Number.isFinite(reference)) return false;
  return current >= reference;
}

function compactMeal(card, selectedAt) {
  const meal = {
    id: card.id,
    type: card.type,
    title: card.title,
    searchKeywords: compactKeywords(card.searchKeywords),
    selectedAt
  };
  const estimatedCost = numberFrom(card.estimatedCostPerPerson);
  if (estimatedCost) meal.estimatedCostPerPerson = estimatedCost;
  if (card.costText) meal.costText = String(card.costText);
  return meal;
}

function feedbackSuggestion(actionId, title, detail) {
  return {
    actionId,
    title,
    detail,
    buttonLabel: "确认写入画像"
  };
}

function feedbackImpact(tag = "") {
  const items = {
    "太贵": ["少推高价方案", "优先预算内和自己做"],
    "太麻烦": ["少推复杂备菜", "优先快手菜和低负担方案"],
    "没吃饱": ["提高主食和蛋白质权重", "减少太轻的方案"],
    "不够满足": ["提高主食和蛋白质权重", "减少太轻的方案"],
    "太油/太咸": ["少推油咸重口", "提高清淡少油权重"],
    "不合口味": ["避开相似关键词", "增加不同口味选择"]
  }[tag];

  if (items) {
    return {
      title: "下次会这样调整",
      items
    };
  }

  if (tag.includes("好吃") || tag.includes("下次还吃")) {
    return {
      title: "下次会这样调整",
      items: ["保留喜欢关键词", "继续靠近这类口味"]
    };
  }

  return null;
}

function dailyReview(text, chips = []) {
  return {
    title: "今日复盘",
    text,
    chips: compactKeywords(chips).slice(0, 3)
  };
}

function nextMealPlan(text, chips = [], action = null) {
  const plan = {
    title: "下一餐建议",
    text,
    chips: compactKeywords(chips).slice(0, 3)
  };
  if (action) plan.action = action;
  return plan;
}

function buildFeedbackNextMealPlan(feedbackLearning = null, action = null) {
  const tag = normalizeLearning(feedbackLearning).lastFeedback?.tag ?? "";
  const copy = {
    "太贵": {
      text: "上次觉得太贵,下一餐优先把人均拉回预算内,自己做和低价外卖优先。",
      chips: ["控预算", "优先自己做", "少花一点"]
    },
    "太麻烦": {
      text: "上次觉得太麻烦,下一餐优先 20 分钟内、少洗碗、低备菜压力的方案。",
      chips: ["少折腾", "20分钟内", "低负担"]
    },
    "太油/太咸": {
      text: "上次觉得太油/太咸,下一餐默认更清淡少油,避开重口。",
      chips: ["清淡少油", "避开重口", "少盐"]
    },
    "没吃饱": {
      text: "上次没吃饱,下一餐优先补足主食和蛋白质,别只追求轻。",
      chips: ["更顶饱", "加蛋白", "有主食"]
    },
    "不够满足": {
      text: "上次不够满足,下一餐优先更扎实的蛋白质和主食。",
      chips: ["更满足", "蛋白质", "主食"]
    },
    "不合口味": {
      text: "上次觉得不合口味,下一餐先换一组关键词,避开相似口味。",
      chips: ["换口味", "避开相似", "重新试探"]
    }
  }[tag];

  if (!copy) return null;
  return nextMealPlan(copy.text, copy.chips, action);
}

function buildFeedbackRecoveryAction(latest, profile = {}, feedbackLearning = null, candidateCards = []) {
  const tag = normalizeLearning(feedbackLearning).lastFeedback?.tag ?? "";

  if (tag === "太贵") return buildBudgetRecoveryAction(latest, profile, feedbackLearning, candidateCards);
  if (tag === "太麻烦") return buildEffortRecoveryAction(latest, profile, candidateCards);
  if (tag === "太油/太咸") return buildLightnessRecoveryAction(latest, profile, candidateCards);
  if (tag === "没吃饱" || tag === "不够满足") return buildSatisfactionRecoveryAction(latest, profile, candidateCards);
  if (tag === "不合口味") return buildTasteRecoveryAction(latest, profile, feedbackLearning, candidateCards);

  return buildBudgetRecoveryAction(latest, profile, feedbackLearning, candidateCards);
}

function buildBudgetRecoveryAction(latest, profile = {}, feedbackLearning = null, candidateCards = []) {
  const tag = normalizeLearning(feedbackLearning).lastFeedback?.tag ?? "";
  const latestCost = numberFrom(latest.estimatedCostPerPerson);
  const budget = budgetRange(profile.budgetPerPerson);
  if (!budget || budget[1] === Infinity || !latestCost || !candidateCards.length) return null;
  if (tag !== "太贵" && latestCost <= budget[1]) return null;

  const candidate = candidateCards
    .filter((card) => card?.id !== latest.id)
    .map((card) => ({ card, cost: numberFrom(card.estimatedCostPerPerson) }))
    .filter((item) => item.cost && item.cost <= budget[1] && item.cost < latestCost)
    .sort((a, b) => a.cost - b.cost)[0];

  if (!candidate) return null;

  return {
    cardId: candidate.card.id,
    label: "选这个省预算",
    title: candidate.card.title,
    detail: `人均约 ¥${candidate.cost},比上一餐省 ¥${latestCost - candidate.cost}/人`,
    reasons: actionReasons(`省 ¥${latestCost - candidate.cost}/人`, budgetFitReason(candidate.card, profile), `人均 ¥${candidate.cost}`)
  };
}

function buildEffortRecoveryAction(latest, profile = {}, candidateCards = []) {
  const candidate = candidatesExceptLatest(latest, candidateCards)
    .filter(isLowEffortCard)
    .map((card) => ({
      card,
      minutes: numberFrom(card.estimatedMinutes),
      score: budgetPenalty(card, profile) + physicalEffortScore(card)
    }))
    .sort((a, b) => a.score - b.score)[0];

  if (!candidate) return null;

  return {
    cardId: candidate.card.id,
    label: "选这个少折腾",
    title: candidate.card.title,
    detail: candidate.minutes ? `约 ${candidate.minutes} 分钟,低负担备用` : "免开火,低负担备用",
    reasons: actionReasons(candidate.minutes ? `${candidate.minutes} 分钟` : "免开火", "低负担", budgetFitReason(candidate.card, profile))
  };
}

function buildLightnessRecoveryAction(latest, profile = {}, candidateCards = []) {
  const candidate = candidatesExceptLatest(latest, candidateCards)
    .filter((card) => isLightCard(card) && !isHeavyFlavorCard(card))
    .map((card) => ({
      card,
      score: budgetPenalty(card, profile) + numberFrom(card.estimatedCostPerPerson) + physicalEffortScore(card) * 0.2
    }))
    .sort((a, b) => a.score - b.score)[0];

  if (!candidate) return null;

  return {
    cardId: candidate.card.id,
    label: "选这个清淡点",
    title: candidate.card.title,
    detail: "清淡少油,避开重口",
    reasons: actionReasons("清淡少油", "避开重口", budgetFitReason(candidate.card, profile))
  };
}

function buildSatisfactionRecoveryAction(latest, profile = {}, candidateCards = []) {
  const candidate = candidatesExceptLatest(latest, candidateCards)
    .filter(isFillingCard)
    .map((card) => ({
      card,
      score: budgetPenalty(card, profile) - proteinGrams(card.nutritionSummary?.protein) + numberFrom(card.estimatedCostPerPerson) * 0.15
    }))
    .sort((a, b) => a.score - b.score)[0];

  if (!candidate) return null;

  const proteinText = candidate.card.nutritionSummary?.protein;
  return {
    cardId: candidate.card.id,
    label: "选这个更顶饱",
    title: candidate.card.title,
    detail: proteinText ? `蛋白质 ${proteinText},主食和蛋白更扎实` : "主食和蛋白更扎实",
    reasons: actionReasons(proteinText ? `蛋白质 ${proteinText}` : "蛋白更足", "更有饱腹感", budgetFitReason(candidate.card, profile))
  };
}

function buildTasteRecoveryAction(latest, profile = {}, feedbackLearning = null, candidateCards = []) {
  const avoided = compactKeywords([
    ...normalizeLearning(feedbackLearning).avoidedKeywords,
    ...(latest.searchKeywords ?? [])
  ]).slice(0, 4);
  const candidate = candidatesExceptLatest(latest, candidateCards)
    .map((card) => ({
      card,
      overlap: keywordOverlap(card, avoided),
      score: keywordOverlap(card, avoided) * 100 + budgetPenalty(card, profile) + physicalEffortScore(card) * 0.1
    }))
    .filter((item) => item.overlap === 0)
    .sort((a, b) => a.score - b.score)[0];

  if (!candidate) return null;

  const avoidedText = avoided.slice(0, 2).join("/");
  return {
    cardId: candidate.card.id,
    label: "选这个换口味",
    title: candidate.card.title,
    detail: avoidedText ? `避开 ${avoidedText},换一组关键词试探。` : "换一组关键词试探。",
    reasons: actionReasons("避开相似", "换关键词", budgetFitReason(candidate.card, profile))
  };
}

function actionReasons(...values) {
  return compactKeywords(values).slice(0, 3);
}

function budgetFitReason(card, profile = {}) {
  const budget = budgetRange(profile.budgetPerPerson);
  const cost = numberFrom(card.estimatedCostPerPerson);
  if (!budget || !cost) return "";
  if (budget[1] === Infinity) return cost >= budget[0] ? "符合预算" : "";
  return cost <= budget[1] ? "预算内" : "";
}

function candidatesExceptLatest(latest, candidateCards = []) {
  return (candidateCards ?? []).filter((card) => card?.id && card.id !== latest.id);
}

function budgetPenalty(card, profile = {}) {
  const budget = budgetRange(profile.budgetPerPerson);
  const cost = numberFrom(card.estimatedCostPerPerson);
  if (!budget || !cost) return 0;
  if (budget[1] !== Infinity && cost > budget[1]) return 80;
  if (cost < budget[0]) return 10;
  return 0;
}

function physicalEffortScore(card) {
  if (card.type === "takeout") return 18;
  if (card.type === "dine_out") return 55;
  const minutes = numberFrom(card.estimatedMinutes);
  return minutes || (isLowEffortCard(card) ? 25 : 40);
}

function isLowEffortCard(card) {
  if (card.type === "takeout") return true;
  const minutes = numberFrom(card.estimatedMinutes);
  if (minutes && minutes <= 25) return true;
  return ["easy"].includes(card.complexity || card.difficulty);
}

function isLightCard(card) {
  return hasAnyTerm(card, ["清淡", "少油", "少盐", "轻食", "蒸", "汤", "粥", "日式", "粤菜", "低脂", "控油"]);
}

function isHeavyFlavorCard(card) {
  return hasAnyTerm(card, ["重口", "香辣", "麻辣", "炸", "油腻", "咸"]);
}

function isFillingCard(card) {
  if (proteinGrams(card.nutritionSummary?.protein) >= 25) return true;
  return hasAnyTerm(card, ["高蛋白", "蛋白", "鸡胸", "牛肉", "牛腩", "虾仁", "米饭", "盖饭", "拌饭", "土豆", "主食", "饱腹"]);
}

function keywordOverlap(card, keywords = []) {
  const searchable = cardKeywords(card);
  return compactKeywords(keywords).filter((keyword) => searchable.includes(keyword)).length;
}

function cardKeywords(card) {
  return compactKeywords([
    card.title,
    card.subtitle,
    card.reason,
    ...(card.searchKeywords ?? []),
    ...(card.ingredients ?? []).map((item) => item.name)
  ]).join(" ");
}

function hasAnyTerm(card, terms = []) {
  const searchable = [
    card.title,
    card.subtitle,
    card.reason,
    card.nutritionSummary?.note,
    ...(card.searchKeywords ?? []),
    ...(card.ingredients ?? []).map((item) => item.name)
  ].join(" ");
  return terms.some((term) => searchable.includes(term));
}

function proteinGrams(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function ensureFeedbackLearning(state) {
  return normalizeLearning(state.feedbackLearning);
}

function normalizeLearning(feedbackLearning) {
  return {
    likedKeywords: compactKeywords(feedbackLearning?.likedKeywords),
    avoidedKeywords: compactKeywords(feedbackLearning?.avoidedKeywords),
    constraints: compactKeywords(feedbackLearning?.constraints),
    lastFeedback: feedbackLearning?.lastFeedback ?? null
  };
}

function shortConstraint(value) {
  return String(value ?? "").split(/[，,]/)[0].trim();
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

function numberFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
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
  }[value] ?? "当前预算";
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}
