from copy import deepcopy
from uuid import uuid4

from .sample_data import DINE_OUT_OPTIONS, INITIAL_DECISION_CARDS, RECIPE_OPTIONS, TAKEOUT_OPTIONS


OPTION_POOLS = {
    "cook": RECIPE_OPTIONS,
    "takeout": TAKEOUT_OPTIONS,
    "dine_out": DINE_OUT_OPTIONS,
}


def score_card(card, context):
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

    return score


def rank_cards(cards, context):
    scored = []
    for card in cards:
        next_card = deepcopy(card)
        next_card["score"] = score_card(next_card, context)
        scored.append(next_card)
    return sorted(scored, key=lambda card: (-card["score"], card.get("estimatedCostPerPerson", 0)))


def refresh_card(card_type, mood="normal", current_id=None):
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
    return deepcopy((preferred or [option for option in pool if option["id"] != current_id] or pool)[0])


def build_decision(profile, context, cards=None, llm_client=None):
    selected_cards = maybe_generate_llm_cards(profile, context, cards, llm_client)
    ranked = rank_cards(selected_cards, context)
    return {
        "decisionId": str(uuid4()),
        "profile": deepcopy(profile),
        "context": deepcopy(context),
        "cards": selected_cards,
        "topRecommendation": ranked[0],
    }


def maybe_generate_llm_cards(profile, context, cards=None, llm_client=None):
    if cards is not None:
        return deepcopy(cards)
    if llm_client and llm_client.is_configured():
        try:
            return deepcopy(llm_client.generate_cards(profile, context))
        except Exception:
            return deepcopy(INITIAL_DECISION_CARDS)
    return deepcopy(INITIAL_DECISION_CARDS)
