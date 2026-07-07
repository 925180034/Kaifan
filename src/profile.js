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
