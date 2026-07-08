import {
  defaultDailyContext,
  defaultProfile,
  initialDecisionCards
} from "./sampleData.js";
import {
  applyDecisionState,
  failDecisionRequest,
  finishDecisionRequest,
  startDecisionRequest
} from "./appState.js";
import {
  getMoodLabel,
  getTopRecommendation,
  rankDecisionCards,
  refreshCard
} from "./decisionEngine.js";
import { buildSearchUrl } from "./platformLinks.js";
import { buildProfileSummary } from "./profile.js";
import {
  buildGenerationContext,
  recordFeedbackLearning,
  recordSelectedMeal
} from "./learning.js";
import { buildHistorySummary } from "./history.js";
import { clearState, loadState, saveState } from "./storage.js";
import { buildActionPlan, platformLabel } from "./actionPlan.js";
import {
  fetchMemory,
  fetchProfile,
  fetchTodayDecision,
  refreshDecisionCard,
  saveMemory,
  saveProfile,
  selectDecisionCard,
  submitFeedback
} from "./apiClient.js";

const stateKey = "kaifan.mvp.state";

const feedbackOptions = ["好吃,下次还吃", "太贵", "太麻烦", "没吃饱", "太油/太咸", "不合口味"];

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
  selectedRecipeId: null,
  view: "today",
  profileCompleted: false,
  onboardingStep: 0,
  draftProfile: null,
  settingsPicker: null,
  clearDataArmed: false,
  checkedIngredients: {},
  doneSteps: {},
  feedback: [],
  recentMeals: [],
  feedbackLearning: null,
  apiAvailable: false,
  isGenerating: false,
  generationError: "",
  requestSequence: 0,
  activeRequestId: 0
});

if (!state.userId) {
  state.userId = "local-user";
}

state.view ??= "today";
state.profileCompleted = Boolean(state.profileCompleted);
state.onboardingStep ??= 0;
state.draftProfile ??= null;
state.settingsPicker ??= null;
state.clearDataArmed ??= false;
state.checkedIngredients ??= {};
state.doneSteps ??= {};
state.selectedRecipeId ??= null;

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

function applyDecision(decision) {
  applyDecisionState(state, decision, cloneCards);
}

async function initializeFromBackend() {
  await hydrateUserState();
  if (!isProfileReady()) {
    state.view = "onboarding";
    state.draftProfile = state.draftProfile ?? createDraftProfile(state.profile);
    persist();
    render();
    return;
  }
  regenerateDecision("initial");
}

async function hydrateUserState() {
  await Promise.all([hydrateProfile(), hydrateMemory()]);
  persist();
  render();
}

async function hydrateProfile() {
  try {
    const response = await fetchProfile(state.userId);
    state.profile = response.profile ?? state.profile;
  } catch {
    showToast("画像读取失败,已使用本地设置");
  }
}

async function hydrateMemory() {
  try {
    const response = await fetchMemory(state.userId);
    const memory = response.memory ?? {};
    if (hasMemory(memory)) {
      state.recentMeals = memory.recentMeals ?? [];
      state.feedbackLearning = memory.feedbackLearning ?? null;
      state.feedback = memory.feedback ?? [];
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
  const requestId = startDecisionRequest(state);
  persist();
  render();

  try {
    const decision = await fetchTodayDecision({
      userId: state.userId,
      profile: state.profile,
      context: buildGenerationContext(state.context, state)
    });
    const applied = finishDecisionRequest(state, requestId, decision, cloneCards);
    if (!applied) return;
    persist();
    render();
    if (reason !== "initial") {
      showToast("已按你的画像重新生成");
    }
  } catch {
    const failed = failDecisionRequest(state, requestId, "生成失败,已保留上一版方案");
    if (!failed) return;
    persist();
    render();
    showToast("生成失败,已保留上一版方案");
  }
}

function memorySnapshot() {
  return {
    recentMeals: state.recentMeals ?? [],
    feedbackLearning: state.feedbackLearning ?? null,
    feedback: state.feedback ?? []
  };
}

function hasMemory(memory) {
  return Boolean(
    memory?.recentMeals?.length ||
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
  saveMemory(state.userId, memorySnapshot()).catch(() => showToast("记录已本地保存,后端稍后同步"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
  if (state.isGenerating) {
    renderLoadingState();
  } else {
    renderTopRecommendation();
    renderCards();
  }
  renderGenerationStatus();
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
  const top = getTopRecommendation(state.cards, state.context);
  const typeLabel = cardTypeLabel(top.type);
  elements.topRecommendation.className = "top-panel";
  elements.topRecommendation.innerHTML = `
    <div class="hero-label">
      ${clocheIcon()}
      <span>今晚最推荐 · ${escapeHtml(typeLabel)}</span>
    </div>
    <div class="hero-title">${escapeHtml(top.title)}</div>
    <p class="hero-reason">${escapeHtml(top.reason)}</p>
    <button class="primary-button" type="button" data-primary="${escapeHtml(top.id)}">别问了，就这个</button>
  `;
}

function renderCards() {
  const ranked = rankDecisionCards(state.cards, state.context);
  elements.decisionList.innerHTML = ranked.map(cardTemplate).join("");
}

function cardTemplate(card) {
  const typeLabel = cardTypeLabel(card.type);
  const accent = accentColors[card.accent] ?? accentColors.green;
  const selected = state.selectedCardId === card.id;
  const dimmed = state.selectedCardId && !selected;
  const secondaryAction = card.type === "takeout" ? "copy-card-keywords" : "refresh";
  const secondaryLabel = card.type === "takeout" ? "复制关键词" : "换这个";

  return `
    <article class="decision-card ${dimmed ? "is-dimmed" : ""}" data-card-id="${escapeHtml(card.id)}" style="--card-accent:${accent}; --tag-bg:${tagBackgrounds[card.type] ?? tagBackgrounds.cook}; --card-border:${selected ? accent : "#EBE6DC"}">
      <div class="card-head">
        <span class="type-tag">${escapeHtml(typeLabel)}</span>
        ${selected ? selectedTemplate(accent) : ""}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(card.title)}</div>
        <div class="metric-pills">
          ${cardPills(card).map((pill) => `<span class="metric-pill">${escapeHtml(pill)}</span>`).join("")}
        </div>
        <p class="card-reason">${escapeHtml(card.reason || card.subtitle || "")}</p>
        <div class="card-actions">
          <button class="card-button" type="button" data-action="${escapeHtml(card.primaryAction.action)}" data-card-id="${escapeHtml(card.id)}">${escapeHtml(primaryLabel(card))}</button>
          <button class="ghost-button" type="button" ${secondaryAction === "refresh" ? `data-refresh="${escapeHtml(card.type)}"` : `data-copy-card-keywords="${escapeHtml(card.id)}"`} data-card-id="${escapeHtml(card.id)}">${escapeHtml(secondaryLabel)}</button>
        </div>
      </div>
    </article>
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
  elements.generationStatus.textContent = generationStatusText();
  elements.generationStatus.dataset.state = state.isGenerating
    ? "loading"
    : state.generationError
      ? "error"
      : "ready";
}

function generationStatusText() {
  if (state.isGenerating) return "正在按你的画像生成...";
  if (state.generationError) return state.generationError;
  if (state.apiAvailable) return "已根据画像生成";
  return "当前为本地方案";
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

function selectCard(card) {
  state.selectedCardId = card.id;
  recordSelectedMeal(state, card);
  persist();
  syncMemory();
  render();
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

function openRecipe(card) {
  state.selectedRecipeId = card.id;
  state.view = "recipe";
  state.checkedIngredients[card.id] ??= [];
  state.doneSteps[card.id] ??= [];
  persist();
  render();
}

function renderRecipePage() {
  if (currentView() !== "recipe") return;
  const card = getCard(state.selectedRecipeId) ?? state.cards.find((item) => item.type === "cook");
  if (!card) {
    setView("today");
    return;
  }
  const checked = state.checkedIngredients[card.id] ?? [];
  const doneSteps = state.doneSteps[card.id] ?? [];
  const grouped = groupIngredients(card.ingredients);
  elements.recipeScreen.innerHTML = `
    <header class="flow-top-bar simple">
      <button class="icon-button back-button" type="button" data-recipe-back aria-label="返回">
        ${chevronLeftIcon()}
      </button>
      <button class="icon-button favorite-button" type="button" aria-label="收藏">
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
      <section class="detail-card">
        <h2>食材</h2>
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

function openPlatform(card) {
  openActionPlan(card);
  showToast("已准备好平台入口和关键词");
}

function openActionPlan(card) {
  const plan = buildActionPlan(card, state.profile);
  elements.actionContent.innerHTML = `
    <h2 class="sheet-title">${escapeHtml(plan.title)}</h2>
    <p>${escapeHtml(plan.summary)}</p>
    <div class="keyword-row" aria-label="搜索关键词">
      ${plan.keywordChips.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join("")}
    </div>
    <div class="platform-action-list">
      ${plan.actions
        .map(
          (action) => `
            <a class="platform-action" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer">
              <strong>${escapeHtml(action.label)}</strong>
              <span>${escapeHtml(platformLabel(action.platform))} · ${escapeHtml(action.helper)}</span>
            </a>
          `
        )
        .join("")}
    </div>
    <button class="ghost-button full-width" type="button" data-copy-keywords="${escapeHtml(card.id)}">复制搜索词</button>
    <h3>下单前看一眼</h3>
    <ul class="action-checklist">
      ${plan.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
  openSheet("actionSheet");
}

function copyShoppingList(card) {
  const text = card.ingredients.map((item) => `${item.name} ${item.amount}`).join("\n");
  copyText(text);
  showToast("购物清单已复制");
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

function openHistory() {
  elements.historyContent.innerHTML = historyTemplate(buildHistorySummary(state));
  openSheet("historySheet");
}

function historyTemplate(summary) {
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
      <div><strong>${summary.feedbackCount}</strong><span>反馈次数</span></div>
      <div><strong>${summary.positiveFeedbackCount}</strong><span>喜欢</span></div>
      <div><strong>${summary.negativeFeedbackCount}</strong><span>避雷</span></div>
    </div>
    <h3>最近吃过</h3>
    ${historyMealList(summary.recentMeals)}
    <h3>偏好学习</h3>
    ${historyChipSection("喜欢", summary.likedKeywords)}
    ${historyChipSection("少推荐", summary.avoidedKeywords)}
    ${historyChipSection("约束", summary.constraints)}
  `;
}

function historyMealList(meals) {
  if (!meals.length) return `<p class="empty-state compact">还没有选择记录。</p>`;

  return `
    <div class="history-list">
      ${meals
        .map(
          (meal) => `
            <article class="history-item">
              <div>
                <strong>${escapeHtml(meal.title)}</strong>
                <span>${escapeHtml(meal.typeLabel)} · ${escapeHtml(formatHistoryTime(meal.selectedAt))}</span>
              </div>
              <small>${escapeHtml((meal.searchKeywords ?? []).slice(0, 3).join(" / "))}</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;
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
    } catch {
      showToast("后端换菜失败,已用本地方案");
    }
  }

  const next = refreshCard(type, state.context.mood, currentId);
  state.cards = state.cards.map((card) => (card.id === currentId ? next : card));
  persist();
  render();
}

function refreshAll() {
  if (state.isGenerating) return;

  state.cards = state.cards.map((card) => refreshCard(card.type, state.context.mood, card.id));
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
  saveProfile(state.userId, state.profile).catch(() => showToast("画像已本地保存,后端稍后同步"));
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
  saveProfile(state.userId, state.profile).catch(() => showToast("设置已本地保存,后端稍后同步"));
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
  state.draftProfile = createDraftProfile(defaultProfile);
  state.view = "onboarding";
  state.onboardingStep = 0;
  state.settingsPicker = null;
  state.clearDataArmed = false;
  state.recentMeals = [];
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
  const refreshButton = event.target.closest("[data-refresh]");
  const copyCardButton = event.target.closest("[data-copy-card-keywords]");

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
    const plan = buildActionPlan(card, state.profile);
    copyText(plan.searchText);
    showToast("关键词已复制");
  }
});

elements.topRecommendation.addEventListener("click", (event) => {
  const button = event.target.closest("[data-primary]");
  if (!button) return;
  if (state.isGenerating) return;
  selectCard(getCard(button.dataset.primary));
});

elements.regenerateButton.addEventListener("click", () => regenerateDecision("manual"));

elements.refreshAllButton.addEventListener("click", refreshAll);

elements.historyButton.addEventListener("click", openHistory);

elements.onboardingScreen.addEventListener("click", (event) => {
  const option = event.target.closest("[data-onboarding-field]");
  const taboo = event.target.closest("[data-onboarding-taboo]");
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
  const card = getCard(state.selectedRecipeId);
  const ingredient = event.target.closest("[data-ingredient-id]");
  const step = event.target.closest("[data-step-index]");
  if (event.target.closest("[data-recipe-back]")) {
    setView("today");
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
    window.open(buildSearchUrl("xiaoxiang", card.searchKeywords), "_blank", "noopener,noreferrer");
    return;
  }
  if (event.target.closest("[data-recipe-done]") && card) {
    showFeedback(card.id);
  }
});

document.body.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close]");
  const feedbackButton = event.target.closest("[data-feedback]");
  const feedbackTag = event.target.closest("[data-feedback-tag]");
  const copyKeywordsButton = event.target.closest("[data-copy-keywords]");

  if (closeButton) closeSheet(closeButton.dataset.close);
  if (copyKeywordsButton) {
    const card = getCard(copyKeywordsButton.dataset.copyKeywords);
    const plan = buildActionPlan(card, state.profile);
    copyText(plan.searchText);
    showToast("搜索词已复制");
  }
  if (feedbackButton) showFeedback(feedbackButton.dataset.feedback);
  if (feedbackTag) {
    const card = getCard(feedbackTag.dataset.cardId);
    const feedback = {
      cardId: feedbackTag.dataset.cardId,
      tag: feedbackTag.dataset.feedbackTag,
      createdAt: new Date().toISOString()
    };
    state.feedback.push(feedback);
    if (card) {
      recordFeedbackLearning(state, card, feedback.tag, feedback.createdAt);
    }
    persist();
    syncMemory();
    if (state.decisionId) {
      submitFeedback({
        decisionId: state.decisionId,
        userId: state.userId,
        cardId: feedback.cardId,
        tag: feedback.tag
      }).catch(() => showToast("反馈已本地记录,后端稍后同步"));
    }
    closeSheet("feedbackSheet");
    showToast("反馈已记录,正在更新推荐");
    regenerateDecision("feedback");
  }
});

elements.settingsButton.addEventListener("click", openSettingsPage);

render();
initializeFromBackend();
