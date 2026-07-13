const maxFavoriteMeals = 12;
const maxKeywords = 16;

export function toggleFavoriteMeal(state, card, timestamp = new Date().toISOString()) {
  const existing = state.favoriteMeals ?? [];
  const isActive = existing.some((meal) => meal.id === card.id);
  if (isActive) {
    state.favoriteMeals = existing.filter((meal) => meal.id !== card.id);
    return false;
  }

  state.favoriteMeals = [
    compactFavorite(card, timestamp),
    ...existing.filter((meal) => meal.id !== card.id)
  ].slice(0, maxFavoriteMeals);
  return true;
}

export function isFavoriteMeal(state, cardId) {
  return Boolean((state.favoriteMeals ?? []).some((meal) => meal.id === cardId));
}

export function favoriteHasRecipeDetails(favorite) {
  return Boolean(
    favorite?.type === "cook" &&
      Array.isArray(favorite.ingredients) &&
      favorite.ingredients.length &&
      Array.isArray(favorite.steps) &&
      favorite.steps.length
  );
}

export function findRecipeCard(cards = [], favoriteMeals = [], id, options = {}) {
  const currentCard = (cards ?? []).find((card) => card.id === id);
  const favoriteRecipe = (favoriteMeals ?? []).find((meal) => meal.id === id && favoriteHasRecipeDetails(meal));
  return options.preferFavorite ? favoriteRecipe ?? currentCard : currentCard ?? favoriteRecipe;
}

export function hydrateFavoriteRecipeDetails(state, cards = []) {
  const recipesById = new Map(
    (cards ?? [])
      .filter(favoriteHasRecipeDetails)
      .map((card) => [card.id, card])
  );
  if (!recipesById.size || !(state.favoriteMeals ?? []).length) return false;

  let changed = false;
  state.favoriteMeals = state.favoriteMeals.map((favorite) => {
    if (favoriteHasRecipeDetails(favorite)) return favorite;
    const recipe = recipesById.get(favorite.id);
    if (!recipe) return favorite;
    changed = true;
    return compactFavorite(recipe, favorite.favoritedAt);
  });

  return changed;
}

function compactFavorite(card, favoritedAt) {
  const favorite = {
    id: card.id,
    type: card.type,
    title: card.title,
    searchKeywords: compactKeywords(card.searchKeywords),
    favoritedAt
  };

  if (favoriteHasRecipeDetails(card)) {
    favorite.subtitle = card.subtitle ?? "";
    favorite.reason = card.reason ?? "";
    favorite.costText = card.costText ?? "";
    favorite.timeText = card.timeText ?? "";
    favorite.difficulty = card.difficulty ?? "";
    favorite.nutritionSummary = deepClone(card.nutritionSummary ?? {});
    favorite.ingredients = deepClone(card.ingredients ?? []);
    favorite.steps = [...(card.steps ?? [])];
    favorite.primaryAction = { ...(card.primaryAction ?? {}) };
  }

  return favorite;
}

function compactKeywords(values) {
  return [...new Set(values ?? [])]
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, maxKeywords);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
