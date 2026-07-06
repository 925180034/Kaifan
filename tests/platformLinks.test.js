import test from "node:test";
import assert from "node:assert/strict";

import { buildSearchUrl, formatKeywords } from "../src/platformLinks.js";

test("formats search keywords with single spaces", () => {
  assert.equal(formatKeywords(["热汤面", "少油", "高评分"]), "热汤面 少油 高评分");
});

test("builds a Meituan search URL with encoded keywords", () => {
  const url = buildSearchUrl("meituan", ["热汤面", "少油"]);

  assert.equal(url, `https://www.meituan.com/s/?w=${encodeURIComponent("热汤面 少油")}`);
});

test("builds a Xiaoxiang fallback search URL with encoded ingredient keywords", () => {
  const url = buildSearchUrl("xiaoxiang", ["番茄", "虾仁"]);

  assert.equal(url, `https://www.google.com/search?q=${encodeURIComponent("小象超市 番茄 虾仁")}`);
});
