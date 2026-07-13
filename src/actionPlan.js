import { buildSearchUrl, formatKeywords } from "./platformLinks.js";
import { scaleIngredientsForPeople, servingLabel } from "./servings.js";

const platformLabels = {
  meituan: "美团",
  dianping: "大众点评",
  xiaoxiang: "小象超市"
};

export function buildIngredientKeywords(card) {
  const values = [
    ...(card.searchKeywords ?? []),
    ...(card.ingredients ?? []).map((item) => item.name)
  ];

  return uniqueClean(values);
}

export function buildShoppingList(card, profile = {}, options = {}) {
  const sourceIngredients = card.ingredients ?? [];
  const ownedNames = ingredientNameSet(options.ownedIngredientNames);
  const ingredients = scaleIngredientsForPeople(sourceIngredients, profile.peopleCount)
    .filter((item) => !ownedNames.has(normalizeIngredientName(item.name)));
  const items = ingredients.map(formatIngredientLine);
  const list = uniqueClean(items);
  if (list.length) return list;
  if (sourceIngredients.length) return [];
  return uniqueClean(card.searchKeywords ?? []);
}

export function buildAggregatedShoppingList(cards = [], profile = {}, options = {}) {
  const items = cards
    .filter((card) => card?.type === "cook" && Array.isArray(card.ingredients))
    .flatMap((card) => buildShoppingList(card, profile, options));
  return aggregateShoppingItems(items);
}

export function buildShoppingGroups(card, profile = {}, options = {}) {
  const entries = shoppingEntriesFromCard(card, profile, options);
  if (entries.length) return groupShoppingEntries(entries);
  if ((card.ingredients ?? []).length) return [];
  const fallback = uniqueClean(card.searchKeywords ?? []);
  return fallback.length ? [{ label: "搜索关键词", items: fallback }] : [];
}

export function buildAggregatedShoppingGroups(cards = [], profile = {}, options = {}) {
  const entries = cards
    .filter((card) => card?.type === "cook" && Array.isArray(card.ingredients))
    .flatMap((card) => shoppingEntriesFromCard(card, profile, options));
  return groupShoppingEntries(entries);
}

export function buildActionPlan(card, profile = {}, context = {}) {
  if (card.type === "takeout") {
    return buildTakeoutPlan(card, profile);
  }

  if (card.type === "dine_out") {
    return buildDineOutPlan(card, profile);
  }

  return buildCookPlan(card, profile, context);
}

export function platformLabel(platform) {
  return platformLabels[platform] ?? platform;
}

function buildCookPlan(card, profile, context) {
  const recoveringBudget = shouldRecoverBudget(profile, context, card);
  const keywordChips = recoveringBudget
    ? uniqueClean([...buildIngredientKeywords(card), "平价", "特价", "当季"])
    : buildIngredientKeywords(card);
  const peopleText = servingLabel(profile);
  const restrictions = restrictionText(profile);
  const noteChips = recoveringBudget
    ? uniqueClean([...buildProfileNotes(profile), "省预算优先", "可替换高价食材"])
    : buildProfileNotes(profile);
  const shoppingOptions = { ownedIngredientNames: context.ownedIngredientNames };
  const substitutions = recoveringBudget ? budgetRecoverySubstitutions(card) : [];
  const baseShoppingList = buildShoppingList(card, profile, shoppingOptions);
  const shoppingList = recoveringBudget
    ? uniqueClean([...baseShoppingList, ...substitutions])
    : baseShoppingList;
  const shoppingGroups = appendSubstitutionGroup(
    buildShoppingGroups(card, profile, shoppingOptions),
    substitutions
  );
  const readinessSummary = buildReadinessSummary(card, shoppingList, shoppingGroups);
  const groceryKeywords = baseShoppingList.length ? baseShoppingList : keywordChips;

  return {
    title: "自己做执行方案",
    primaryPlatform: "xiaoxiang",
    summary: recoveringBudget
      ? "这餐优先把人均拉回预算内,先确认家里已有食材,高价主材只补关键缺口。"
      : "先确认家里已有食材,缺的主材直接去超市搜索。要是临时不想做,也给你留了同类外卖入口。",
    keywordChips,
    searchText: formatKeywords(keywordChips),
    shoppingList,
    shoppingGroups,
    readinessSummary,
    noteChips,
    actions: [
      {
        platform: "xiaoxiang",
        label: "去小象搜食材",
        helper: recoveringBudget
          ? "先搜平价和特价替代,高价主材少量补齐。"
          : "优先搜主材,下单前看规格和送达时间。",
        url: buildSearchUrl("xiaoxiang", groceryKeywords)
      },
      {
        platform: "meituan",
        label: "不想做了搜同类外卖",
        helper: "用同一组关键词找相近菜品,保留今晚方案。",
        url: buildSearchUrl("meituan", fallbackFoodKeywords(card))
      }
    ],
    checklist: [
      `按 ${peopleText}核对主食、蛋白质和蔬菜数量`,
      ...(recoveringBudget ? ["高价主材先买半份,用鸡蛋、豆腐或当季菜补足"] : []),
      "先用家里已有食材,只补缺口最大的 2-4 样",
      restrictions
    ]
  };
}

function buildTakeoutPlan(card, profile) {
  const keywordChips = uniqueClean([
    ...(card.searchKeywords ?? []),
    ...profileSearchKeywords(profile),
    "少油",
    "高评分"
  ]);
  const noteChips = buildProfileNotes(profile);

  return {
    title: "点外卖执行方案",
    primaryPlatform: "meituan",
    summary: "先看配送时间和评价,再按你的口味备注。点外卖也尽量让它贴合画像,不只是随手点。",
    keywordChips,
    searchText: formatKeywords(keywordChips),
    shoppingList: [],
    noteChips,
    actions: [
      {
        platform: "meituan",
        label: "去美团搜外卖",
        helper: "适合直接下单,优先看配送时间和近期评价。",
        url: buildSearchUrl("meituan", keywordChips)
      },
      {
        platform: "dianping",
        label: "看附近口碑",
        helper: "适合先筛附近店铺,再回到外卖平台下单。",
        url: buildSearchUrl("dianping", ["附近", ...keywordChips])
      }
    ],
    checklist: [
      "备注少油少盐,避开过敏和不喜欢的食材",
      "优先选 30-45 分钟内可送达的店",
      budgetChecklist(profile)
    ]
  };
}

function buildDineOutPlan(card, profile) {
  const keywordChips = uniqueClean([
    ...(card.searchKeywords ?? []),
    ...profileSearchKeywords(profile, { includeBudget: true }),
    "附近",
    "不排队"
  ]);
  const noteChips = buildProfileNotes(profile);

  return {
    title: "出去吃执行方案",
    primaryPlatform: "dianping",
    summary: "先看附近口碑和排队情况,再决定是不是值得出门。预算高一点时可以优先选环境稳定的店。",
    keywordChips,
    searchText: formatKeywords(keywordChips),
    shoppingList: [],
    noteChips,
    actions: [
      {
        platform: "dianping",
        label: "去点评看附近",
        helper: "适合看环境、差评和排队情况。",
        url: buildSearchUrl("dianping", keywordChips)
      },
      {
        platform: "meituan",
        label: "看团购和套餐",
        helper: "适合出门前看看套餐价和可用时段。",
        url: buildSearchUrl("meituan", keywordChips)
      }
    ],
    checklist: [
      "优先看距离、排队时长、人均和最近差评",
      "到店前确认营业时间和是否需要预约",
      budgetChecklist(profile)
    ]
  };
}

function fallbackFoodKeywords(card) {
  return uniqueClean([card.title, ...(card.searchKeywords ?? [])]).slice(0, 5);
}

function restrictionText(profile) {
  const values = uniqueClean([...(profile.allergies ?? []), ...(profile.dislikes ?? [])]);
  if (!values.length) return "下锅前确认没有临时忌口";
  return `避开: ${values.slice(0, 5).join("、")}`;
}

function profileSearchKeywords(profile, options = {}) {
  const tasteKeywords = (profile.tasteTags ?? []).filter((tag) => tag !== "都行");
  const cuisineKeywords = (profile.cuisinePreferences ?? []).slice(0, 2);
  const spicyKeyword = spicySearchKeyword(profile.spicyLevel);
  const budgetKeyword = options.includeBudget ? budgetSearchKeyword(profile.budgetPerPerson) : "";

  return uniqueClean([
    ...tasteKeywords,
    ...cuisineKeywords,
    spicyKeyword,
    budgetKeyword
  ]);
}

function buildProfileNotes(profile) {
  const dislikeNotes = safeList(profile.dislikes)
    .filter((item) => item !== "其他")
    .map((item) => `不要${item}`);
  const allergyNotes = safeList(profile.allergies)
    .filter((item) => item !== "其他")
    .map((item) => `避开${item}`);
  const tasteNotes = tasteNoteChips(profile);
  const budgetNote = budgetLabel(profile.budgetPerPerson);

  return uniqueClean([
    ...dislikeNotes,
    ...allergyNotes,
    ...tasteNotes,
    budgetNote && `预算 ${budgetNote}/人`
  ]);
}

function tasteNoteChips(profile) {
  const notes = [];
  const tags = safeList(profile.tasteTags);
  if (tags.includes("少油")) notes.push("少油");
  if (tags.includes("清淡")) notes.push("少盐");

  const spicyNote = {
    none: "不要辣",
    mild: "微辣即可",
    medium: "中辣",
    hot: "重辣"
  }[profile.spicyLevel];
  if (spicyNote) notes.push(spicyNote);
  return notes;
}

function spicySearchKeyword(value) {
  return {
    none: "不辣",
    mild: "微辣",
    medium: "中辣",
    hot: "重辣"
  }[value] ?? "";
}

function budgetSearchKeyword(value) {
  return {
    under_15: "人均15以下",
    "15_30": "人均15-30",
    "30_60": "人均30-60",
    "60_plus": "人均60以上"
  }[value] ?? "";
}

function budgetChecklist(profile) {
  const budget = profile.budgetPerPerson;
  if (!budget) return "人均价格和今晚预算基本一致";
  const label = budgetLabel(budget);
  if (!label) return "人均价格和今晚预算基本一致";
  return `人均价格贴近预算: ${label}`;
}

function shouldRecoverBudget(profile = {}, context = {}, currentCard = {}) {
  const budget = budgetBounds(profile.budgetPerPerson);
  if (!budget || budget.max === Infinity) return false;
  const costs = (context.recentMeals ?? [])
    .filter((meal) => meal.id !== currentCard.id)
    .map((meal) => numberFrom(meal.estimatedCostPerPerson))
    .filter(Boolean);
  if (costs.length < 2) return false;
  const averageCost = costs.reduce((sum, value) => sum + value, 0) / costs.length;
  return averageCost > budget.max;
}

function budgetRecoverySubstitutions(card) {
  const names = (card.ingredients ?? []).map((item) => String(item.name ?? ""));
  const substitutions = [];
  if (names.some((name) => name.includes("虾仁"))) {
    substitutions.push("可替代: 鸡蛋/鸡胸肉替代部分虾仁");
  }
  if (names.some((name) => name.includes("牛腩") || name.includes("牛肉"))) {
    substitutions.push("可替代: 鸡腿肉/鸡胸肉替代部分牛肉");
  }
  if (!substitutions.length && names.some((name) => name.includes("肉") || name.includes("鱼"))) {
    substitutions.push("可替代: 鸡蛋/豆腐补足蛋白质");
  }
  return substitutions;
}

function buildReadinessSummary(card, shoppingList = [], shoppingGroups = []) {
  const missingCount = shoppingList.length;
  const groupCount = shoppingGroups.length;
  const hasMissing = missingCount > 0;

  return {
    status: hasMissing ? "need_grocery" : "ready_to_cook",
    title: hasMissing ? `还缺 ${missingCount} 样食材` : "食材已确认齐了",
    helper: hasMissing ? "先补齐采购清单,再按备菜顺序开做。" : "可以直接开火,按备菜顺序推进。",
    metrics: [
      {
        label: "采购",
        value: hasMissing ? `${missingCount} 样 / ${groupCount || 1} 类` : "无需补货"
      },
      { label: "时间", value: card.timeText ?? (card.estimatedMinutes ? `${card.estimatedMinutes}分钟` : "看步骤安排") },
      { label: "预算", value: card.costText ?? "按实际采购" }
    ]
  };
}

function shoppingEntriesFromCard(card, profile = {}, options = {}) {
  const sourceIngredients = card.ingredients ?? [];
  const ownedNames = ingredientNameSet(options.ownedIngredientNames);
  return scaleIngredientsForPeople(sourceIngredients, profile.peopleCount)
    .filter((item) => !ownedNames.has(normalizeIngredientName(item.name)))
    .map((item) => ({
      group: String(item.group ?? "食材").trim() || "食材",
      text: formatIngredientLine(item)
    }))
    .filter((item) => item.text);
}

function formatIngredientLine(item) {
  const name = String(item.name ?? "").trim();
  const amount = String(item.amount ?? "").trim();
  return [name, amount].filter(Boolean).join(" ");
}

function groupShoppingEntries(entries = []) {
  const groupOrder = [];
  const groupItems = new Map();

  for (const entry of entries) {
    const label = String(entry.group ?? "食材").trim() || "食材";
    if (!groupItems.has(label)) {
      groupOrder.push(label);
      groupItems.set(label, []);
    }
    groupItems.get(label).push(entry.text);
  }

  return groupOrder
    .map((label) => ({
      label,
      items: aggregateShoppingItems(groupItems.get(label))
    }))
    .filter((group) => group.items.length);
}

function appendSubstitutionGroup(groups = [], substitutions = []) {
  const items = uniqueClean(substitutions);
  if (!items.length) return groups;
  return [...groups, { label: "替代建议", items }];
}

function ingredientNameSet(values = []) {
  return new Set(safeList(values).map(normalizeIngredientName).filter(Boolean));
}

function normalizeIngredientName(value) {
  return String(value ?? "").trim();
}

function aggregateShoppingItems(items = []) {
  const order = [];
  const groups = new Map();
  const passthrough = [];

  for (const item of items) {
    const parsed = parseShoppingItem(item);
    if (!parsed) {
      passthrough.push(item);
      continue;
    }

    const key = `${parsed.name}::${parsed.unit}`;
    if (!groups.has(key)) {
      order.push(key);
      groups.set(key, parsed);
      continue;
    }

    groups.get(key).amount += parsed.amount;
  }

  return uniqueClean([
    ...order.map((key) => formatShoppingItem(groups.get(key))),
    ...passthrough
  ]);
}

function parseShoppingItem(item) {
  const text = String(item ?? "").trim();
  const match = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)(\D+)$/);
  if (!match) return null;

  const [, name, rawAmount, unit] = match;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount)) return null;

  return {
    name: name.trim(),
    amount,
    unit: unit.trim()
  };
}

function formatShoppingItem(item) {
  return `${item.name} ${formatAmount(item.amount)}${item.unit}`;
}

function formatAmount(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10).replace(/\.0$/, "");
}


function budgetBounds(value) {
  return {
    under_15: { max: 15 },
    "15_30": { max: 30 },
    "30_60": { max: 60 },
    "60_plus": { max: Infinity }
  }[value];
}

function numberFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function budgetLabel(value) {
  return {
    under_15: "¥15 以下",
    "15_30": "¥15-30",
    "30_60": "¥30-60",
    "60_plus": "¥60+"
  }[value];
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
