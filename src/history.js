import { favoriteHasRecipeDetails } from "./favorites.js";

const typeLabels = {
  cook: "自己做",
  takeout: "点外卖",
  dine_out: "出去吃"
};

export function buildHistorySummary(state) {
  const favoriteMeals = (state.favoriteMeals ?? []).map((meal) => ({
    id: meal.id,
    type: meal.type,
    typeLabel: typeLabels[meal.type] ?? "晚餐",
    title: meal.title,
    favoritedAt: meal.favoritedAt,
    searchKeywords: [...(meal.searchKeywords ?? [])],
    canOpenRecipe: favoriteHasRecipeDetails(meal)
  }));
  const recentMeals = (state.recentMeals ?? []).map((meal) => ({
    id: meal.id,
    type: meal.type,
    typeLabel: typeLabels[meal.type] ?? "晚餐",
    title: meal.title,
    selectedAt: meal.selectedAt,
    displayedAt: meal.completedAt ?? meal.selectedAt,
    ...(meal.completedAt ? { completedAt: meal.completedAt, statusText: "已完成" } : {}),
    searchKeywords: [...(meal.searchKeywords ?? [])],
    ...(numberFrom(meal.estimatedCostPerPerson) ? { estimatedCostPerPerson: numberFrom(meal.estimatedCostPerPerson) } : {}),
    ...(meal.costText ? { costText: meal.costText } : {})
  }));
  const feedback = state.feedback ?? [];
  const positiveFeedbackCount = feedback.filter((item) => isPositiveFeedback(item.tag)).length;
  const negativeFeedbackCount = feedback.length - positiveFeedbackCount;
  const learning = state.feedbackLearning ?? {};
  const likedKeywords = [...(learning.likedKeywords ?? [])];
  const avoidedKeywords = [...(learning.avoidedKeywords ?? [])];
  const constraints = [...(learning.constraints ?? [])];
  const spendSummary = buildSpendSummary(recentMeals, state.profile);

  return {
    hasHistory:
      recentMeals.length > 0 ||
      favoriteMeals.length > 0 ||
      feedback.length > 0 ||
      likedKeywords.length > 0 ||
      avoidedKeywords.length > 0 ||
      constraints.length > 0,
    favoriteMeals,
    recentMeals,
    feedbackCount: feedback.length,
    positiveFeedbackCount,
    negativeFeedbackCount,
    likedKeywords,
    avoidedKeywords,
    constraints,
    spendSummary,
    insights: buildInsights(recentMeals, feedback, spendSummary)
  };
}

function isPositiveFeedback(tag = "") {
  return tag.includes("好吃") || tag.includes("下次还吃");
}

function buildInsights(recentMeals, feedback, spendSummary) {
  const insights = [];
  const typeInsight = dominantTypeInsight(recentMeals);
  const keywordInsight = frequentKeywordInsight(recentMeals);
  const suggestion = nextMealSuggestion(typeInsight, feedback, spendSummary);

  if (typeInsight) insights.push(typeInsight);
  if (keywordInsight) insights.push(keywordInsight);
  if (suggestion) insights.push(suggestion);
  return insights;
}

function dominantTypeInsight(recentMeals) {
  if (!recentMeals.length) return null;
  const counts = countBy(recentMeals.map((meal) => meal.type));
  const [type, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!type || count < 2) return null;

  return {
    label: "最近偏好",
    value: `${typeLabels[type] ?? "晚餐"} ${count}/${recentMeals.length} 次`,
    tone: type === "takeout" ? "amber" : type === "cook" ? "green" : "blue"
  };
}

function frequentKeywordInsight(recentMeals) {
  const keywords = recentMeals.flatMap((meal) => meal.searchKeywords ?? []);
  const counts = countBy(keywords);
  const [keyword, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!keyword || count < 2) return null;

  return {
    label: "高频关键词",
    value: keyword,
    tone: "green"
  };
}

function nextMealSuggestion(typeInsight, feedback, spendSummary) {
  if (spendSummary?.budgetStatus === "over") {
    return {
      label: "下次建议",
      value: "下一餐优先自己做,把人均拉回预算内",
      tone: "amber"
    };
  }

  const tags = feedback.map((item) => item.tag ?? "");
  if (tags.some((tag) => tag.includes("不够满足") || tag.includes("没吃饱"))) {
    return {
      label: "下次建议",
      value: "预算内加一份蛋白质或主食,别只追求省钱",
      tone: "blue"
    };
  }

  const hasBudgetOrOilIssue = tags.some((tag) => tag.includes("太贵") || tag.includes("太油") || tag.includes("太咸"));
  if (typeInsight?.value.startsWith("点外卖") && hasBudgetOrOilIssue) {
    return {
      label: "下次建议",
      value: "穿插一次自己做,平衡预算和油盐",
      tone: "blue"
    };
  }
  if (typeInsight?.value.startsWith("自己做")) {
    return {
      label: "下次建议",
      value: "保留快手菜,偶尔换一种主蛋白",
      tone: "blue"
    };
  }
  return null;
}

function countBy(values) {
  return values.filter(Boolean).reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function buildSpendSummary(recentMeals, profile = {}) {
  const costs = recentMeals
    .map((meal) => numberFrom(meal.estimatedCostPerPerson))
    .filter(Boolean);
  const totalEstimatedCost = costs.reduce((sum, value) => sum + value, 0);
  const mealCount = costs.length;
  if (!mealCount) {
    return {
      hasSpend: false,
      mealCount: 0,
      totalEstimatedCost: 0,
      averageCostPerPerson: 0,
      label: "还没有花费估算",
      averageLabel: ""
    };
  }
  const averageCostPerPerson = Math.round(totalEstimatedCost / mealCount);
  const summary = {
    hasSpend: true,
    mealCount,
    totalEstimatedCost,
    averageCostPerPerson,
    label: `近 ${mealCount} 次约 ¥${totalEstimatedCost}`,
    averageLabel: `平均 ¥${averageCostPerPerson}/人`
  };
  return withBudgetStatus(summary, profile.budgetPerPerson);
}

function numberFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function withBudgetStatus(summary, budgetPerPerson) {
  const budget = budgetRange(budgetPerPerson);
  if (!budget) return summary;

  let budgetStatus = "within";
  let statusText = "符合预算";
  if (summary.averageCostPerPerson > budget.max) {
    budgetStatus = "over";
    statusText = "高于预算";
  } else if (summary.averageCostPerPerson < budget.min) {
    budgetStatus = "under";
    statusText = "低于预算";
  }

  return {
    ...summary,
    budgetStatus,
    budgetLabel: budget.label,
    budgetMessage: `最近平均 ¥${summary.averageCostPerPerson}/人,${statusText} ${budget.label}`
  };
}

function budgetRange(value) {
  return {
    under_15: { min: 0, max: 15, label: "¥15以下/人" },
    "15_30": { min: 15, max: 30, label: "¥15-30/人" },
    "30_60": { min: 30, max: 60, label: "¥30-60/人" },
    "60_plus": { min: 60, max: Infinity, label: "¥60+/人" }
  }[value];
}
