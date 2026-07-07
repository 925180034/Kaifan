const platformPrefixes = {
  meituan: "",
  dianping: "",
  xiaoxiang: "小象超市 "
};

export function formatKeywords(keywords) {
  return keywords
    .map((keyword) => String(keyword).trim())
    .filter(Boolean)
    .join(" ");
}

export function buildSearchUrl(platform, keywords) {
  const query = `${platformPrefixes[platform] ?? ""}${formatKeywords(keywords)}`.trim();
  const encoded = encodeURIComponent(query);

  if (platform === "meituan") {
    return `https://www.meituan.com/s/?w=${encoded}`;
  }

  if (platform === "dianping") {
    return `https://www.dianping.com/search/keyword/1/0_${encoded}`;
  }

  return `https://www.baidu.com/s?wd=${encoded}`;
}
