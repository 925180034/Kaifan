import test from "node:test";
import assert from "node:assert/strict";

import {
  scaleIngredientAmount,
  scaleIngredientsForPeople,
  servingLabel
} from "../src/servings.js";

test("scales gram amounts from a two-person base", () => {
  assert.equal(scaleIngredientAmount("200g", "1"), "100g");
  assert.equal(scaleIngredientAmount("200g", "3"), "300g");
  assert.equal(scaleIngredientAmount("500g", "4"), "1000g");
});

test("scales Chinese count units from a two-person base", () => {
  assert.equal(scaleIngredientAmount("2个", "1"), "1个");
  assert.equal(scaleIngredientAmount("1盒", "1"), "0.5盒");
  assert.equal(scaleIngredientAmount("1根", "3"), "1.5根");
  assert.equal(scaleIngredientAmount("2碗", "4"), "4碗");
});

test("keeps vague or invalid amounts unchanged", () => {
  assert.equal(scaleIngredientAmount("少量", "4"), "少量");
  assert.equal(scaleIngredientAmount("", "4"), "");
  assert.equal(scaleIngredientAmount("2个", "2"), "2个");
  assert.equal(scaleIngredientAmount("2个", "unknown"), "2个");
});

test("scales ingredient objects without mutating originals", () => {
  const ingredients = [
    { name: "虾仁", amount: "200g", group: "肉蛋奶" },
    { name: "嫩豆腐", amount: "1盒", group: "主食豆制品" },
    { name: "葱姜蒜", amount: "少量", group: "调料干货" }
  ];

  const scaled = scaleIngredientsForPeople(ingredients, "3");

  assert.deepEqual(
    scaled.map((item) => [item.name, item.amount]),
    [
      ["虾仁", "300g"],
      ["嫩豆腐", "1.5盒"],
      ["葱姜蒜", "少量"]
    ]
  );
  assert.equal(ingredients[0].amount, "200g");
  assert.notEqual(scaled[0], ingredients[0]);
});

test("builds a serving label from profile people count", () => {
  assert.equal(servingLabel({ peopleCount: "1" }), "1 人份");
  assert.equal(servingLabel({ peopleCount: "4" }), "4 人份");
  assert.equal(servingLabel({}), "当前人数");
}
);
