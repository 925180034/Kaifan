const fallbackCopy = {
  llm_provider_error: "AI 暂时不可用,已切换为本地方案",
  llm_validation_failed: "AI 输出不够稳定,已使用本地安全方案",
  llm_generation_failed: "AI 生成暂时失败,已使用本地方案",
  llm_not_configured: "AI 未配置,当前使用本地方案"
};

export function buildGenerationStatus(state = {}) {
  if (state.isGenerating) return { text: "正在按你的画像生成...", state: "loading" };
  if (state.generationError) return { text: state.generationError, state: "error" };
  if (state.generationSource === "llm") return { text: "AI 已根据画像生成", state: "ready" };
  if (state.generationSource === "fallback") {
    return {
      text: fallbackCopy[state.fallbackReason] ?? "当前为本地方案",
      state: "fallback"
    };
  }
  if (state.apiAvailable) return { text: "已根据画像生成", state: "ready" };
  return { text: "当前为本地方案", state: "fallback" };
}
