import test from "node:test";
import assert from "node:assert/strict";

import { buildGenerationStatus } from "../src/generationStatus.js";

test("buildGenerationStatus explains provider fallback in user-facing copy", () => {
  assert.deepEqual(
    buildGenerationStatus({ generationSource: "fallback", fallbackReason: "llm_provider_error", apiAvailable: true }),
    { text: "AI 暂时不可用,已切换为本地方案", state: "fallback" }
  );
});

test("buildGenerationStatus explains validation fallback without raw reason codes", () => {
  const status = buildGenerationStatus({ generationSource: "fallback", fallbackReason: "llm_validation_failed" });

  assert.equal(status.text, "AI 输出不够稳定,已使用本地安全方案");
  assert.equal(status.state, "fallback");
  assert.equal(status.text.includes("llm_validation_failed"), false);
});

test("buildGenerationStatus explains cached decisions", () => {
  assert.deepEqual(buildGenerationStatus({ generationSource: "cached", apiAvailable: true }), {
    text: "已使用今日缓存方案",
    state: "ready"
  });
});

test("buildGenerationStatus preserves loading and error precedence", () => {
  assert.deepEqual(buildGenerationStatus({ isGenerating: true, generationError: "失败" }), {
    text: "正在按你的画像生成...",
    state: "loading"
  });
  assert.deepEqual(buildGenerationStatus({ generationError: "生成失败,已保留上一版" }), {
    text: "生成失败,已保留上一版",
    state: "error"
  });
});
