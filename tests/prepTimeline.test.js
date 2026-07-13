import test from "node:test";
import assert from "node:assert/strict";

import { buildPrepTimeline } from "../src/prepTimeline.js";
import { recipeOptions } from "../src/sampleData.js";

test("buildPrepTimeline creates a three-stage cooking timeline", () => {
  const timeline = buildPrepTimeline(recipeOptions[0]);

  assert.equal(timeline.totalMinutes, 25);
  assert.deepEqual(
    timeline.items.map((item) => item.title),
    ["先处理蔬菜和配菜", "处理蛋白质", "开火完成"]
  );
  assert.equal(timeline.items[0].timeText, "0-5 分钟");
  assert.match(timeline.items[0].detail, /番茄/);
  assert.match(timeline.items[0].detail, /黄瓜/);
  assert.match(timeline.items[1].detail, /虾仁/);
  assert.equal(timeline.items[2].timeText, "10-25 分钟");
});

test("buildPrepTimeline falls back to recipe steps when ingredients are sparse", () => {
  const timeline = buildPrepTimeline({
    estimatedMinutes: 12,
    ingredients: [],
    steps: ["水开下面", "加青菜", "调味出锅"]
  });

  assert.equal(timeline.totalMinutes, 12);
  assert.equal(timeline.items.length, 2);
  assert.equal(timeline.items[0].title, "先准备");
  assert.match(timeline.items[0].detail, /水开下面/);
  assert.equal(timeline.items[1].timeText, "5-12 分钟");
});
