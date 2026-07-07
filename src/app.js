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
import { buildSearchUrl, formatKeywords } from "./platformLinks.js";
import { buildProfileSummary, formatListInput, parseListInput } from "./profile.js";
import { loadState, saveState } from "./storage.js";
import {
  fetchTodayDecision,
  refreshDecisionCard,
  saveProfile,
  selectDecisionCard,
  submitFeedback
} from "./apiClient.js";

const stateKey = "kaifan.mvp.state";

const feedbackOptions = ["好吃,下次还吃", "太贵", "太麻烦", "没吃饱", "太油/太咸", "不合口味"];

const accentColors = {
  green: "#2f8f4e",
  amber: "#d97706",
  blue: "#1f6fa7"
};

const state = loadState(stateKey, {
  userId: null,
  decisionId: null,
  profile: defaultProfile,
  context: defaultDailyContext,
  cards: cloneCards(initialDecisionCards),
  selectedCardId: null,
  feedback: [],
  apiAvailable: false,
  isGenerating: false,
  generationError: "",
  requestSequence: 0,
  activeRequestId: 0
});

if (!state.userId) {
  state.userId = globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`;
}

const elements = {
  profileSummary: document.querySelector("#profileSummary"),
  dateText: document.querySelector("#dateText"),
  moodButtons: [...document.querySelectorAll("[data-mood]")],
  topRecommendation: document.querySelector("#topRecommendation"),
  decisionList: document.querySelector("#decisionList"),
  regenerateButton: document.querySelector("#regenerateButton"),
  refreshAllButton: document.querySelector("#refreshAllButton"),
  generationStatus: document.querySelector("#generationStatus"),
  recipeSheet: document.querySelector("#recipeSheet"),
  recipeContent: document.querySelector("#recipeContent"),
  shoppingSheet: document.querySelector("#shoppingSheet"),
  shoppingContent: document.querySelector("#shoppingContent"),
  feedbackSheet: document.querySelector("#feedbackSheet"),
  feedbackTags: document.querySelector("#feedbackTags"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsSheet: document.querySelector("#settingsSheet"),
  settingsForm: document.querySelector("#settingsForm"),
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
  regenerateDecision("initial");
}

async function regenerateDecision(reason = "manual") {
  const requestId = startDecisionRequest(state);
  persist();
  render();

  try {
    const decision = await fetchTodayDecision({
      userId: state.userId,
      profile: state.profile,
      context: state.context
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  elements.profileSummary.textContent = buildProfileSummary(state.profile);
  elements.dateText.textContent = state.context.dateText;
  renderMood();
  renderTopRecommendation();
  renderCards();
  renderGenerationStatus();
  renderSettings();
}

function renderMood() {
  elements.moodButtons.forEach((button) => {
    const active = button.dataset.mood === state.context.mood;
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderTopRecommendation() {
  const top = getTopRecommendation(state.cards, state.context);
  elements.topRecommendation.innerHTML = `
    <div class="label">今晚最推荐</div>
    <h2>${escapeHtml(top.title)}</h2>
    <div class="metrics">
      <span class="metric">${clockIcon()} ${escapeHtml(top.timeText)}</span>
      <span class="metric">${walletIcon()} <strong>${escapeHtml(top.costText)}</strong></span>
    </div>
    <p>${escapeHtml(top.reason)}</p>
    <button class="primary-button" type="button" data-primary="${escapeHtml(top.id)}" ${state.isGenerating ? "disabled" : ""}>别问了,就这个</button>
  `;
}

function renderCards() {
  const ranked = rankDecisionCards(state.cards, state.context);
  elements.decisionList.innerHTML = ranked.map(cardTemplate).join("");
}

function cardTemplate(card) {
  const typeLabel = {
    cook: "自己做",
    takeout: "点外卖",
    dine_out: "出去吃"
  }[card.type];
  const accent = accentColors[card.accent] ?? accentColors.green;

  return `
    <article class="decision-card" data-card-id="${escapeHtml(card.id)}" data-accent="${escapeHtml(card.accent)}" style="--card-accent:${accent}">
      <div class="card-visual">${cardIcon(card.type)}</div>
      <div class="card-main">
        <h3>${typeLabel}</h3>
        <p><strong>${escapeHtml(card.title)}</strong></p>
        <p class="metric-row">${escapeHtml(card.timeText)} · ${escapeHtml(card.costText)}</p>
        <p>${escapeHtml(card.subtitle)}</p>
        <div class="card-actions">
          <button class="card-button" type="button" data-action="${escapeHtml(card.primaryAction.action)}" data-card-id="${escapeHtml(card.id)}" ${state.isGenerating ? "disabled" : ""}>${escapeHtml(card.primaryAction.label)}</button>
          <button class="ghost-button" type="button" data-refresh="${escapeHtml(card.type)}" data-card-id="${escapeHtml(card.id)}" ${state.isGenerating ? "disabled" : ""}>换这个</button>
        </div>
      </div>
    </article>
  `;
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

function renderSettings() {
  const form = elements.settingsForm;
  form.peopleCount.value = state.profile.peopleCount;
  form.spicyLevel.value = state.profile.spicyLevel;
  form.budgetPerPerson.value = state.profile.budgetPerPerson;
  form.cookingWillingness.value = state.profile.cookingWillingness ?? "normal";
  form.nutritionGoal.value = state.profile.nutritionGoal ?? "";
  form.tasteTags.value = formatListInput(state.profile.tasteTags);
  form.cuisinePreferences.value = formatListInput(state.profile.cuisinePreferences);
  form.favoriteIngredients.value = formatListInput(state.profile.favoriteIngredients);
  form.dislikes.value = formatListInput(state.profile.dislikes);
  form.allergies.value = formatListInput(state.profile.allergies);
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
  persist();
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
  elements.recipeContent.innerHTML = `
    <h2 class="recipe-title">${escapeHtml(card.title)}</h2>
    <p>${escapeHtml(card.reason)}</p>
    <div class="summary-grid">
      <div class="summary-item"><strong>${escapeHtml(card.timeText)}</strong><br />预计耗时</div>
      <div class="summary-item"><strong>${escapeHtml(card.costText)}</strong><br />预计成本</div>
      <div class="summary-item"><strong>${escapeHtml(card.nutritionSummary.protein)}</strong><br />蛋白质</div>
      <div class="summary-item"><strong>${escapeHtml(card.difficulty)}</strong><br />难度</div>
    </div>
    <h3>食材清单</h3>
    <div class="ingredient-list">
      ${card.ingredients
        .map(
          (item) => `
            <label>
              <span>${escapeHtml(item.name)} · ${escapeHtml(item.amount)}</span>
              <input type="checkbox" />
            </label>
          `
        )
        .join("")}
    </div>
    <h3>步骤</h3>
    <ol class="step-list">
      ${card.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
    </ol>
    <button class="primary-button" type="button" data-shopping="${escapeHtml(card.id)}">打开购物清单</button>
    <button class="ghost-button" type="button" data-feedback="${escapeHtml(card.id)}">做完了</button>
  `;
  openSheet("recipeSheet");
}

function openShoppingList(card) {
  const grouped = card.ingredients.reduce((groups, item) => {
    groups[item.group] ??= [];
    groups[item.group].push(item);
    return groups;
  }, {});

  elements.shoppingContent.innerHTML = `
    <h2>购物清单</h2>
    ${Object.entries(grouped)
      .map(
        ([group, items]) => `
          <h3>${escapeHtml(group)}</h3>
          <div class="ingredient-list">
            ${items
              .map(
                (item) => `
                  <label>
                    <span>${escapeHtml(item.name)} · ${escapeHtml(item.amount)}</span>
                    <input type="checkbox" />
                  </label>
                `
              )
              .join("")}
          </div>
        `
      )
      .join("")}
    <button class="primary-button" type="button" data-copy-list="${escapeHtml(card.id)}">复制购物清单</button>
    <button class="ghost-button" type="button" data-grocery="${escapeHtml(card.id)}">去小象搜</button>
  `;
  openSheet("shoppingSheet");
}

function openPlatform(card) {
  const platform = card.type === "takeout" ? "meituan" : "dianping";
  const url = buildSearchUrl(platform, card.searchKeywords);
  copyText(formatKeywords(card.searchKeywords));
  window.open(url, "_blank", "noopener,noreferrer");
  showToast("关键词已复制,正在打开搜索");
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

function cardIcon(type) {
  if (type === "takeout") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/><path d="M4 13h16"/></svg>`;
  }

  if (type === "dine_out") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16"/><path d="M6 10v10h12V10"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M9 20v-5h6v5"/></svg>`;
  }

  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h14l-1 8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3l-1-8Z"/><path d="M3 10h18"/><path d="M9 6c0-2 2-2 2-4"/><path d="M14 6c0-2 2-2 2-4"/></svg>`;
}

function clockIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>`;
}

function walletIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12"/><path d="M17 13h.01"/></svg>`;
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

  if (actionButton) {
    if (state.isGenerating) return;
    const card = getCard(actionButton.dataset.cardId);
    selectCard(card);
    return;
  }

  if (refreshButton) {
    if (state.isGenerating) return;
    refreshOne(refreshButton.dataset.refresh, refreshButton.dataset.cardId);
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

document.body.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close]");
  const shoppingButton = event.target.closest("[data-shopping]");
  const copyButton = event.target.closest("[data-copy-list]");
  const groceryButton = event.target.closest("[data-grocery]");
  const feedbackButton = event.target.closest("[data-feedback]");
  const feedbackTag = event.target.closest("[data-feedback-tag]");

  if (closeButton) closeSheet(closeButton.dataset.close);
  if (shoppingButton) openShoppingList(getCard(shoppingButton.dataset.shopping));
  if (copyButton) copyShoppingList(getCard(copyButton.dataset.copyList));
  if (groceryButton) {
    const card = getCard(groceryButton.dataset.grocery);
    window.open(buildSearchUrl("xiaoxiang", card.searchKeywords), "_blank", "noopener,noreferrer");
  }
  if (feedbackButton) showFeedback(feedbackButton.dataset.feedback);
  if (feedbackTag) {
    const feedback = {
      cardId: feedbackTag.dataset.cardId,
      tag: feedbackTag.dataset.feedbackTag,
      createdAt: new Date().toISOString()
    };
    state.feedback.push(feedback);
    persist();
    if (state.decisionId) {
      submitFeedback({
        decisionId: state.decisionId,
        userId: state.userId,
        cardId: feedback.cardId,
        tag: feedback.tag
      }).catch(() => showToast("反馈已本地记录,后端稍后同步"));
    }
    closeSheet("feedbackSheet");
    showToast("反馈已记录");
  }
});

elements.settingsButton.addEventListener("click", () => openSheet("settingsSheet"));

elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(elements.settingsForm);
  state.profile.peopleCount = form.get("peopleCount");
  state.profile.spicyLevel = form.get("spicyLevel");
  state.profile.budgetPerPerson = form.get("budgetPerPerson");
  state.profile.cookingWillingness = form.get("cookingWillingness");
  state.profile.nutritionGoal = String(form.get("nutritionGoal") ?? "").trim();
  state.profile.tasteTags = parseListInput(form.get("tasteTags"));
  state.profile.cuisinePreferences = parseListInput(form.get("cuisinePreferences"));
  state.profile.favoriteIngredients = parseListInput(form.get("favoriteIngredients"));
  state.profile.dislikes = parseListInput(form.get("dislikes"));
  state.profile.allergies = parseListInput(form.get("allergies"));
  persist();
  saveProfile(state.userId, state.profile).catch(() => showToast("设置已本地保存,后端稍后同步"));
  closeSheet("settingsSheet");
  showToast("设置已保存,正在重新生成");
  regenerateDecision("profile");
});

render();
initializeFromBackend();
