import { buildSearchUrl, formatKeywords } from "./platformLinks.js";

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

export function buildActionPlan(card, profile = {}) {
  if (card.type === "takeout") {
    return buildTakeoutPlan(card, profile);
  }

  if (card.type === "dine_out") {
    return buildDineOutPlan(card, profile);
  }

  return buildCookPlan(card, profile);
}

export function platformLabel(platform) {
  return platformLabels[platform] ?? platform;
}

function buildCookPlan(card, profile) {
  const keywordChips = buildIngredientKeywords(card);
  const peopleText = profile.peopleCount ? `${profile.peopleCount} 人份` : "当前人数";
  const restrictions = restrictionText(profile);

  return {
    title: "自己做执行方案",
    primaryPlatform: "xiaoxiang",
    summary: "先确认家里已有食材,缺的主材直接去超市搜索。要是临时不想做,也给你留了同类外卖入口。",
    keywordChips,
    searchText: formatKeywords(keywordChips),
    actions: [
      {
        platform: "xiaoxiang",
        label: "去小象搜食材",
        helper: "优先搜主材,下单前看规格和送达时间。",
        url: buildSearchUrl("xiaoxiang", keywordChips)
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
      "先用家里已有食材,只补缺口最大的 2-4 样",
      restrictions
    ]
  };
}

function buildTakeoutPlan(card, profile) {
  const keywordChips = uniqueClean([
    ...(card.searchKeywords ?? []),
    "少油",
    "高评分"
  ]);

  return {
    title: "点外卖执行方案",
    primaryPlatform: "meituan",
    summary: "先看配送时间和评价,再按你的口味备注。点外卖也尽量让它贴合画像,不只是随手点。",
    keywordChips,
    searchText: formatKeywords(keywordChips),
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
    "附近",
    "不排队"
  ]);

  return {
    title: "出去吃执行方案",
    primaryPlatform: "dianping",
    summary: "先看附近口碑和排队情况,再决定是不是值得出门。预算高一点时可以优先选环境稳定的店。",
    keywordChips,
    searchText: formatKeywords(keywordChips),
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

function budgetChecklist(profile) {
  const budget = profile.budgetPerPerson;
  if (!budget) return "人均价格和今晚预算基本一致";
  const label = budgetLabel(budget);
  if (!label) return "人均价格和今晚预算基本一致";
  return `人均价格贴近预算: ${label}`;
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
