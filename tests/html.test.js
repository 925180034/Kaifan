import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { escapeHtml } from "../src/html.js";

test("escapeHtml escapes markup-sensitive characters for template rendering", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')">&`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;"
  );
});

test("escapeHtml treats nullish values as empty text", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("app shell does not depend on Google Fonts", () => {
  const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.doesNotMatch(indexSource, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(stylesSource, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(indexSource, />7月6日 周一 · 小雨 18°C</);
});

test("app shell loads the legacy PWA upgrade bridge before the main app", () => {
  const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(indexSource, /<script type="module" src="\.\/src\/upgradeBridge\.js"><\/script>/);
  assert.ok(indexSource.indexOf("./src/upgradeBridge.js") < indexSource.indexOf("./src/app.js"));
});
