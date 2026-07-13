const spicyLabels = {
  none: "不吃辣",
  mild: "微辣",
  medium: "中辣",
  hot: "重辣"
};

const budgetLabels = {
  under_15: "¥15以下/人",
  "15_30": "¥15-30/人",
  "30_60": "¥30-60/人",
  "60_plus": "¥60+/人"
};

export const profilePresets = [
  {
    id: "easy_takeout",
    title: "省心外卖",
    hint: "少决策,优先快送和稳妥口味",
    values: {
      spicyLevel: "mild",
      budgetPerPerson: "30_60",
      cookingWillingness: "low",
      nutritionGoal: "均衡",
      tasteTags: ["家常", "少油", "都行"],
      cuisinePreferences: ["家常", "轻食"],
      favoriteIngredients: ["鸡蛋", "鸡胸肉", "青菜"]
    }
  },
  {
    id: "healthy_home",
    title: "健康家常",
    hint: "高蛋白控油,适合自己做",
    values: {
      spicyLevel: "mild",
      budgetPerPerson: "30_60",
      cookingWillingness: "normal",
      nutritionGoal: "高蛋白控油",
      tasteTags: ["清淡", "少油", "家常"],
      cuisinePreferences: ["家常", "粤菜"],
      favoriteIngredients: ["虾仁", "豆腐", "鸡胸肉", "番茄"]
    }
  },
  {
    id: "treat_dineout",
    title: "吃点好的",
    hint: "预算放宽,优先到店体验",
    values: {
      spicyLevel: "medium",
      budgetPerPerson: "60_plus",
      cookingWillingness: "low",
      nutritionGoal: "均衡",
      tasteTags: ["家常", "重口"],
      cuisinePreferences: ["川湘", "江浙", "粤菜"],
      favoriteIngredients: ["牛肉", "虾仁", "土豆"]
    }
  }
];

export function applyProfilePreset(draft, presetId) {
  const preset = profilePresets.find((item) => item.id === presetId);
  if (!preset) return draft;

  return {
    ...draft,
    ...preset.values,
    peopleCount: draft.peopleCount,
    taboos: [...(draft.taboos ?? [])],
    allergies: [...(draft.allergies ?? [])],
    dislikes: [...(draft.dislikes ?? [])],
    tasteTags: [...preset.values.tasteTags],
    cuisinePreferences: [...preset.values.cuisinePreferences],
    favoriteIngredients: [...preset.values.favoriteIngredients]
  };
}

export function applyProfileTuningAction(profile, actionId) {
  const current = { ...(profile ?? {}) };

  if (actionId === "prefer_light") {
    return {
      ...current,
      tasteTags: mergeUnique([...(current.tasteTags ?? []), "清淡", "少油"])
    };
  }

  if (actionId === "prefer_cooking") {
    return { ...current, cookingWillingness: "high" };
  }

  if (actionId === "prefer_low_effort") {
    return { ...current, cookingWillingness: "low" };
  }

  if (actionId === "tighten_budget") {
    return { ...current, budgetPerPerson: "15_30" };
  }

  if (actionId === "prefer_high_protein") {
    return { ...current, nutritionGoal: "高蛋白控油" };
  }

  return profile;
}

export function parseListInput(value) {
  const seen = new Set();
  return String(value ?? "")
    .split(/[、,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function mergeUnique(values) {
  return values.filter((value, index, list) => value && list.indexOf(value) === index);
}

export function formatListInput(values) {
  return (values ?? []).join("、");
}

export function buildProfileSummary(profile) {
  const peopleText = `${profile.peopleCount ?? 1} 人`;
  const spicyText = spicyLabels[profile.spicyLevel] ?? "口味不限";
  const budgetText = budgetLabels[profile.budgetPerPerson] ?? "预算不限";
  const nutritionText = profile.nutritionGoal || "均衡";
  const favorites = (profile.favoriteIngredients ?? []).slice(0, 2).join("/");

  return [peopleText, spicyText, budgetText, nutritionText, favorites && `爱吃${favorites}`]
    .filter(Boolean)
    .join(" · ");
}
