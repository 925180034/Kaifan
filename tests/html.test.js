import test from "node:test";
import assert from "node:assert/strict";

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
