from copy import deepcopy
from uuid import uuid4

import re

from .sample_data import DINE_OUT_OPTIONS, INITIAL_DECISION_CARDS, RECIPE_OPTIONS, TAKEOUT_OPTIONS


OPTION_POOLS = {
    "cook": RECIPE_OPTIONS,
    "takeout": TAKEOUT_OPTIONS,
    "dine_out": DINE_OUT_OPTIONS,
}


def score_card(card, context):
    context = context or {}
    score = card.get("baseScore", 0)
    mood = context.get("mood", "normal")
    weather = context.get("weather", {})

    if weather.get("isRaining"):
        if card["type"] == "takeout":
            score += 12
        if card["type"] == "dine_out":
            score -= 14
        if card["type"] == "cook":
            score += 4

    if mood == "lazy":
        if card["type"] == "cook" and card.get("complexity") == "easy":
            score += 16
        if card.get("estimatedMinutes", 0) > 45:
            score -= 18
        if card["type"] == "dine_out":
            score -= 8

    if mood == "treat":
        if card["type"] == "dine_out":
            score += 14
        if card.get("complexity") == "rich":
            score += 10

    score += feedback_learning_score(card, context.get("feedbackLearning"))
    score += recent_meal_score(card, context.get("recentMeals", []))

    return score


def rank_cards(cards, context):
    scored = []
    for card in cards:
        next_card = deepcopy(card)
        next_card["score"] = score_card(next_card, context)
        scored.append(next_card)
    return sorted(scored, key=lambda card: (-card["score"], card.get("estimatedCostPerPerson", 0)))


def feedback_learning_score(card, feedback_learning):
    if not isinstance(feedback_learning, dict):
        return 0

    liked_terms = useful_terms(feedback_learning.get("likedKeywords", []))
    avoided_terms = useful_terms(feedback_learning.get("avoidedKeywords", []))
    score = 0

    liked_matches = matching_terms(card, liked_terms)
    if liked_matches:
        score += min(24, 18 + 4 * (len(liked_matches) - 1))

    avoided_matches = matching_terms(card, avoided_terms)
    if avoided_matches:
        score -= min(54, 22 * len(avoided_matches))

    constraints = " ".join(as_list(feedback_learning.get("constraints", [])))
    if "少油少盐" in constraints and card.get("type") != "dine_out":
        if matching_terms(card, ["清淡", "少油", "轻食"]):
            score += 8
        if matching_terms(card, ["麻辣", "炸", "重口", "牛腩"]):
            score -= 12
    if "控制预算" in constraints and number_or_zero(card.get("estimatedCostPerPerson")) <= 35:
        score += 10
    if "优先简单省事" in constraints and number_or_zero(card.get("estimatedMinutes")) <= 30:
        score += 10
    if "提高满足感" in constraints and matching_terms(card, ["蛋白", "主食", "米饭", "牛肉", "鸡胸", "虾仁"]):
        score += 8

    return score


def recent_meal_score(card, recent_meals):
    if not isinstance(recent_meals, list):
        return 0

    score = 0
    card_id = str(card.get("id", ""))
    for index, meal in enumerate(recent_meals[:5]):
        if not isinstance(meal, dict):
            continue
        recency_weight = max(1, 5 - index)
        if card_id and card_id == str(meal.get("id", "")):
            score -= 26 + recency_weight * 2
            continue

        meal_terms = useful_terms([meal.get("title"), *as_list(meal.get("searchKeywords", []))])
        overlap = matching_terms(card, meal_terms)
        if overlap:
            score -= min(26, 7 * len(overlap) + recency_weight)

    return score


def matching_terms(card, terms):
    text = card_text(card)
    return [term for term in terms if term and term in text]


def card_text(card):
    values = [
        card.get("id"),
        card.get("title"),
        card.get("subtitle"),
        card.get("reason"),
        *as_list(card.get("searchKeywords", [])),
    ]
    values.extend(ingredient.get("name") for ingredient in card.get("ingredients", []) if isinstance(ingredient, dict))
    return " ".join(str(value or "").lower() for value in values)


def useful_terms(values):
    ignored = {"附近", "高评分", "双人", "人均100以内", "不排队"}
    terms = []
    seen = set()
    for value in as_list(values):
        for part in re.split(r"[、,，/\s]+", str(value or "")):
            term = part.strip().lower()
            if len(term) < 2 or term in ignored or term in seen:
                continue
            seen.add(term)
            terms.append(term)
    return terms


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def number_or_zero(value):
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return value
    match = re.search(r"\d+", str(value or ""))
    return int(match.group(0)) if match else 0


def refresh_card(card_type, mood="normal", current_id=None, context=None):
    pool = OPTION_POOLS.get(card_type, [])
    preferred = []
    for option in pool:
        if option["id"] == current_id:
            continue
        if card_type == "cook" and mood == "lazy" and option.get("complexity") != "easy":
            continue
        if card_type == "cook" and mood == "treat" and option.get("complexity") == "easy":
            continue
        preferred.append(option)
    candidates = preferred or [option for option in pool if option["id"] != current_id] or pool
    ranking_context = {**(context or {}), "mood": mood}
    ranked = rank_cards(candidates, ranking_context)
    return deepcopy(ranked[0])


def build_decision(profile, context, cards=None, llm_client=None):
    selected_cards, generation_source, fallback_reason = resolve_decision_cards(
        profile,
        context,
        cards,
        llm_client,
    )
    ranked = rank_cards(selected_cards, context)
    decision = {
        "decisionId": str(uuid4()),
        "profile": deepcopy(profile),
        "context": deepcopy(context),
        "cards": selected_cards,
        "topRecommendation": ranked[0],
        "generationSource": generation_source,
    }
    if fallback_reason:
        decision["fallbackReason"] = fallback_reason
    return decision


def maybe_generate_llm_cards(profile, context, cards=None, llm_client=None):
    selected_cards, _, _ = resolve_decision_cards(profile, context, cards, llm_client)
    return selected_cards


def resolve_decision_cards(profile, context, cards=None, llm_client=None):
    if cards is not None:
        return deepcopy(cards), "provided", None
    if llm_client and llm_client.is_configured():
        try:
            return deepcopy(llm_client.generate_cards(profile, context)), "llm", None
        except Exception as exc:
            return deepcopy(INITIAL_DECISION_CARDS), "fallback", sanitize_fallback_reason(exc)
    return deepcopy(INITIAL_DECISION_CARDS), "fallback", "llm_not_configured"


def sanitize_fallback_reason(exc):
    message = str(exc or "").lower()
    if isinstance(exc, ValueError):
        return "llm_validation_failed"
    if isinstance(exc, RuntimeError) or re.search(r"(deepseek|api|http|401|403|429|timeout|network|connection|token|key|bearer|sk-)", message):
        return "llm_provider_error"
    return "llm_generation_failed"
