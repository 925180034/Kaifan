import {
  defaultDailyContext,
  defaultProfile,
  initialDecisionCards
} from "./sampleData.js?v=20260713-fresh-decision-cache";
import {
  applyDecisionState,
  applyMemoryState,
  applyProfileState,
  beginMemorySync,
  beginProfileSync,
  completeMemorySync,
  completeProfileSync,
  failDecisionRequest,
  shouldRetryMemorySync,
  shouldRetryProfileSync,
  finishDecisionRequest,
  hasFreshTodayDecision,
  markLocalDecisionState,
  replaceDecisionCardState,
  selectDecisionCardState,
  startDecisionRequest,
  todayDateString
} from "./appState.js?v=20260713-fresh-decision-cache";
import {
  buildBudgetAlert,
  buildDecisionTradeoffs,
  buildDailyReviewImpacts,
  buildPreferenceMatchDetails,
  buildProfileTuningActions,
  buildRankingComparisons,
  buildRecommendationBreakdown,
  buildRecommendationSignals,
  getMoodLabel,
  getTopRecommendation,
  rankDecisionCards,
  refreshCard
} from "./decisionEngine.js?v=20260713-fresh-decision-cache";
import { buildSearchUrl } from "./platformLinks.js?v=20260713-fresh-decision-cache";
import {
  applyProfilePreset,
  applyProfileTuningAction,
  buildProfileSummary,
  profilePresets
} from "./profile.js?v=20260713-fresh-decision-cache";
import {
  buildDailyReview,
  buildFeedbackProfileSuggestion,
  buildGenerationContext,
  buildLearningSummary,
  buildNextMealPlan,
  buildQuickFeedbackPrompt,
  recordCompletedMeal,
  recordMealFeedback,
  recordFeedbackLearning,
  recordSelectedMeal
} from "./learning.js?v=20260713-fresh-decision-cache";
import { buildHistorySummary } from "./history.js?v=20260713-fresh-decision-cache";
import { clearState, loadState, saveState } from "./storage.js?v=20260713-fresh-decision-cache";
import { createLatestSync, createMemorySync } from "./memorySync.js?v=20260713-fresh-decision-cache";
import {
  buildActionPlan,
  buildAggregatedShoppingGroups,
  buildAggregatedShoppingList,
  buildShoppingList,
  platformLabel
} from "./actionPlan.js?v=20260713-fresh-decision-cache";
import {
  favoriteHasRecipeDetails,
  findRecipeCard,
  hydrateFavoriteRecipeDetails,
  isFavoriteMeal,
  toggleFavoriteMeal
} from "./favorites.js?v=20260713-fresh-decision-cache";
import { buildPrepTimeline } from "./prepTimeline.js?v=20260713-fresh-decision-cache";
import { registerServiceWorker } from "./pwa.js?v=20260713-fresh-decision-cache";
import { escapeHtml } from "./html.js?v=20260713-fresh-decision-cache";
import { buildGenerationStatus } from "./generationStatus.js?v=20260713-fresh-decision-cache";
import { scaleIngredientsForPeople, servingLabel } from "./servings.js?v=20260713-fresh-decision-cache";
import {
  fetchMemory,
  fetchProfile,
  fetchTodayDecision,
  isRecoverableApiFailure,
  refreshDecisionCard,
  saveMemory,
  saveProfile,
  selectDecisionCard,
  submitFeedback,
  trackEvent
} from "./apiClient.js?v=20260713-fresh-decision-cache";

const stateKey = "kaifan.mvp.state";

const feedbackOptions = ["好吃,下次还吃", "太贵", "太麻烦", "没吃饱", "不够满足", "太油/太咸", "不合口味"];
const memorySync = createMemorySync(saveMemory);
const profileSync = createLatestSync(saveProfile);

const requiredProfileFields = [
  "peopleCount",
  "spicyLevel",
  "budgetPerPerson",
  "cookingWillingness"
];

const profileOptions = {
  peopleCount: [
    { label: "1 人", value: "1", big: "1", small: "人" },
    { label: "2 人", value: "2", big: "2", small: "人" },
    { label: "3-4 人", value: "3-4", big: "3-4", small: "人" },
    { label: "5 人以上", value: "5+", big: "5", small: "人以上" }
  ],
  taboos: ["香菜", "内脏", "海鲜过敏", "花生过敏", "乳糖不耐", "不吃牛羊", "其他"],
  spicyLevel: [
    { label: "不吃辣", value: "none" },
    { label: "微辣", value: "mild" },
    { label: "中辣", value: "medium" },
    { label: "重辣", value: "hot" }
  ],
  budgetPerPerson: [
    { label: "¥15 以下", value: "under_15", small: "每人每餐" },
    { label: "¥15-30", value: "15_30", small: "每人每餐" },
    { label: "¥30-60", value: "30_60", small: "每人每餐" },
    { label: "¥60+", value: "60_plus", small: "每人每餐" }
  ],
  cookingWillingness: [
    { label: "不想做", value: "avoid", desc: "最好直接告诉我点什么" },
    { label: "偶尔简单做", value: "low", desc: "偶尔来个 15 分钟内的" },
    { label: "常做家常菜", value: "normal", desc: "一日三餐不在话下" },
    { label: "爱折腾", value: "high", desc: "周末愿意研究新菜" }
  ],
  tasteTags: ["清淡", "家常", "少油", "微辣", "重口", "都行"],
  favoriteIngredients: ["虾仁", "豆腐", "番茄", "鸡蛋", "牛肉", "青菜", "土豆", "鸡胸肉"],
  cuisinePreferences: ["家常", "川湘", "江浙", "粤菜", "日式", "轻食"],
  nutritionGoal: ["均衡", "高蛋白控油", "低脂", "增肌", "少盐", "饱腹"]
};

const settingsDefinitions = {
  peopleCount: { label: "用餐人数", group: "基础偏好", type: "single", options: profileOptions.peopleCount },
  taboos: { label: "忌口与过敏", group: "基础偏好", type: "multi", options: profileOptions.taboos, none: "没有忌口" },
  spicyLevel: { label: "辣度", group: "基础偏好", type: "single", options: profileOptions.spicyLevel },
  tasteTags: { label: "口味偏好", group: "基础偏好", type: "multi", options: profileOptions.tasteTags },
  budgetPerPerson: { label: "每人预算", group: "基础偏好", type: "single", options: profileOptions.budgetPerPerson },
  cookingWillingness: { label: "做饭意愿", group: "基础偏好", type: "single", options: profileOptions.cookingWillingness },
  nutritionGoal: { label: "营养目标", group: "营养与喜好", type: "single", options: profileOptions.nutritionGoal },
  favoriteIngredients: { label: "爱吃食材", group: "营养与喜好", type: "multi", options: profileOptions.favoriteIngredients },
  cuisinePreferences: { label: "常用菜系", group: "营养与喜好", type: "multi", options: profileOptions.cuisinePreferences }
};

const accentColors = {
  green: "#3E7C4F",
  amber: "#C97B1F",
  blue: "#3D6B8E"
};

const tagBackgrounds = {
  cook: "#E8F0EA",
  takeout: "#F5EADA",
  dine_out: "#E4EBF1"
};

const state = loadState(stateKey, {
  userId: null,
  decisionId: null,
  profile: defaultProfile,
  context: defaultDailyContext,
  cards: cloneCards(initialDecisionCards),
  selectedCardId: null,
  selectedActionContext: null,
  selectedRecipeId: null,
  selectedRecipeSource: "current",
  view: "today",
  profileCompleted: false,
  profileSyncPending: false,
  memorySyncPending: false,
  onboardingStep: 0,
  draftProfile: null,
  settingsPicker: null,
  clearDataArmed: false,
  checkedIngredients: {},
  doneSteps: {},
  feedback: [],
  recentMeals: [],
  favoriteMeals: [],
  feedbackLearning: null,
  apiAvailable: false,
  generationSource: "",
  fallbackReason: "",
  isGenerating: false,
  generationError: "",
  requestSequence: 0,
  activeRequestId: 0
});

if (!state.userId) {
  state.userId = "local-user";
}

state.context = { ...defaultDailyContext, ...(state.context ?? {}) };
state.context.date ??= todayDateString();
state.view ??= "today";
state.profileCompleted = Boolean(state.profileCompleted);
state.profileSyncPending = Boolean(state.profileSyncPending);
state.memorySyncPending = Boolean(state.memorySyncPending);
state.onboardingStep ??= 0;
state.draftProfile ??= null;
state.settingsPicker ??= null;
state.clearDataArmed ??= false;
state.checkedIngredients ??= {};
state.doneSteps ??= {};
state.recentMeals ??= [];
state.feedback ??= [];
state.feedbackLearning ??= null;
state.favoriteMeals ??= [];
state.selectedActionContext ??= null;
state.selectedRecipeId ??= null;
state.selectedRecipeSource ??= "current";
hydrateFavoriteRecipeDetails(state, state.cards);
state.generationSource ??= "";
state.fallbackReason ??= "";
state.isGenerating = Boolean(state.isGenerating);
state.generationError ??= "";

const elements = {
  todayScreen: document.querySelector("#todayScreen"),
  onboardingScreen: document.querySelector("#onboardingScreen"),
  settingsScreen: document.querySelector("#settingsScreen"),
  recipeScreen: document.querySelector("#recipeScreen"),
  profileSummary: document.querySelector("#profileSummary"),
  dateText: document.querySelector("#dateText"),
  moodButtons: [...document.querySelectorAll("[data-mood]")],
  topRecommendation: document.querySelector("#topRecommendation"),
  decisionList: document.querySelector("#decisionList"),
  regenerateButton: document.querySelector("#regenerateButton"),
  refreshAllButton: document.querySelector("#refreshAllButton"),
  generationStatus: document.querySelector("#generationStatus"),
  recoveryPanel: document.querySelector("#recoveryPanel"),
  dailyReview: document.querySelector("#dailyReview"),
  nextMealPlan: document.querySelector("#nextMealPlan"),
  quickFeedbackPanel: document.querySelector("#quickFeedbackPanel"),
  learningSummary: document.querySelector("#learningSummary"),
  actionSheet: document.querySelector("#actionSheet"),
  actionContent: document.querySelector("#actionContent"),
  feedbackSheet: document.querySelector("#feedbackSheet"),
  feedbackTags: document.querySelector("#feedbackTags"),
  historyButton: document.querySelector("#historyButton"),
  historySheet: document.querySelector("#historySheet"),
  historyContent: document.querySelector("#historyContent"),
  settingsButton: document.querySelector("#settingsButton"),
  toast: document.querySelector("#toast")
};

function cloneCards(cards) {
  return cards.map((card) => ({
    ...card,
    ingredients: card.ingredients?.map((item) => ({ ...item })) ?? [],
    steps: [...(card.steps ?? [])],
    searchKeywords: [...(card.searchKeywords ?? [])],
    nutritionSummary: { ...(card.nutritionSummary ?? {}) },
    primaryAction: { ...card.primaryAction }
  }));
}

function persist() {
  saveState(stateKey, state);
}

function track(event, payload = {}) {
  trackEvent({
    userId: state.userId,
    event,
    payload,
    createdAt: new Date().toISOString()
  }).catch(() => {});
}

function applyDecision(decision) {
  applyDecisionState(state, decision, cloneCards);
  if (hydrateFavoriteRecipeDetails(state, state.cards)) {
    syncMemory();
  }
}

async function initializeFromBackend() {
  await hydrateUserState();
  if (!isProfileReady()) {
    track("onboarding_started", { source: "cold_start" });
    state.view = "onboarding";
    state.draftProfile = state.draftProfile ?? createDraftProfile(state.profile);
    persist();
    render();
    return;
  }
  if (hasFreshTodayDecision(state)) {
    persist();
    render();
    return;
  }
  regenerateDecision("initial");
}

async function hydrateUserState() {
  const before = hydrationSnapshot();
  await Promise.all([hydrateProfile(), hydrateMemory()]);
  if (shouldRetryProfileSync(state)) {
    syncProfile();
  }
  if (shouldRetryMemorySync(state)) {
    syncMemory();
  }
  persist();
  if (before !== hydrationSnapshot()) {
    render();
  }
}

function hydrationSnapshot() {
  return JSON.stringify({
    profile: state.profile,
    recentMeals: state.recentMeals,
    favoriteMeals: state.favoriteMeals,
    feedbackLearning: state.feedbackLearning,
    feedback: state.feedback,
    profileSyncPending: state.profileSyncPending,
    memorySyncPending: state.memorySyncPending
  });
}

async function hydrateProfile() {
  try {
    const response = await fetchProfile(state.userId);
    applyProfileState(state, response);
  } catch {
    showToast("画像读取失败,已使用本地设置");
  }
}

async function hydrateMemory() {
  try {
    const response = await fetchMemory(state.userId);
    const memory = response.memory ?? {};
    if (hasMemory(memory)) {
      applyMemoryState(state, memory);
      if (hydrateFavoriteRecipeDetails(state, state.cards)) {
        syncMemory();
      }
      return;
    }
    if (hasMemory(state)) {
      syncMemory();
    }
  } catch {
    showToast("记录读取失败,已使用本地记录");
  }
}

async function regenerateDecision(reason = "manual") {
  const startedAt = performance.now();
  state.context.date = todayDateString();
  const requestId = startDecisionRequest(state);
  persist();
  render();

  try {
    const decision = await fetchTodayDecision({
      userId: state.userId,
      profile: state.profile,
      context: buildGenerationContext(state.context, state),
      forceRegenerate: reason !== "initial"
    });
    const applied = finishDecisionRequest(state, requestId, decision, cloneCards);
    if (!applied) return;
    persist();
    render();
    track("decision_generated", {
      reason,
      generationSource: state.generationSource || "unknown",
      fallbackReason: state.fallbackReason || "",
      cardCount: state.cards.length,
      durationMs: Math.round(performance.now() - startedAt)
    });
    if (reason !== "initial") {
      showToast("已按你的画像重新生成");
    }
  } catch {
    const failed = failDecisionRequest(state, requestId, "生成暂时失败");
    if (!failed) return;
    persist();
    render();
    track("decision_generation_failed", {
      reason,
      error: state.generationError || "生成暂时失败",
      cardCount: state.cards.length,
      durationMs: Math.round(performance.now() - startedAt)
    });
    showToast("生成暂时失败,已保留本地方案");
  }
}

function memorySnapshot() {
  return {
    recentMeals: state.recentMeals ?? [],
    favoriteMeals: state.favoriteMeals ?? [],
    feedbackLearning: state.feedbackLearning ?? null,
    feedback: state.feedback ?? []
  };
}

function hasMemory(memory) {
  return Boolean(
    memory?.recentMeals?.length ||
      memory?.favoriteMeals?.length ||
      memory?.feedback?.length ||
      memory?.feedbackLearning
  );
}

function isProfileReady() {
  return Boolean(
    state.profileCompleted &&
      state.profile &&
      requiredProfileFields.every((field) => String(state.profile[field] ?? "").trim())
  );
}

function createDraftProfile(profile) {
  const draft = {
    ...defaultProfile,
    ...(profile ?? {}),
    taboos: mergeTaboos(profile?.dislikes, profile?.allergies)
  };
  draft.tasteTags = [...(draft.tasteTags ?? [])];
  draft.favoriteIngredients = [...(draft.favoriteIngredients ?? [])];
  draft.cuisinePreferences = [...(draft.cuisinePreferences ?? [])];
  draft.allergies = [...(draft.allergies ?? [])];
  draft.dislikes = [...(draft.dislikes ?? [])];
  return draft;
}

function profileFromDraft(draft) {
  const allergyKeywords = ["过敏", "乳糖"];
  const taboos = draft.taboos ?? [];
  const allergies = taboos.filter((item) => allergyKeywords.some((keyword) => item.includes(keyword)));
  const dislikes = taboos.filter((item) => !allergies.includes(item));
  return {
    ...defaultProfile,
    ...draft,
    cookingWillingness: draft.cookingWillingness === "avoid" ? "low" : draft.cookingWillingness,
    allergies,
    dislikes,
    tasteTags: [...(draft.tasteTags ?? [])],
    favoriteIngredients: [...(draft.favoriteIngredients ?? [])],
    cuisinePreferences: [...(draft.cuisinePreferences ?? [])]
  };
}

function mergeTaboos(dislikes = [], allergies = []) {
  return uniqueValues([...(dislikes ?? []), ...(allergies ?? [])]);
}

function uniqueValues(values) {
  const seen = new Set();
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function syncMemory() {
  beginMemorySync(state);
  persist();
  memorySync(state.userId, memorySnapshot())
    .then(() => {
      completeMemorySync(state);
      persist();
    })
    .catch(() => {
      beginMemorySync(state);
      persist();
      showToast("记录已本地保存,后端稍后同步");
    });
}

function syncProfile(message = "画像已本地保存,后端稍后同步") {
  beginProfileSync(state);
  persist();
  profileSync(state.userId, state.profile)
    .then(() => {
      completeProfileSync(state);
      persist();
    })
    .catch(() => {
      beginProfileSync(state);
      persist();
      showToast(message);
    });
}

function uniqueClean(values = []) {
  const seen = new Set();
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function currentView() {
  if (!isProfileReady() && state.view === "today") return "onboarding";
  return state.view ?? "today";
}

function setView(view) {
  state.view = view;
  if (view === "onboarding") {
    state.draftProfile = state.draftProfile ?? createDraftProfile(state.profile);
  }
  persist();
  render();
}

function renderScreens() {
  const view = currentView();
  elements.todayScreen.hidden = view !== "today";
  elements.onboardingScreen.hidden = view !== "onboarding";
  elements.settingsScreen.hidden = view !== "settings";
  elements.recipeScreen.hidden = view !== "recipe";
}

function render() {
  renderScreens();
  elements.profileSummary.textContent = buildProfileSummary(state.profile);
  elements.dateText.textContent = formatTopDate(state.context.dateText);
  renderMood();
  if (state.isGenerating && !state.cards?.length) {
    renderLoadingState();
  } else {
    renderTopRecommendation();
    renderCards();
  }
  renderGenerationStatus();
  renderRecoveryPanel();
  renderDailyReview();
  renderNextMealPlan();
  renderQuickFeedbackPanel();
  renderLearningSummary();
  renderRecentSummary();
  renderOnboarding();
  renderSettingsPage();
  renderRecipePage();
}

function renderMood() {
  elements.moodButtons.forEach((button) => {
    const active = button.dataset.mood === state.context.mood;
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderOnboarding() {
  if (currentView() !== "onboarding") return;
  const draft = state.draftProfile ?? createDraftProfile(state.profile);
  const step = Number(state.onboardingStep ?? 0);
  const total = 5;
  const content = onboardingStepTemplate(step, draft);
  elements.onboardingScreen.innerHTML = `
    <header class="flow-top-bar">
      <button class="icon-button back-button" type="button" data-onboarding-back aria-label="上一题" ${step === 0 ? "disabled" : ""}>
        ${chevronLeftIcon()}
      </button>
      <div class="flow-progress" aria-label="问卷进度">
        <span style="width:${((step + 1) / total) * 100}%"></span>
      </div>
      <div class="flow-count"><strong>${step + 1}</strong>/${total}</div>
    </header>
      <div class="question-body">
      <h1>${escapeHtml(content.title)}</h1>
      <p>${escapeHtml(content.hint)}</p>
      ${content.body}
    </div>
    ${content.bottom ? `<div class="fixed-bottom-bar">${content.bottom}</div>` : ""}
  `;
}

function onboardingStepTemplate(step, draft) {
  if (step === 0) {
    return {
      title: "几个人吃？",
      hint: "按今晚一起吃饭的人数算",
      body: `
        <div class="preset-panel">
          <h2>先选一个快捷画像</h2>
          <div class="preset-grid">
            ${profilePresets
              .map(
                (preset) => `
                  <button class="preset-card ${draft.presetId === preset.id ? "is-selected" : ""}" type="button" data-profile-preset="${escapeHtml(preset.id)}">
                    <strong>${escapeHtml(preset.title)}</strong>
                    <span>${escapeHtml(preset.hint)}</span>
                  </button>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="choice-grid two-col">
          ${profileOptions.peopleCount
            .map(
              (option) => `
                <button class="choice-card ${draft.peopleCount === option.value ? "is-selected" : ""}" type="button" data-onboarding-field="peopleCount" data-onboarding-value="${escapeHtml(option.value)}" data-auto-next="true">
                  <strong>${escapeHtml(option.big)}</strong>
                  <span>${escapeHtml(option.small)}</span>
                </button>
              `
            )
            .join("")}
        </div>
      `
    };
  }

  if (step === 1) {
    const taboos = draft.taboos ?? [];
    const noneSelected = taboos.length === 0;
    return {
      title: "有忌口或过敏吗？",
      hint: "可以多选，没有就直接选「没有忌口」",
      body: `
        <button class="choice-row strong ${noneSelected ? "is-selected" : ""}" type="button" data-onboarding-none>没有忌口</button>
        <div class="pill-choice-grid">
          ${profileOptions.taboos
            .map(
              (label) => `
                <button class="pill-choice ${taboos.includes(label) ? "is-selected" : ""}" type="button" data-onboarding-taboo="${escapeHtml(label)}">${escapeHtml(label)}</button>
              `
            )
            .join("")}
        </div>
      `,
      bottom: `<button class="primary-button" type="button" data-onboarding-next>下一步</button>`
    };
  }

  if (step === 2) {
    return {
      title: "吃辣程度？",
      hint: "按平时的习惯选就行",
      body: `
        <div class="choice-list">
          ${profileOptions.spicyLevel
            .map(
              (option, index) => `
                <button class="choice-row ${draft.spicyLevel === option.value ? "is-selected" : ""}" type="button" data-onboarding-field="spicyLevel" data-onboarding-value="${escapeHtml(option.value)}" data-auto-next="true">
                  <span>${escapeHtml(option.label)}</span>
                  <span class="pepper-row">${index === 0 ? "" : "🌶".repeat(index)}</span>
                </button>
              `
            )
            .join("")}
        </div>
      `
    };
  }

  if (step === 3) {
    return {
      title: "每人预算？",
      hint: "按每人每餐的大概花销",
      body: `
        <div class="choice-grid two-col">
          ${profileOptions.budgetPerPerson
            .map(
              (option) => `
                <button class="choice-card budget-card ${draft.budgetPerPerson === option.value ? "is-selected" : ""}" type="button" data-onboarding-field="budgetPerPerson" data-onboarding-value="${escapeHtml(option.value)}" data-auto-next="true">
                  <strong>${escapeHtml(option.label)}</strong>
                  <span>${escapeHtml(option.small)}</span>
                </button>
              `
            )
            .join("")}
        </div>
      `
    };
  }

  return {
    title: "做饭意愿？",
    hint: "选最接近你现在状态的一个",
    body: `
      <div class="choice-list">
        ${profileOptions.cookingWillingness
          .map(
            (option) => `
              <button class="choice-row tall ${draft.cookingWillingness === option.value ? "is-selected" : ""}" type="button" data-onboarding-field="cookingWillingness" data-onboarding-value="${escapeHtml(option.value)}">
                <span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.desc)}</small></span>
                ${draft.cookingWillingness === option.value ? checkCircleIcon() : ""}
              </button>
            `
          )
          .join("")}
      </div>
    `,
    bottom: `<button class="primary-button" type="button" data-onboarding-finish ${draft.cookingWillingness ? "" : "disabled"}>生成今晚方案</button>`
  };
}

function renderTopRecommendation() {
  const top = getTopRecommendation(state.cards, recommendationContext());
  const typeLabel = cardTypeLabel(top.type);
  const signals = buildRecommendationSignals(top, state.profile, recommendationContext());
  const preferenceDetails = buildPreferenceMatchDetails(top, state.profile);
  const scoreBreakdown = buildRecommendationBreakdown(top, recommendationContext());
  const tuningActions = buildProfileTuningActions(top, state.profile, recommendationContext());
  const tradeoffs = buildDecisionTradeoffs(top, state.profile);
  elements.topRecommendation.className = "top-panel";
  elements.topRecommendation.innerHTML = `
    <div class="hero-label">
      ${clocheIcon()}
      <span>今晚最推荐 · ${escapeHtml(typeLabel)}</span>
    </div>
    ${state.isGenerating ? updatingBadgeTemplate() : ""}
    <div class="hero-title">${escapeHtml(top.title)}</div>
    ${signalRow(signals)}
    ${preferenceDetailRow(preferenceDetails)}
    ${scoreBreakdownRow(scoreBreakdown)}
    ${profileTuningRow(tuningActions)}
    ${tradeoffGrid(tradeoffs)}
    <p class="hero-reason">${escapeHtml(top.reason)}</p>
    <button class="primary-button" type="button" data-primary="${escapeHtml(top.id)}">别问了，就这个</button>
  `;
}

function updatingBadgeTemplate() {
  return `
    <div class="updating-badge" role="status">
      <span></span>
      正在更新今日方案...
    </div>
  `;
}

function renderCards() {
  const ranked = rankDecisionCards(state.cards, recommendationContext());
  const comparisonById = Object.fromEntries(
    buildRankingComparisons(state.cards, recommendationContext()).map((comparison) => [comparison.cardId, comparison])
  );
  elements.decisionList.innerHTML = ranked.map((card) => cardTemplate(card, comparisonById[card.id])).join("");
}

function cardTemplate(card, rankingComparison) {
  const typeLabel = cardTypeLabel(card.type);
  const accent = accentColors[card.accent] ?? accentColors.green;
  const selected = state.selectedCardId === card.id;
  const dimmed = state.selectedCardId && !selected;
  const secondaryAction = card.type === "takeout" ? "copy-card-keywords" : "refresh";
  const secondaryLabel = card.type === "takeout" ? "复制关键词" : "换这个";
  const signals = buildRecommendationSignals(card, state.profile, recommendationContext());
  const preferenceDetails = buildPreferenceMatchDetails(card, state.profile);
  const scoreBreakdown = buildRecommendationBreakdown(card, recommendationContext());
  const tradeoffs = buildDecisionTradeoffs(card, state.profile);
  const budgetAlert = buildBudgetAlert(card, state.profile, state.cards);
  const actionContext = selected ? selectedActionContextFor(card.id) : null;

  return `
    <article class="decision-card ${dimmed ? "is-dimmed" : ""}" data-card-id="${escapeHtml(card.id)}" style="--card-accent:${accent}; --tag-bg:${tagBackgrounds[card.type] ?? tagBackgrounds.cook}; --card-border:${selected ? accent : "#EBE6DC"}">
      <div class="card-head">
        <span class="type-tag">${escapeHtml(typeLabel)}</span>
        ${selected ? selectedTemplate(accent) : ""}
      </div>
      <div class="card-body">
        ${rankingComparisonTemplate(rankingComparison)}
        <div class="card-title">${escapeHtml(card.title)}</div>
        ${selectedActionContextTemplate(actionContext)}
        <div class="metric-pills">
          ${cardPills(card).map((pill) => `<span class="metric-pill">${escapeHtml(pill)}</span>`).join("")}
        </div>
        ${signalRow(signals)}
        ${preferenceDetailRow(preferenceDetails)}
        ${scoreBreakdownRow(scoreBreakdown)}
        ${budgetAlertTemplate(budgetAlert)}
        ${tradeoffGrid(tradeoffs)}
        <p class="card-reason">${escapeHtml(card.reason || card.subtitle || "")}</p>
        <div class="card-actions">
          <button class="card-button" type="button" data-action="${escapeHtml(card.primaryAction.action)}" data-card-id="${escapeHtml(card.id)}">${escapeHtml(primaryLabel(card))}</button>
          <button class="ghost-button" type="button" ${secondaryAction === "refresh" ? `data-refresh="${escapeHtml(card.type)}"` : `data-copy-card-keywords="${escapeHtml(card.id)}"`} data-card-id="${escapeHtml(card.id)}">${escapeHtml(secondaryLabel)}</button>
        </div>
      </div>
    </article>
  `;
}

function selectedActionContextFor(cardId) {
  const context = state.selectedActionContext;
  return context?.cardId === cardId ? context : null;
}

function selectedActionContextTemplate(context) {
  if (!context) return "";
  return `
    <div class="selected-action-context" aria-label="选择来源">
      <strong>来自下一餐建议 · ${escapeHtml(context.label || "已选择")}</strong>
      ${context.reasons?.length ? `<span>${context.reasons.map((reason) => `<b>${escapeHtml(reason)}</b>`).join("")}</span>` : ""}
    </div>
  `;
}

function budgetAlertTemplate(alert) {
  if (!alert) return "";
  return `
    <div class="budget-alert" aria-label="预算预警">
      <strong>${escapeHtml(alert.title)}</strong>
      <span>${escapeHtml(alert.detail)}</span>
      <div class="budget-alert-tags">
        ${alert.alternatives.map((item) => `<b>${escapeHtml(item)}</b>`).join("")}
      </div>
      ${budgetSwapSuggestion(alert.swapSuggestion)}
      ${budgetActionLinks(alert.actions)}
    </div>
  `;
}

function budgetSwapSuggestion(suggestion) {
  if (!suggestion) return "";
  return `
    <button class="budget-swap-button" type="button" data-budget-swap="${escapeHtml(suggestion.cardId)}">
      <strong>${escapeHtml(suggestion.label)}</strong>
      <span>${escapeHtml(suggestion.title)} · ${escapeHtml(suggestion.savingText)}</span>
      <small>${escapeHtml(suggestion.detail)}</small>
    </button>
  `;
}

function budgetActionLinks(actions = []) {
  if (!actions.length) return "";
  return `
    <div class="budget-action-row">
      ${actions
        .map((action) => {
          const url = action.type === "platform" ? buildSearchUrl(action.platform, action.keywords ?? []) : "";
          if (!url) return "";
          return `
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(action.label)}
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

function rankingComparisonTemplate(comparison) {
  if (!comparison) return "";
  return `
    <div class="ranking-comparison">
      <strong>${escapeHtml(comparison.rankLabel)}</strong>
      <span>${escapeHtml(comparison.deltaText)}</span>
      <small>${escapeHtml(comparison.reason)}</small>
    </div>
  `;
}

function tradeoffGrid(metrics) {
  return `
    <div class="tradeoff-grid" aria-label="时间预算营养复杂度">
      ${metrics
        .map(
          (metric) => `
            <div class="tradeoff-item">
              <div class="tradeoff-top">
                <span>${escapeHtml(metric.label)}</span>
                <strong>${escapeHtml(metric.text)}</strong>
              </div>
              <div class="tradeoff-track" aria-hidden="true">
                <i style="width:${Math.max(0, Math.min(100, metric.value))}%"></i>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function recommendationContext() {
  return {
    ...state.context,
    profile: state.profile,
    recentMeals: state.recentMeals,
    feedbackLearning: state.feedbackLearning
  };
}

function signalRow(signals) {
  if (!signals.length) return "";
  return `
    <div class="signal-row">
      ${signals.map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}
    </div>
  `;
}

function preferenceDetailRow(details) {
  if (!details.length) return "";
  return `
    <div class="preference-detail-row" aria-label="画像偏好命中">
      ${details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
    </div>
  `;
}

function scoreBreakdownRow(items) {
  if (!items.length) return "";
  return `
    <div class="score-breakdown-row" aria-label="推荐分数拆解">
      ${items
        .map(
          (item) => `
            <span data-direction="${escapeHtml(item.direction)}">
              <b>${escapeHtml(item.label)}</b>
              <small>${escapeHtml(item.text)}</small>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function profileTuningRow(actions) {
  if (!actions.length) return "";
  return `
    <div class="profile-tuning-row" aria-label="快速调整画像">
      <strong>想让推荐更准？</strong>
      <div>
        ${actions
          .map(
            (action) => `
              <button type="button" data-profile-tuning="${escapeHtml(action.id)}" title="${escapeHtml(action.detail)}">
                <span>${escapeHtml(action.label)}</span>
                <small>${escapeHtml(action.detail)}</small>
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function selectedTemplate(accent) {
  return `
    <span class="selected-tag" style="color:${accent}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>
      已选择
    </span>
  `;
}

function renderLoadingState() {
  elements.topRecommendation.className = "loading-block";
  elements.topRecommendation.innerHTML = `
    <div class="loading-stack">
      <div class="loading-text">正在想今晚吃什么...</div>
      <div class="skeleton" style="height:216px"></div>
    </div>
  `;
  elements.decisionList.innerHTML = [0, 1, 2]
    .map((index) => `<div class="skeleton" style="height:160px; animation-delay:${index * 0.15}s"></div>`)
    .join("");
}

function renderRecentSummary() {
  const names = (state.recentMeals ?? []).map((meal) => meal.title).filter(Boolean).slice(0, 2);
  elements.historyButton.textContent = names.length
    ? `最近吃过：${names.join(" · ")}`
    : "最近吃过：还没有记录";
}

function cardTypeLabel(type) {
  return {
    cook: "自己做",
    takeout: "点外卖",
    dine_out: "出去吃"
  }[type] ?? "今晚方案";
}

function primaryLabel(card) {
  return {
    cook: "看菜谱",
    takeout: "去美团搜",
    dine_out: "去点评搜"
  }[card.type] ?? card.primaryAction?.label ?? "查看";
}

function cardPills(card) {
  return [
    card.timeText,
    card.costText,
    card.type === "cook" ? difficultyLabel(card.difficulty) : ""
  ].filter(Boolean);
}

function difficultyLabel(value) {
  return {
    easy: "简单",
    normal: "普通",
    hard: "复杂",
    rich: "复杂"
  }[value] ?? value;
}

function formatTopDate(value) {
  const text = String(value ?? "").replace(/^今天\s*/, "");
  const parts = text.split(" · ");
  if (parts.length >= 2 && !parts[0].includes("周")) {
    return `${parts[0]} 周一 · ${parts.slice(1).join(" · ")}`;
  }
  return text || "7月6日 周一 · 小雨 18°C";
}

function renderGenerationStatus() {
  elements.regenerateButton.disabled = state.isGenerating;
  elements.refreshAllButton.disabled = state.isGenerating;
  const status = buildGenerationStatus(state);
  elements.generationStatus.textContent = status.text;
  elements.generationStatus.dataset.state = status.state;
}

function renderRecoveryPanel() {
  if (!state.generationError) {
    elements.recoveryPanel.hidden = true;
    elements.recoveryPanel.innerHTML = "";
    return;
  }

  elements.recoveryPanel.hidden = false;
  elements.recoveryPanel.innerHTML = `
    <div class="recovery-copy">
      <strong>${escapeHtml(state.generationError)}</strong>
      <span>已保留本地方案,你可以先继续选今晚吃什么。</span>
    </div>
    <button class="recovery-button" type="button" data-retry-generation ${state.isGenerating ? "disabled" : ""}>
      ${retryIcon()}
      重试生成
    </button>
  `;
}

function renderDailyReview() {
  const review = buildDailyReview(state.feedbackLearning);
  const top = state.cards?.length ? getTopRecommendation(state.cards, recommendationContext()) : null;
  const impacts = top ? buildDailyReviewImpacts(top, recommendationContext()) : [];
  elements.dailyReview.hidden = !review;
  if (!review) {
    elements.dailyReview.innerHTML = "";
    return;
  }

  elements.dailyReview.innerHTML = `
    <div>
      <strong>${escapeHtml(review.title)}</strong>
      <p>${escapeHtml(review.text)}</p>
    </div>
    ${review.chips.length ? `<div class="daily-review-chips">${review.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
    ${impacts.length ? dailyReviewImpactRow(impacts) : ""}
  `;
}

function dailyReviewImpactRow(impacts) {
  return `
    <div class="daily-review-impact-row" aria-label="复盘影响本次推荐">
      <b>影响本次推荐</b>
      ${impacts
        .map(
          (impact) => `
            <span>
              ${escapeHtml(impact.label)}
              <small>${escapeHtml(impact.text)}</small>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderNextMealPlan() {
  const plan = buildNextMealPlan(state.recentMeals, state.profile, state.feedbackLearning, state.cards);
  elements.nextMealPlan.hidden = !plan;
  if (!plan) {
    elements.nextMealPlan.innerHTML = "";
    return;
  }

  elements.nextMealPlan.innerHTML = `
    <div>
      <strong>${escapeHtml(plan.title)}</strong>
      <p>${escapeHtml(plan.text)}</p>
    </div>
    ${plan.chips.length ? `<div class="next-meal-chips">${plan.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
    ${nextMealActionTemplate(plan.action)}
  `;
}

function nextMealActionTemplate(action) {
  if (!action) return "";
  return `
    <button class="next-meal-action" type="button" data-next-meal-card="${escapeHtml(action.cardId)}" data-next-meal-label="${escapeHtml(action.label)}" data-next-meal-reasons="${escapeHtml((action.reasons ?? []).join("|"))}">
      <strong>${escapeHtml(action.label)}</strong>
      <span>${escapeHtml(action.title)}</span>
      <small>${escapeHtml(action.detail)}</small>
      ${nextMealActionReasons(action.reasons)}
    </button>
  `;
}

function nextMealActionReasons(reasons = []) {
  if (!reasons.length) return "";
  return `
    <em class="next-meal-action-reasons" aria-label="推荐依据">
      ${reasons.map((reason) => `<b>${escapeHtml(reason)}</b>`).join("")}
    </em>
  `;
}

function renderQuickFeedbackPanel() {
  const prompt = buildQuickFeedbackPrompt(state.recentMeals, state.feedback);
  elements.quickFeedbackPanel.hidden = !prompt;
  if (!prompt) {
    elements.quickFeedbackPanel.innerHTML = "";
    return;
  }

  elements.quickFeedbackPanel.innerHTML = `
    <div>
      <strong>${escapeHtml(prompt.title)}</strong>
      <p>${escapeHtml(prompt.text)}</p>
    </div>
    <div class="quick-feedback-tags">
      ${prompt.tags
        .map(
          (tag) => `
            <button type="button" data-quick-feedback-tag="${escapeHtml(tag)}" data-card-id="${escapeHtml(prompt.cardId)}">
              ${escapeHtml(tag)}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderLearningSummary() {
  const summary = buildLearningSummary(state.feedbackLearning);
  const profileSuggestion = buildFeedbackProfileSuggestion(state.feedbackLearning, state.profile);
  elements.learningSummary.hidden = !summary;
  if (!summary) {
    elements.learningSummary.innerHTML = "";
    return;
  }

  elements.learningSummary.innerHTML = `
    <div class="learning-title">${escapeHtml(summary.title)}</div>
    <div class="learning-chip-row">
      ${summary.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
    </div>
    ${summary.lastFeedbackText ? `<p>${escapeHtml(summary.lastFeedbackText)}</p>` : ""}
    ${learningImpactTemplate(summary.impact)}
    ${profileSuggestion ? feedbackProfileSuggestionTemplate(profileSuggestion) : ""}
  `;
}

function learningImpactTemplate(impact) {
  if (!impact) return "";
  return `
    <div class="learning-impact">
      <strong>${escapeHtml(impact.title)}</strong>
      <div>
        ${impact.items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  `;
}

function feedbackProfileSuggestionTemplate(suggestion) {
  return `
    <div class="feedback-profile-suggestion">
      <div>
        <strong>${escapeHtml(suggestion.title)}</strong>
        <span>${escapeHtml(suggestion.detail)}</span>
      </div>
      <button type="button" data-feedback-profile-action="${escapeHtml(suggestion.actionId)}">
        ${escapeHtml(suggestion.buttonLabel)}
      </button>
    </div>
  `;
}

function generationStatusText() {
  return buildGenerationStatus(state).text;
}

function renderSettingsPage() {
  if (currentView() !== "settings") return;
  const draft = state.draftProfile ?? createDraftProfile(state.profile);
  const groups = Object.entries(settingsDefinitions).reduce((acc, [key, definition]) => {
    acc[definition.group] ??= [];
    acc[definition.group].push({ key, ...definition });
    return acc;
  }, {});

  elements.settingsScreen.innerHTML = `
    <header class="flow-top-bar simple">
      <button class="icon-button back-button" type="button" data-settings-back aria-label="返回">
        ${chevronLeftIcon()}
      </button>
      <h1>设置</h1>
    </header>
    <div class="settings-groups">
      ${Object.entries(groups)
        .map(
          ([groupName, rows]) => `
            <section class="settings-group">
              <h2>${escapeHtml(groupName)}</h2>
              <div class="settings-card">
                ${rows.map((row) => settingsRowTemplate(row, draft)).join("")}
              </div>
            </section>
          `
        )
        .join("")}
      <section class="settings-group">
        <h2>数据</h2>
        <div class="settings-card">
          <button class="settings-clear" type="button" data-clear-data>${state.clearDataArmed ? "再点一次，确认清空" : "清空本地数据"}</button>
        </div>
        <p class="settings-note">偏好会同步到本地服务，清空后可重新设置。</p>
      </section>
    </div>
    ${settingsPickerTemplate(draft)}
  `;
}

function settingsRowTemplate(row, draft) {
  return `
    <button class="settings-row" type="button" data-settings-key="${escapeHtml(row.key)}">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(formatSettingValue(row.key, draft))}</strong>
      ${chevronRightIcon()}
    </button>
  `;
}

function settingsPickerTemplate(draft) {
  const key = state.settingsPicker;
  if (!key) return "";
  const definition = settingsDefinitions[key];
  const rawOptions = definition.options ?? [];
  const options = rawOptions.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option
  );
  const selected = draftValueForKey(draft, key);
  return `
    <div class="inline-sheet">
      <button class="inline-sheet-scrim" type="button" data-settings-picker-close aria-label="关闭"></button>
      <div class="inline-sheet-panel">
        <div class="sheet-grabber"></div>
        <h2>${escapeHtml(definition.label)}</h2>
        <p>${definition.type === "multi" ? "可以多选，选完点完成" : "选一个就行"}</p>
        <div class="picker-options">
          ${definition.none ? `<button class="pill-choice ${selected.length === 0 ? "is-selected" : ""}" type="button" data-settings-none>${escapeHtml(definition.none)}</button>` : ""}
          ${options
            .map((option) => {
              const on = definition.type === "multi"
                ? selected.includes(option.value)
                : selected === option.value;
              return `<button class="pill-choice ${on ? "is-selected" : ""}" type="button" data-settings-option="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>`;
            })
            .join("")}
        </div>
        <button class="primary-button" type="button" data-settings-picker-close>完成</button>
      </div>
    </div>
  `;
}

function formatSettingValue(key, draft) {
  if (key === "taboos") {
    return (draft.taboos ?? []).length ? draft.taboos.join("、") : "无";
  }
  const value = draftValueForKey(draft, key);
  if (Array.isArray(value)) return value.length ? value.join("、") : "未选";
  const definition = settingsDefinitions[key];
  const option = (definition.options ?? [])
    .map((item) => (typeof item === "string" ? { label: item, value: item } : item))
    .find((item) => item.value === value);
  return option?.label ?? value ?? "未选";
}

function draftValueForKey(draft, key) {
  if (key === "taboos") return draft.taboos ?? [];
  return draft[key];
}

function openSheet(id) {
  document.querySelector(`#${id}`).setAttribute("aria-hidden", "false");
}

function closeSheet(id) {
  document.querySelector(`#${id}`).setAttribute("aria-hidden", "true");
}

function getCard(id) {
  return state.cards.find((card) => card.id === id);
}

function getRecipeCard(id, options = {}) {
  return findRecipeCard(state.cards, state.favoriteMeals, id, options);
}

function getActionCard(id) {
  return getRecipeCard(id) ?? getCard(id);
}

function selectCard(card, actionContext = null) {
  selectDecisionCardState(state, card.id, actionContext);
  recordSelectedMeal(state, card);
  persist();
  syncMemory();
  render();
  track("card_selected", {
    decisionId: state.decisionId || "local",
    cardId: card.id,
    type: card.type,
    source: actionContext?.source || "today",
    generationSource: state.generationSource || "unknown"
  });
  if (state.decisionId) {
    selectDecisionCard({
      decisionId: state.decisionId,
      userId: state.userId,
      cardId: card.id
    }).catch(() => showToast("选择已本地记录,后端稍后同步"));
  }

  if (card.type === "cook") {
    openRecipe(card);
    return;
  }

  openPlatform(card);
}

function openRecipe(card, source = "current") {
  state.selectedRecipeId = card.id;
  state.selectedRecipeSource = source;
  state.view = "recipe";
  state.checkedIngredients[card.id] ??= [];
  state.doneSteps[card.id] ??= [];
  persist();
  render();
}

function renderRecipePage() {
  if (currentView() !== "recipe") return;
  const card = getRecipeCard(state.selectedRecipeId, { preferFavorite: state.selectedRecipeSource === "favorite" }) ?? state.cards.find((item) => item.type === "cook");
  if (!card) {
    setView("today");
    return;
  }
  const checked = state.checkedIngredients[card.id] ?? [];
  const doneSteps = state.doneSteps[card.id] ?? [];
  const favorite = isFavoriteMeal(state, card.id);
  const servingText = servingLabel(state.profile);
  const grouped = groupIngredients(scaleIngredientsForPeople(card.ingredients, state.profile.peopleCount));
  const prepTimeline = buildPrepTimeline(card);
  elements.recipeScreen.innerHTML = `
    <header class="flow-top-bar simple">
      <button class="icon-button back-button" type="button" data-recipe-back aria-label="返回">
        ${chevronLeftIcon()}
      </button>
      <button class="icon-button favorite-button ${favorite ? "is-active" : ""}" type="button" data-toggle-favorite="${escapeHtml(card.id)}" aria-label="${favorite ? "取消收藏" : "收藏"}" aria-pressed="${favorite}">
        ${starIcon()}
      </button>
    </header>
    <div class="recipe-detail-content">
      <section class="recipe-heading">
        <h1>${escapeHtml(card.title)}</h1>
        <div class="metric-pills">
          ${cardPills(card).map((pill) => `<span class="metric-pill">${escapeHtml(pill)}</span>`).join("")}
          ${card.nutritionSummary?.protein ? `<span class="metric-pill">蛋白质 ${escapeHtml(card.nutritionSummary.protein)}</span>` : ""}
        </div>
      </section>
      ${prepTimelineTemplate(prepTimeline)}
      <section class="detail-card">
        <h2>食材 · ${escapeHtml(servingText)}</h2>
        ${Object.entries(grouped)
          .map(
            ([group, items]) => `
              <div class="ingredient-group">
                <h3>${escapeHtml(group)}</h3>
                ${items
                  .map((item, index) => {
                    const id = ingredientId(item, index);
                    const on = checked.includes(id);
                    return `
                      <button class="check-row ${on ? "is-done" : ""}" type="button" data-ingredient-id="${escapeHtml(id)}">
                        <span class="round-check">${on ? checkIcon() : ""}</span>
                        <span>${escapeHtml(item.name)}</span>
                        <strong>${escapeHtml(item.amount)}</strong>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            `
          )
          .join("")}
      </section>
      <section class="steps-section">
        <h2>步骤</h2>
        ${card.steps
          .map((step, index) => {
            const on = doneSteps.includes(index);
            return `
              <button class="step-card ${on ? "is-done" : ""}" type="button" data-step-index="${index}">
                <span class="step-num">${on ? checkIcon() : index + 1}</span>
                <span>${escapeHtml(step)}</span>
              </button>
            `;
          })
          .join("")}
      </section>
      <section class="tip-panel">
        ${warningIcon()}
        <p><strong>翻车提醒</strong> 下锅前把食材水分擦干，少油也更容易出香味。</p>
      </section>
    </div>
    <div class="recipe-action-bar">
      <button class="ghost-button" type="button" data-copy-recipe-list="${escapeHtml(card.id)}">复制购物清单</button>
      <button class="ghost-button" type="button" data-recipe-grocery="${escapeHtml(card.id)}">去小象搜</button>
      <button class="primary-button" type="button" data-recipe-done="${escapeHtml(card.id)}">做完了</button>
    </div>
  `;
}

function prepTimelineTemplate(timeline) {
  if (!timeline?.items?.length) return "";

  return `
    <section class="prep-timeline" aria-label="备菜顺序">
      <div class="panel-heading">
        <h2>备菜顺序</h2>
        <span>${escapeHtml(timeline.totalMinutes)} 分钟</span>
      </div>
      <div class="prep-timeline-list">
        ${timeline.items
          .map(
            (item) => `
              <article class="prep-timeline-item">
                <strong>${escapeHtml(item.timeText)}</strong>
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.detail)}</p>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function groupIngredients(ingredients = []) {
  return ingredients.reduce((groups, item) => {
    groups[item.group || "食材"] ??= [];
    groups[item.group || "食材"].push(item);
    return groups;
  }, {});
}

function ingredientId(item, index) {
  return `${item.name}-${item.amount}-${index}`;
}

function actionPlanContext(card) {
  return {
    ...recommendationContext(),
    ownedIngredientNames: ownedIngredientNamesForCard(card)
  };
}

function shoppingListOptions(card) {
  return { ownedIngredientNames: ownedIngredientNamesForCard(card) };
}

function favoriteShoppingOptions() {
  return { ownedIngredientNames: ownedIngredientNamesForCards(state.favoriteMeals) };
}

function ownedIngredientNamesForCards(cards = []) {
  return uniqueClean(cards.flatMap((card) => ownedIngredientNamesForCard(card)));
}

function ownedIngredientNamesForCard(card) {
  if (!card?.ingredients?.length) return [];
  const checked = state.checkedIngredients[card.id] ?? [];
  if (!checked.length) return [];

  return uniqueClean(ingredientEntries(card)
    .filter((item) => checked.includes(item.id))
    .map((item) => item.name));
}

function ingredientEntries(card) {
  const grouped = groupIngredients(scaleIngredientsForPeople(card.ingredients ?? [], state.profile.peopleCount));
  return Object.values(grouped).flatMap((items) =>
    items.map((item, index) => ({
      id: ingredientId(item, index),
      name: item.name
    }))
  );
}

function openPlatform(card) {
  openActionPlan(card);
  showToast("已准备好平台入口和关键词");
}

function actionCompletionLabel(card) {
  if (card.type === "takeout") return "已下单/吃完，给反馈";
  if (card.type === "dine_out") return "已吃完，给反馈";
  return "做完了，给反馈";
}

function actionCompletionToast(card) {
  if (card.type === "takeout") return "已记录这顿外卖";
  if (card.type === "dine_out") return "已记录这次探店";
  return "已记录这顿做完了";
}

function completeActionPlan(card) {
  recordCompletedMeal(state, card);
  if (card.type === "cook") {
    state.doneSteps[card.id] = (card.steps ?? []).map((_, index) => index);
  }
  closeSheet("actionSheet");
  persist();
  syncMemory();
  render();
  track("fulfillment_completed", { cardId: card.id, type: card.type });
  showFeedback(card.id);
  showToast(actionCompletionToast(card));
}

function openActionPlan(card) {
  track("fulfillment_opened", {
    cardId: card.id,
    type: card.type,
    action: card.primaryAction?.action || ""
  });
  const ownedIngredientNames = ownedIngredientNamesForCard(card);
  const plan = buildActionPlan(card, state.profile, actionPlanContext(card));
  elements.actionContent.innerHTML = `
    <h2 class="sheet-title">${escapeHtml(plan.title)}</h2>
    <p>${escapeHtml(plan.summary)}</p>
    <div class="keyword-row" aria-label="搜索关键词">
      ${plan.keywordChips.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join("")}
    </div>
    ${plan.noteChips?.length ? renderNoteChips(plan.noteChips) : ""}
    ${renderReadinessSummary(plan.readinessSummary)}
    <div class="platform-action-list">
      ${plan.actions
        .map(
          (action) => `
            <a class="platform-action" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer" data-platform-link="${escapeHtml(action.platform)}" data-card-id="${escapeHtml(card.id)}">
              <strong>${escapeHtml(action.label)}</strong>
              <span>${escapeHtml(platformLabel(action.platform))} · ${escapeHtml(action.helper)}</span>
            </a>
          `
        )
        .join("")}
    </div>
    ${renderShoppingList(plan.shoppingList ?? [], card.id, ownedIngredientNames, plan.shoppingGroups ?? [])}
    <button class="primary-button full-width" type="button" data-complete-action="${escapeHtml(card.id)}">${escapeHtml(actionCompletionLabel(card))}</button>
    <button class="ghost-button full-width" type="button" data-copy-keywords="${escapeHtml(card.id)}">复制搜索词</button>
    <h3>下单前看一眼</h3>
    <ul class="action-checklist">
      ${plan.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
  openSheet("actionSheet");
}

function renderNoteChips(notes) {
  return `
    <div class="note-row" aria-label="行动备注">
      ${notes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")}
    </div>
  `;
}

function renderReadinessSummary(summary) {
  if (!summary) return "";
  const status = summary.status === "ready_to_cook" ? "ready" : "need";

  return `
    <section class="readiness-panel status-${escapeHtml(status)}">
      <div class="readiness-heading">
        <span>${escapeHtml(status === "ready" ? "可开做" : "先补货")}</span>
        <strong>${escapeHtml(summary.title)}</strong>
      </div>
      <div class="readiness-metrics">
        ${(summary.metrics ?? [])
          .map(
            (metric) => `
              <div>
                <span>${escapeHtml(metric.label)}</span>
                <strong>${escapeHtml(metric.value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <p>${escapeHtml(summary.helper)}</p>
    </section>
  `;
}

function renderShoppingList(items, cardId, ownedIngredientNames = [], groups = []) {
  const ownedNames = uniqueClean(ownedIngredientNames);
  const displayGroups = normalizeShoppingGroups(groups, items);
  if (!displayGroups.length && !ownedNames.length) return "";

  return `
    <div class="shopping-list-panel">
      <div class="panel-heading">
        <h3>采购清单</h3>
        ${items.length ? `<button class="text-button" type="button" data-copy-shopping-plan="${escapeHtml(cardId)}">复制</button>` : ""}
      </div>
      ${ownedNames.length ? `<p class="shopping-list-note">已扣除已有食材: ${escapeHtml(ownedNames.slice(0, 4).join("、"))}</p>` : ""}
      ${
        displayGroups.length
          ? shoppingGroupsTemplate(displayGroups)
          : `<p class="shopping-list-empty">这道菜的食材已确认齐了,暂时不用补货。</p>`
      }
    </div>
  `;
}

function normalizeShoppingGroups(groups = [], fallbackItems = []) {
  if (groups.length) return groups;
  return fallbackItems.length ? [{ label: "待采购", items: fallbackItems }] : [];
}

function shoppingGroupsTemplate(groups = []) {
  return `
    <div class="shopping-group-list">
      ${groups
        .map(
          (group) => `
            <section class="shopping-group">
              <h4>${escapeHtml(group.label)}</h4>
              <div class="shopping-list-grid">
                ${(group.items ?? []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function copyShoppingList(card) {
  const list = buildShoppingList(card, state.profile, shoppingListOptions(card));
  if (!list.length) {
    showToast("已确认食材都在家里,暂时不用采购");
    return;
  }
  copyText(list.join("\n"));
  showToast("购物清单已复制");
}

function completeRecipe(card) {
  recordCompletedMeal(state, card);
  state.doneSteps[card.id] = (card.steps ?? []).map((_, index) => index);
  persist();
  syncMemory();
  render();
  showFeedback(card.id);
  showToast("已记录这顿做完了");
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return;
  }

  fallbackCopy(text);
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showFeedback(cardId) {
  elements.feedbackTags.innerHTML = feedbackOptions
    .map((tag) => `<button type="button" data-feedback-tag="${escapeHtml(tag)}" data-card-id="${escapeHtml(cardId)}">${escapeHtml(tag)}</button>`)
    .join("");
  openSheet("feedbackSheet");
}

function applyMealFeedback(cardId, tag, options = {}) {
  const meal = state.recentMeals.find((item) => item.id === cardId);
  const card = getCard(cardId) ?? meal;
  const { feedback, recorded } = recordMealFeedback(state, cardId, tag, undefined, meal);
  if (!recorded) {
    if (options.closeSheet) {
      closeSheet(options.closeSheet);
    }
    render();
    showToast("这顿反馈已记录过");
    return;
  }
  if (card) {
    recordFeedbackLearning(state, card, feedback.tag, feedback.createdAt);
  }
  track("feedback_submitted", {
    cardId: feedback.cardId,
    tag: feedback.tag,
    mealSelectedAt: feedback.mealSelectedAt || ""
  });
  state.view = "today";
  state.selectedRecipeId = null;
  state.selectedRecipeSource = "current";
  persist();
  syncMemory();
  if (state.decisionId) {
    submitFeedback({
      decisionId: state.decisionId,
      userId: state.userId,
      cardId: feedback.cardId,
      tag: feedback.tag,
      createdAt: feedback.createdAt,
      mealSelectedAt: feedback.mealSelectedAt
    }).catch(() => showToast("反馈已本地记录,后端稍后同步"));
  }
  if (options.closeSheet) {
    closeSheet(options.closeSheet);
  }
  showToast("反馈已记录,正在更新推荐");
  regenerateDecision("feedback");
}

function openHistory() {
  const shoppingOptions = favoriteShoppingOptions();
  elements.historyContent.innerHTML = historyTemplate(
    buildHistorySummary(state),
    buildAggregatedShoppingList(state.favoriteMeals, state.profile, shoppingOptions),
    buildAggregatedShoppingGroups(state.favoriteMeals, state.profile, shoppingOptions)
  );
  openSheet("historySheet");
}

function historyTemplate(summary, favoriteShoppingList = [], favoriteShoppingGroups = []) {
  if (!summary.hasHistory) {
    return `
      <h2 class="sheet-title">晚餐记录</h2>
      <p class="empty-state">还没有记录。选一次晚餐或点一次反馈后,这里会开始记住你的偏好。</p>
    `;
  }

  return `
    <h2 class="sheet-title">晚餐记录</h2>
    <div class="history-stats">
      <div><strong>${summary.recentMeals.length}</strong><span>最近选择</span></div>
      <div><strong>${summary.favoriteMeals.length}</strong><span>常吃收藏</span></div>
      <div><strong>${summary.feedbackCount}</strong><span>反馈次数</span></div>
      <div><strong>${summary.positiveFeedbackCount}</strong><span>喜欢</span></div>
      <div><strong>${summary.negativeFeedbackCount}</strong><span>避雷</span></div>
    </div>
    ${spendSummarySection(summary.spendSummary)}
    ${favoriteMealSection(summary.favoriteMeals)}
    ${favoriteShoppingListSection(favoriteShoppingList, favoriteShoppingGroups)}
    ${historyInsightSection(summary.insights)}
    <h3>最近吃过</h3>
    ${historyMealList(summary.recentMeals)}
    <h3>偏好学习</h3>
    ${historyChipSection("喜欢", summary.likedKeywords)}
    ${historyChipSection("少推荐", summary.avoidedKeywords)}
    ${historyChipSection("约束", summary.constraints)}
  `;
}

function spendSummarySection(summary) {
  if (!summary?.hasSpend) return "";
  const budgetStatus = ["within", "over", "under"].includes(summary.budgetStatus) ? summary.budgetStatus : "";
  const statusClass = budgetStatus ? ` status-${budgetStatus}` : "";
  const detail = summary.budgetMessage
    ? `${summary.budgetMessage} · 按推荐方案预估,不是实际账单`
    : `${summary.averageLabel} · 按推荐方案预估,不是实际账单`;

  return `
    <section class="spend-summary-panel${statusClass}">
      <div>
        <span>预计花费</span>
        <strong>${escapeHtml(summary.label)}</strong>
      </div>
      <p>${escapeHtml(detail)}</p>
    </section>
  `;
}

function favoriteShoppingListSection(items, groups = []) {
  if (!items.length) return "";
  const displayGroups = normalizeShoppingGroups(groups, items);

  return `
    <section class="shopping-list-panel favorite-shopping-panel">
      <div class="panel-heading">
        <h3>收藏采购清单</h3>
        <div class="panel-actions">
          <button class="text-button" type="button" data-copy-favorite-shopping-list>复制</button>
          <button class="text-button" type="button" data-open-favorite-grocery>去小象搜</button>
        </div>
      </div>
      ${shoppingGroupsTemplate(displayGroups.map((group) => ({
        ...group,
        items: (group.items ?? []).slice(0, 12)
      })))}
    </section>
  `;
}

function favoriteMealSection(meals) {
  if (!meals.length) return "";

  return `
    <h3>常吃收藏</h3>
    <div class="history-list">
      ${meals
        .map(
          (meal) => `
            <article class="history-item">
              <div>
                <strong>${escapeHtml(meal.title)}</strong>
                <span>${escapeHtml(meal.typeLabel)} · ${escapeHtml(formatHistoryTime(meal.favoritedAt))}</span>
              </div>
              <small>${escapeHtml((meal.searchKeywords ?? []).slice(0, 3).join(" / "))}</small>
              <div class="history-item-actions">
                ${
                  meal.canOpenRecipe
                    ? `<button class="text-button" type="button" data-open-favorite-recipe="${escapeHtml(meal.id)}">打开菜谱</button>`
                    : `<span>已作为偏好参考</span>`
                }
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function historyInsightSection(insights = []) {
  if (!insights.length) return "";

  return `
    <h3>近况洞察</h3>
    <div class="history-insight-grid">
      ${insights
        .map(
          (insight) => `
            <article class="history-insight tone-${escapeHtml(insight.tone)}">
              <span>${escapeHtml(insight.label)}</span>
              <strong>${escapeHtml(insight.value)}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function historyMealList(meals, timeKey = "displayedAt") {
  if (!meals.length) return `<p class="empty-state compact">还没有选择记录。</p>`;

  return `
    <div class="history-list">
      ${meals
        .map(
          (meal) => `
            <article class="history-item">
              <div>
                <strong>${escapeHtml(meal.title)}</strong>
                <span>${escapeHtml(meal.typeLabel)} · ${escapeHtml(formatHistoryTime(meal[timeKey] ?? meal.selectedAt ?? meal.favoritedAt))}</span>
              </div>
              <small>${escapeHtml(historyMealMeta(meal))}</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function historyMealMeta(meal) {
  const keywords = (meal.searchKeywords ?? []).slice(0, 3).join(" / ");
  const cost = meal.costText ?? (meal.estimatedCostPerPerson ? `约¥${meal.estimatedCostPerPerson}/人` : "");
  return [meal.statusText, keywords, cost].filter(Boolean).join(" · ");
}

function historyChipSection(label, values) {
  if (!values.length) return "";

  return `
    <div class="history-chip-row" aria-label="${escapeHtml(label)}">
      <span>${escapeHtml(label)}</span>
      ${values.map((value) => `<b>${escapeHtml(value)}</b>`).join("")}
    </div>
  `;
}

function formatHistoryTime(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.setTimeout(() => elements.toast.classList.remove("visible"), 1800);
}

async function refreshOne(type, currentId) {
  if (state.isGenerating) return;

  track("refresh", {
    scope: "one",
    decisionId: state.decisionId || "local",
    type,
    currentId,
    mood: state.context.mood
  });
  const hadRemoteDecision = Boolean(state.decisionId);

  if (state.decisionId) {
    try {
      const decision = await refreshDecisionCard({
        decisionId: state.decisionId,
        userId: state.userId,
        type,
        currentId,
        mood: state.context.mood
      });
      applyDecision(decision);
      persist();
      render();
      return;
    } catch (error) {
      if (!isRecoverableApiFailure(error)) {
        showToast("换菜请求无效,已保留当前方案");
        return;
      }
      showToast("后端换菜失败,已用本地方案");
    }
  }

  const next = refreshCard(type, state.context.mood, currentId);
  replaceDecisionCardState(state, currentId, next);
  markLocalDecisionState(
    state,
    hadRemoteDecision ? "后端换菜失败,已使用本地换菜方案" : "已使用本地换菜方案"
  );
  persist();
  render();
}

function refreshAll() {
  if (state.isGenerating) return;

  track("refresh", {
    scope: "all",
    decisionId: state.decisionId || "local",
    cardCount: state.cards.length,
    mood: state.context.mood
  });
  [...state.cards].forEach((card) =>
    replaceDecisionCardState(state, card.id, refreshCard(card.type, state.context.mood, card.id))
  );
  markLocalDecisionState(state, "已使用本地批量换菜方案");
  persist();
  render();
}

function clocheIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12h20"></path>
      <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path>
      <path d="m4 8 16-4"></path>
      <path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"></path>
    </svg>
  `;
}

function chevronLeftIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>`;
}

function chevronRightIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
}

function checkCircleIcon() {
  return `<svg class="inline-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`;
}

function checkIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4 10-11"></path></svg>`;
}

function starIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17.3-5.4 3 1-6-4.4-4.3 6.1-.9L12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6z"></path></svg>`;
}

function warningIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.7 18.4-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21.4h16a2 2 0 0 0 1.7-3z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`;
}

function retryIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.1-6.6L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15.1 6.6L3 16"></path><path d="M3 21v-5h5"></path></svg>`;
}

function updateDraftField(field, value) {
  state.draftProfile = state.draftProfile ?? createDraftProfile(state.profile);
  state.draftProfile[field] = value;
}

function goOnboardingNext() {
  state.onboardingStep = Math.min(4, Number(state.onboardingStep ?? 0) + 1);
  persist();
  render();
}

function goOnboardingBack() {
  state.onboardingStep = Math.max(0, Number(state.onboardingStep ?? 0) - 1);
  persist();
  render();
}

function finishOnboarding() {
  state.profile = profileFromDraft(state.draftProfile ?? createDraftProfile(state.profile));
  state.profileCompleted = true;
  state.view = "today";
  state.onboardingStep = 0;
  state.draftProfile = null;
  persist();
  syncProfile();
  track("onboarding_completed", {
    peopleCount: state.profile.peopleCount,
    budgetPerPerson: state.profile.budgetPerPerson,
    cookingWillingness: state.profile.cookingWillingness
  });
  showToast("画像已保存,正在生成");
  regenerateDecision("profile");
}

function openSettingsPage() {
  state.draftProfile = createDraftProfile(state.profile);
  state.settingsPicker = null;
  state.clearDataArmed = false;
  setView("settings");
}

function commitSettingsDraft({ regenerate = false } = {}) {
  state.profile = profileFromDraft(state.draftProfile ?? createDraftProfile(state.profile));
  state.profileCompleted = true;
  persist();
  syncProfile("设置已本地保存,后端稍后同步");
  if (regenerate) {
    showToast("设置已保存,正在重新生成");
    regenerateDecision("profile");
  }
}

function closeSettingsPage() {
  state.settingsPicker = null;
  state.clearDataArmed = false;
  state.view = "today";
  commitSettingsDraft({ regenerate: true });
  persist();
  render();
}

function updateSettingsOption(value) {
  const key = state.settingsPicker;
  if (!key) return;
  const definition = settingsDefinitions[key];
  state.draftProfile = state.draftProfile ?? createDraftProfile(state.profile);
  if (definition.type === "multi") {
    const current = [...(draftValueForKey(state.draftProfile, key) ?? [])];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : current.concat(value);
    state.draftProfile[key] = next;
  } else {
    state.draftProfile[key] = value;
    state.settingsPicker = null;
  }
  commitSettingsDraft();
  persist();
  render();
}

function clearLocalData() {
  if (!state.clearDataArmed) {
    state.clearDataArmed = true;
    persist();
    render();
    window.setTimeout(() => {
      if (state.clearDataArmed) {
        state.clearDataArmed = false;
        persist();
        render();
      }
    }, 3000);
    return;
  }

  clearState(stateKey);
  state.profile = defaultProfile;
  state.profileCompleted = false;
  state.profileSyncPending = false;
  state.memorySyncPending = false;
  state.draftProfile = createDraftProfile(defaultProfile);
  state.view = "onboarding";
  state.onboardingStep = 0;
  state.settingsPicker = null;
  state.clearDataArmed = false;
  state.recentMeals = [];
  state.favoriteMeals = [];
  state.feedback = [];
  state.feedbackLearning = null;
  persist();
  render();
  showToast("已清空本地数据");
}

elements.moodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.mood === state.context.mood) return;
    state.context.mood = button.dataset.mood;
    persist();
    showToast(`已切换到${getMoodLabel(state.context.mood)}模式,正在生成`);
    regenerateDecision("mood");
  });
});

elements.decisionList.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  const budgetSwapButton = event.target.closest("[data-budget-swap]");
  const refreshButton = event.target.closest("[data-refresh]");
  const copyCardButton = event.target.closest("[data-copy-card-keywords]");

  if (budgetSwapButton) {
    if (state.isGenerating) return;
    const card = getCard(budgetSwapButton.dataset.budgetSwap);
    if (!card) return;
    selectCard(card);
    showToast("已改选更省钱方案");
    return;
  }

  if (actionButton) {
    if (state.isGenerating) return;
    const card = getCard(actionButton.dataset.cardId);
    selectCard(card);
    return;
  }

  if (refreshButton) {
    if (state.isGenerating) return;
    refreshOne(refreshButton.dataset.refresh, refreshButton.dataset.cardId);
    return;
  }

  if (copyCardButton) {
    const card = getCard(copyCardButton.dataset.copyCardKeywords);
    const plan = buildActionPlan(card, state.profile, recommendationContext());
    copyText(plan.searchText);
    showToast("关键词已复制");
  }
});

elements.topRecommendation.addEventListener("click", (event) => {
  const tuningButton = event.target.closest("[data-profile-tuning]");
  if (tuningButton) {
    state.profile = applyProfileTuningAction(state.profile, tuningButton.dataset.profileTuning);
    state.profileCompleted = true;
    persist();
    syncProfile();
    render();
    showToast("已写入画像,推荐会更贴近你");
    return;
  }

  const button = event.target.closest("[data-primary]");
  if (!button) return;
  if (state.isGenerating) return;
  selectCard(getCard(button.dataset.primary));
});

elements.regenerateButton.addEventListener("click", () => regenerateDecision("manual"));

elements.refreshAllButton.addEventListener("click", refreshAll);

elements.historyButton.addEventListener("click", openHistory);

elements.onboardingScreen.addEventListener("click", (event) => {
  const preset = event.target.closest("[data-profile-preset]");
  const option = event.target.closest("[data-onboarding-field]");
  const taboo = event.target.closest("[data-onboarding-taboo]");
  if (preset) {
    state.draftProfile = {
      ...applyProfilePreset(state.draftProfile ?? createDraftProfile(state.profile), preset.dataset.profilePreset),
      presetId: preset.dataset.profilePreset
    };
    persist();
    render();
    showToast("已套用快捷画像,可以继续微调");
    return;
  }
  if (event.target.closest("[data-onboarding-back]")) {
    goOnboardingBack();
    return;
  }
  if (event.target.closest("[data-onboarding-next]")) {
    goOnboardingNext();
    return;
  }
  if (event.target.closest("[data-onboarding-finish]")) {
    finishOnboarding();
    return;
  }
  if (event.target.closest("[data-onboarding-none]")) {
    updateDraftField("taboos", []);
    persist();
    render();
    return;
  }
  if (taboo) {
    const value = taboo.dataset.onboardingTaboo;
    const current = state.draftProfile?.taboos ?? [];
    updateDraftField(
      "taboos",
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.concat(value)
    );
    persist();
    render();
    return;
  }
  if (option) {
    updateDraftField(option.dataset.onboardingField, option.dataset.onboardingValue);
    persist();
    render();
    if (option.dataset.autoNext === "true") {
      window.setTimeout(goOnboardingNext, 220);
    }
  }
});

elements.settingsScreen.addEventListener("click", (event) => {
  const row = event.target.closest("[data-settings-key]");
  const option = event.target.closest("[data-settings-option]");
  if (event.target.closest("[data-settings-back]")) {
    closeSettingsPage();
    return;
  }
  if (event.target.closest("[data-clear-data]")) {
    clearLocalData();
    return;
  }
  if (event.target.closest("[data-settings-picker-close]")) {
    state.settingsPicker = null;
    persist();
    render();
    return;
  }
  if (event.target.closest("[data-settings-none]")) {
    const key = state.settingsPicker;
    if (key) {
      state.draftProfile[key] = [];
      commitSettingsDraft();
      persist();
      render();
    }
    return;
  }
  if (option) {
    updateSettingsOption(option.dataset.settingsOption);
    return;
  }
  if (row) {
    state.settingsPicker = row.dataset.settingsKey;
    persist();
    render();
  }
});

elements.recipeScreen.addEventListener("click", (event) => {
  const card = getRecipeCard(state.selectedRecipeId, { preferFavorite: state.selectedRecipeSource === "favorite" });
  const ingredient = event.target.closest("[data-ingredient-id]");
  const step = event.target.closest("[data-step-index]");
  if (event.target.closest("[data-recipe-back]")) {
    setView("today");
    return;
  }
  if (event.target.closest("[data-toggle-favorite]") && card) {
    const active = toggleFavoriteMeal(state, card);
    persist();
    syncMemory();
    render();
    showToast(active ? "已加入常吃收藏" : "已取消收藏");
    return;
  }
  if (ingredient && card) {
    const current = state.checkedIngredients[card.id] ?? [];
    const id = ingredient.dataset.ingredientId;
    state.checkedIngredients[card.id] = current.includes(id)
      ? current.filter((item) => item !== id)
      : current.concat(id);
    persist();
    render();
    return;
  }
  if (step && card) {
    const current = state.doneSteps[card.id] ?? [];
    const index = Number(step.dataset.stepIndex);
    state.doneSteps[card.id] = current.includes(index)
      ? current.filter((item) => item !== index)
      : current.concat(index);
    persist();
    render();
    return;
  }
  if (event.target.closest("[data-copy-recipe-list]") && card) {
    copyShoppingList(card);
    return;
  }
  if (event.target.closest("[data-recipe-grocery]") && card) {
    openActionPlan(card);
    return;
  }
  if (event.target.closest("[data-recipe-done]") && card) {
    completeRecipe(card);
  }
});

document.body.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry-generation]")) {
    regenerateDecision("retry");
    return;
  }

  const closeButton = event.target.closest("[data-close]");
  const openFavoriteRecipeButton = event.target.closest("[data-open-favorite-recipe]");
  const copyFavoriteShoppingListButton = event.target.closest("[data-copy-favorite-shopping-list]");
  const openFavoriteGroceryButton = event.target.closest("[data-open-favorite-grocery]");
  const feedbackButton = event.target.closest("[data-feedback]");
  const feedbackTag = event.target.closest("[data-feedback-tag]");
  const quickFeedbackTag = event.target.closest("[data-quick-feedback-tag]");
  const feedbackProfileAction = event.target.closest("[data-feedback-profile-action]");
  const nextMealButton = event.target.closest("[data-next-meal-card]");
  const platformLink = event.target.closest("[data-platform-link]");
  const completeActionButton = event.target.closest("[data-complete-action]");
  const copyKeywordsButton = event.target.closest("[data-copy-keywords]");
  const copyShoppingPlanButton = event.target.closest("[data-copy-shopping-plan]");

  if (closeButton) closeSheet(closeButton.dataset.close);
  if (nextMealButton) {
    const card = getCard(nextMealButton.dataset.nextMealCard);
    if (!card) return;
    const actionContext = {
      source: "next_meal",
      label: nextMealButton.dataset.nextMealLabel ?? "下一餐建议",
      reasons: (nextMealButton.dataset.nextMealReasons ?? "").split("|").filter(Boolean)
    };
    selectCard(card, actionContext);
    showToast("已按下一餐建议选择");
    return;
  }
  if (platformLink) {
    track("platform_link_clicked", {
      platform: platformLink.dataset.platformLink,
      cardId: platformLink.dataset.cardId || "",
      status: "opened"
    });
  }
  if (feedbackProfileAction) {
    state.profile = applyProfileTuningAction(state.profile, feedbackProfileAction.dataset.feedbackProfileAction);
    state.profileCompleted = true;
    persist();
    syncProfile();
    render();
    showToast("已写入画像,下次推荐会更准");
    return;
  }
  if (copyFavoriteShoppingListButton) {
    const list = buildAggregatedShoppingList(state.favoriteMeals, state.profile, favoriteShoppingOptions());
    if (!list.length) {
      showToast("收藏菜谱的食材已确认齐了");
      return;
    }
    copyText(list.join("\n"));
    showToast("收藏采购清单已复制");
    return;
  }
  if (openFavoriteGroceryButton) {
    const list = buildAggregatedShoppingList(state.favoriteMeals, state.profile, favoriteShoppingOptions());
    if (!list.length) {
      showToast("收藏菜谱暂时不用补货");
      return;
    }
    track("platform_link_clicked", { platform: "xiaoxiang", source: "favorite", status: "opened" });
    window.open(buildSearchUrl("xiaoxiang", list), "_blank", "noopener,noreferrer");
    return;
  }
  if (openFavoriteRecipeButton) {
    const card = getRecipeCard(openFavoriteRecipeButton.dataset.openFavoriteRecipe, { preferFavorite: true });
    if (!card || !favoriteHasRecipeDetails(card)) {
      showToast("这道收藏暂时没有菜谱详情");
      return;
    }
    closeSheet("historySheet");
    openRecipe(card, "favorite");
    return;
  }
  if (completeActionButton) {
    const card = getActionCard(completeActionButton.dataset.completeAction);
    if (!card) return;
    completeActionPlan(card);
    return;
  }
  if (copyKeywordsButton) {
    const card = getActionCard(copyKeywordsButton.dataset.copyKeywords);
    if (!card) return;
    const plan = buildActionPlan(card, state.profile, actionPlanContext(card));
    track("platform_link_clicked", {
      cardId: card.id,
      type: card.type,
      status: "fallback_copy_keywords"
    });
    copyText(plan.searchText);
    showToast("搜索词已复制");
  }
  if (copyShoppingPlanButton) {
    const card = getActionCard(copyShoppingPlanButton.dataset.copyShoppingPlan);
    if (!card) return;
    const plan = buildActionPlan(card, state.profile, actionPlanContext(card));
    if (!plan.shoppingList.length) {
      showToast("已确认食材都在家里,暂时不用采购");
      return;
    }
    track("platform_link_clicked", {
      cardId: card.id,
      type: card.type,
      status: "fallback_copy_shopping_list"
    });
    copyText(plan.shoppingList.join("\n"));
    showToast("采购清单已复制");
  }
  if (feedbackButton) showFeedback(feedbackButton.dataset.feedback);
  if (quickFeedbackTag) {
    applyMealFeedback(quickFeedbackTag.dataset.cardId, quickFeedbackTag.dataset.quickFeedbackTag);
    return;
  }
  if (feedbackTag) {
    applyMealFeedback(feedbackTag.dataset.cardId, feedbackTag.dataset.feedbackTag, { closeSheet: "feedbackSheet" });
  }
});

elements.settingsButton.addEventListener("click", openSettingsPage);

track("app_opened", { profileCompleted: state.profileCompleted, view: state.view });
render();
initializeFromBackend();
registerServiceWorker();
