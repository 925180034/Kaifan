const basePeopleCount = 2;
const amountPattern = /^(\d+(?:\.\d+)?)(\s*)(.*)$/;

export function scaleIngredientAmount(amount, peopleCount, basePeople = basePeopleCount) {
  const original = String(amount ?? "").trim();
  const people = positiveNumber(peopleCount);
  const base = positiveNumber(basePeople);
  if (!original || !people || !base || people === base) return original;

  const match = original.match(amountPattern);
  if (!match) return original;

  const [, rawNumber, spacer, unit] = match;
  const scaled = Number(rawNumber) * (people / base);
  return `${formatScaledNumber(scaled)}${spacer}${unit}`;
}

export function scaleIngredientsForPeople(ingredients = [], peopleCount, basePeople = basePeopleCount) {
  return (ingredients ?? []).map((item) => ({
    ...item,
    amount: scaleIngredientAmount(item.amount, peopleCount, basePeople)
  }));
}

export function servingLabel(profile = {}) {
  const people = positiveNumber(profile.peopleCount);
  return people ? `${formatScaledNumber(people)} 人份` : "当前人数";
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatScaledNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10).replace(/\.0$/, "");
}
