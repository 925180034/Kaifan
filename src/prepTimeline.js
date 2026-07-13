export function buildPrepTimeline(card) {
  const totalMinutes = Math.max(10, numberFrom(card?.estimatedMinutes) || numberFrom(card?.timeText) || 20);
  const ingredients = Array.isArray(card?.ingredients) ? card.ingredients : [];
  const steps = Array.isArray(card?.steps) ? card.steps : [];
  const produce = ingredientNames(ingredients, ["蔬菜", "水果", "主食", "豆制品", "调料"]);
  const proteins = ingredientNames(ingredients, ["肉", "蛋", "奶", "海鲜"]);

  if (!produce.length && !proteins.length) {
    return {
      totalMinutes,
      items: [
        {
          timeText: "0-5 分钟",
          title: "先准备",
          detail: steps.slice(0, 2).join("; ") || "先把食材、锅具和调味品放到手边。"
        },
        {
          timeText: `5-${totalMinutes} 分钟`,
          title: "开火完成",
          detail: steps.slice(2).join("; ") || "按步骤完成烹饪,出锅前再调味。"
        }
      ]
    };
  }

  return {
    totalMinutes,
    items: [
      {
        timeText: "0-5 分钟",
        title: "先处理蔬菜和配菜",
        detail: produce.length
          ? `清洗切好 ${produce.slice(0, 5).join("、")},调料放到手边。`
          : "先把配菜、主食和调味品放到手边。"
      },
      {
        timeText: "5-10 分钟",
        title: "处理蛋白质",
        detail: proteins.length
          ? `处理 ${proteins.slice(0, 4).join("、")},需要腌制的先抓匀。`
          : "把主食材处理好,需要沥水的先沥干。"
      },
      {
        timeText: `10-${totalMinutes} 分钟`,
        title: "开火完成",
        detail: steps.slice(0, 3).join("; ") || "按菜谱步骤下锅,出锅前尝味道。"
      }
    ]
  };
}

function ingredientNames(ingredients, groupKeywords) {
  return uniqueClean(
    ingredients
      .filter((item) => groupKeywords.some((keyword) => String(item.group ?? "").includes(keyword)))
      .map((item) => item.name)
  );
}

function numberFrom(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
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
