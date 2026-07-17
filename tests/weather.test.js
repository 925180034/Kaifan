import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWeatherContext,
  hydrateWeatherContext,
  isWeatherCacheFresh
} from "../src/weather.js";

const now = new Date("2026-07-17T19:00:00+08:00");

test("builds a rainy city weather context from Open-Meteo responses", () => {
  const context = buildWeatherContext(
    { name: "杭州", latitude: 30.27, longitude: 120.15 },
    { current: { temperature_2m: 26.4, precipitation: 1.2, weather_code: 61 } },
    now
  );

  assert.equal(context.weather.city, "杭州");
  assert.equal(context.weather.temperature, 26);
  assert.equal(context.weather.isRaining, true);
  assert.equal(context.weather.fetchedDate, "2026-07-17");
  assert.match(context.dateText, /杭州 小雨 26°C/);
});

test("reuses same-day city weather without another request", async () => {
  const current = {
    mood: "normal",
    weather: { city: "杭州", source: "open_meteo", fetchedDate: "2026-07-17", isRaining: false }
  };

  const result = await hydrateWeatherContext(current, "杭州", () => {
    throw new Error("should not fetch");
  }, now);

  assert.equal(isWeatherCacheFresh(current.weather, now), true);
  assert.equal(result.changed, false);
  assert.equal(result.context, current);
});

test("preserves the previous context when weather lookup fails", async () => {
  const current = { mood: "normal", weather: { text: "多云", temperature: 25, isRaining: false } };
  const result = await hydrateWeatherContext(current, "杭州", async () => ({ ok: false }), now);

  assert.equal(result.changed, false);
  assert.equal(result.context, current);
});
