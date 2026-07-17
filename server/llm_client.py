import json
import re
import time
import urllib.error
import urllib.request


TYPE_ORDER = ["cook", "takeout", "dine_out"]

ACTION_BY_TYPE = {
    "cook": {"label": "看菜谱", "action": "view_recipe", "accent": "green"},
    "takeout": {"label": "去美团搜", "action": "open_meituan", "accent": "amber"},
    "dine_out": {"label": "去点评搜", "action": "open_dianping", "accent": "blue"},
}

REQUIRED_CARD_FIELDS = {
    "id",
    "type",
    "title",
    "reason",
    "costText",
    "timeText",
    "accent",
    "searchKeywords",
    "primaryAction",
}


class DeepSeekClient:
    def __init__(
        self,
        api_key="",
        model="deepseek-v4-flash",
        base_url="https://api.deepseek.com",
        timeout=20,
        transport=None,
        max_attempts=2,
        sleep=time.sleep,
        retry_delay_seconds=0.5,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.transport = transport or self._default_transport
        self.max_attempts = max(1, int(max_attempts))
        self.sleep = sleep
        self.retry_delay_seconds = float(retry_delay_seconds)

    @classmethod
    def from_env(cls):
        from .config import deepseek_settings

        settings = deepseek_settings()
        return cls(
            api_key=settings["api_key"],
            model=settings["model"],
            base_url=settings["base_url"],
        )

    def is_configured(self):
        return bool(self.api_key)

    def generate_cards(self, profile, context):
        if not self.is_configured():
            raise RuntimeError("DeepSeek API key is not configured")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        last_error = None
        for attempt_index in range(self.max_attempts):
            payload = {
                "model": self.model,
                "messages": request_messages(profile, context, last_error),
                "response_format": {"type": "json_object"},
                "stream": False,
                "temperature": 0.7,
                "max_tokens": 2600,
            }
            try:
                response = self.transport(
                    f"{self.base_url}/chat/completions",
                    headers,
                    payload,
                    self.timeout,
                )
                content = response["choices"][0]["message"].get("content", "")
                if not content.strip():
                    raise ValueError("DeepSeek returned empty content")

                parsed = parse_json_content(content)
                cards = parsed.get("cards")
                validate_cards(cards)
                normalized = normalize_cards(cards)
                validate_profile_constraints(normalized, profile, context)
                return normalized
            except (ValueError, RuntimeError, urllib.error.URLError, TimeoutError, OSError) as exc:
                last_error = exc
                if attempt_index == self.max_attempts - 1:
                    raise
                self.sleep(self.retry_delay_seconds * (attempt_index + 1))

        raise last_error or ValueError("DeepSeek card generation failed")

    def _default_transport(self, url, headers, payload, timeout):
        request = urllib.request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"DeepSeek API error {exc.code}: {body}") from exc


def parse_json_content(content):
    text = str(content or "").strip()
    last_error = None
    for candidate in json_content_candidates(text):
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc
            continue
        if not isinstance(parsed, dict):
            raise ValueError("DeepSeek JSON root must be an object")
        return parsed

    detail = f": {last_error}" if last_error else ""
    raise ValueError(f"DeepSeek returned invalid JSON{detail}")


def json_content_candidates(text):
    seen = set()
    for candidate in [text, *markdown_json_blocks(text), extract_first_json_object(text)]:
        candidate = str(candidate or "").strip()
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        yield candidate


def markdown_json_blocks(text):
    pattern = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
    return [match.group(1) for match in pattern.finditer(text)]


def extract_first_json_object(text):
    start = text.find("{")
    if start < 0:
        return ""

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return ""


def system_prompt():
    return """
你是一个晚餐决策助手。你必须输出严格 JSON, 不要 Markdown, 不要解释。
JSON 根对象必须是 {"cards": [...]}。
cards 必须恰好 3 个, 类型分别是 cook、takeout、dine_out。
每张卡都必须包含这些字段:
id,type,title,subtitle,reason,estimatedMinutes,estimatedCostPerPerson,costText,timeText,baseScore,accent,searchKeywords,primaryAction。
cook 卡还必须包含 difficulty, complexity, nutritionSummary, ingredients, steps。
accent 只能是 green、amber、blue。
primaryAction 必须包含 label 和 action。
不要推荐违反忌口或过敏的食材。
今日情境 JSON 可能包含 recentMeals, 代表用户最近选择过的晚餐; 应避免重复相同或高度相似的菜名、食材关键词和外卖/到店类型。
今日情境 JSON 可能包含 favoriteMeals, 代表用户收藏的常吃方案和长期偏好; 可参考其食材、口味和复杂度, 但不要机械重复同一道菜。
今日情境 JSON 可能包含 feedbackLearning, 其中 likedKeywords 可适度靠近, avoidedKeywords 和 constraints 应明显减少或规避。
如果 recentMeals 与 likedKeywords 冲突, 优先保持新鲜感, 用相近但不同的食材或做法替代。
""".strip()


def request_messages(profile, context, validation_error=None):
    messages = [
        {"role": "system", "content": system_prompt()},
        {"role": "user", "content": user_prompt(profile, context)},
    ]
    if validation_error:
        messages.append({"role": "user", "content": retry_prompt(validation_error, profile, context)})
    return messages


def user_prompt(profile, context):
    example = {
        "cards": [
            {
                "id": "llm-cook-example",
                "type": "cook",
                "title": "番茄虾仁豆腐饭 + 拍黄瓜",
                "subtitle": "25 分钟快手家常",
                "reason": "符合用户喜欢虾仁和豆腐的偏好。",
                "estimatedMinutes": 25,
                "estimatedCostPerPerson": 28,
                "costText": "约¥28/人",
                "timeText": "25分钟",
                "difficulty": "easy",
                "complexity": "easy",
                "baseScore": 82,
                "accent": "green",
                "nutritionSummary": {
                    "calories": "约620 kcal/人",
                    "protein": "约34g/人",
                    "note": "蛋白质充足,油脂适中",
                },
                "ingredients": [{"name": "虾仁", "amount": "200g", "group": "肉蛋奶"}],
                "steps": ["番茄炒出汁,加入豆腐和虾仁煮熟。"],
                "searchKeywords": ["番茄", "虾仁", "豆腐"],
                "primaryAction": {"label": "看菜谱", "action": "view_recipe"},
            }
        ]
    }
    forbidden_terms = profile_terms(profile, context)
    forbidden_text = "、".join(forbidden_terms) if forbidden_terms else "无"
    return (
        "请根据用户画像和今日情境生成晚餐三选一 JSON。\n"
        f"必须严格避开的忌口/过敏词: {forbidden_text}。\n"
        "这些词不能出现在菜名、理由、食材、步骤或搜索关键词中, 也不能推荐包含这些词的近义食材。\n"
        f"用户画像 JSON: {json.dumps(profile, ensure_ascii=False)}\n"
        f"今日情境 JSON: {json.dumps(context, ensure_ascii=False)}\n"
        f"JSON 示例: {json.dumps(example, ensure_ascii=False)}"
    )


def retry_prompt(validation_error, profile, context):
    forbidden_terms = profile_terms(profile, context)
    forbidden_text = "、".join(forbidden_terms) if forbidden_terms else "无"
    return (
        "上一次输出未通过校验。\n"
        f"校验错误: {validation_error}\n"
        f"必须严格避开的忌口/过敏词: {forbidden_text}。\n"
        "请重新输出完整 JSON, 仍然必须是 {\"cards\": [...]} 根对象。\n"
        "不要解释, 不要 Markdown, 不要复用不合规菜名。\n"
        "如果错误涉及 recentMeals, 请换成不同菜名、不同主食材或不同店铺类型。"
    )


def validate_cards(cards):
    if not isinstance(cards, list) or len(cards) != 3:
        raise ValueError("LLM response must contain exactly three cards")

    types = {card.get("type") for card in cards if isinstance(card, dict)}
    if types != {"cook", "takeout", "dine_out"}:
        raise ValueError("LLM cards must include cook, takeout, and dine_out")

    for card in cards:
        if not isinstance(card, dict):
            raise ValueError("Each card must be an object")
        missing = REQUIRED_CARD_FIELDS - set(card)
        if missing:
            raise ValueError(f"Card {card.get('id', '<unknown>')} missing fields: {sorted(missing)}")
        if not unique_clean_list(card["searchKeywords"]):
            raise ValueError("searchKeywords must be a non-empty list or string")
        if not isinstance(card["primaryAction"], dict):
            raise ValueError("primaryAction must be an object")
        if card["type"] == "cook":
            for field in ["ingredients", "steps", "nutritionSummary", "difficulty", "complexity"]:
                if field not in card:
                    raise ValueError(f"Cook card missing {field}")


def normalize_cards(cards):
    cards_by_type = {card["type"]: card for card in cards}
    normalized = []
    for card_type in TYPE_ORDER:
        card = cards_by_type[card_type]
        next_card = dict(card)
        spec = ACTION_BY_TYPE[card_type]
        next_card["primaryAction"] = {"label": spec["label"], "action": spec["action"]}
        next_card["accent"] = spec["accent"]
        next_card["estimatedMinutes"] = coerce_int(next_card.get("estimatedMinutes"), "estimatedMinutes", next_card)
        next_card["estimatedCostPerPerson"] = coerce_int(
            next_card.get("estimatedCostPerPerson"),
            "estimatedCostPerPerson",
            next_card,
        )
        next_card["baseScore"] = max(0, min(100, coerce_int(next_card.get("baseScore"), "baseScore", next_card)))
        next_card["searchKeywords"] = unique_clean_list(next_card.get("searchKeywords"))
        if not next_card["searchKeywords"]:
            raise ValueError("searchKeywords must be a non-empty list")
        if card_type == "cook":
            next_card["ingredients"] = normalize_ingredients(next_card.get("ingredients"))
            next_card["steps"] = normalize_steps(next_card.get("steps"))
            if not next_card["ingredients"]:
                raise ValueError("Cook card ingredients must be non-empty")
            if not next_card["steps"]:
                raise ValueError("Cook card steps must be non-empty")
            nutrition_summary = normalize_nutrition_summary(next_card.get("nutritionSummary"))
            if nutrition_summary is None:
                raise ValueError("Cook card nutritionSummary must be an object or string")
            next_card["nutritionSummary"] = nutrition_summary
        normalized.append(next_card)
    return normalized


def coerce_int(value, field, card):
    if isinstance(value, bool):
        raise ValueError(f"Card {card.get('id', '<unknown>')} field {field} must be numeric")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    match = re.search(r"\d+", str(value or ""))
    if match:
        return int(match.group(0))
    raise ValueError(f"Card {card.get('id', '<unknown>')} field {field} must be numeric")


def unique_clean_list(values):
    if isinstance(values, str):
        raw_values = [values]
    elif isinstance(values, list):
        raw_values = values
    else:
        return []

    seen = set()
    result = []
    for value in raw_values:
        for text in split_list_text(value):
            if text in seen:
                continue
            seen.add(text)
            result.append(text)
    return result


def unique_clean_items(values):
    seen = set()
    result = []
    for value in values:
        text = str(value or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
    return result


def normalize_steps(values):
    if isinstance(values, str):
        raw_values = split_step_text(values)
    elif isinstance(values, list):
        raw_values = values
    else:
        return []
    return unique_clean_items(raw_values)


def split_step_text(value):
    text = str(value or "").strip()
    if not text:
        return []
    return [part.strip() for part in re.split(r"[\r\n]+", text) if part.strip()]


def split_list_text(value):
    text = str(value or "").strip()
    if not text:
        return []
    return [part.strip() for part in re.split(r"[、,，;；/|\r\n]+", text) if part.strip()]


def normalize_ingredients(values):
    if isinstance(values, str):
        raw_values = split_list_text(values)
    elif isinstance(values, list):
        raw_values = values
    else:
        return []

    normalized = []
    for item in raw_values:
        if isinstance(item, dict):
            name = str(item.get("name") or "").strip()
            amount = str(item.get("amount") or "").strip()
            group = str(item.get("group") or "食材").strip()
            if name and amount:
                normalized.append({"name": name, "amount": amount, "group": group or "食材"})
            continue

        parsed = parse_ingredient_text(item)
        if parsed:
            normalized.append(parsed)
    return normalized


def parse_ingredient_text(value):
    text = str(value or "").strip()
    if not text:
        return None

    separator_match = re.match(r"^(.+?)[\s:：-]+(.+)$", text)
    if separator_match:
        name, amount = separator_match.groups()
        return ingredient_from_parts(name, amount)

    amount_match = re.search(r"\d", text)
    if amount_match and amount_match.start() > 0:
        return ingredient_from_parts(text[: amount_match.start()], text[amount_match.start() :])

    return None


def ingredient_from_parts(name, amount):
    name = str(name or "").strip()
    amount = str(amount or "").strip()
    if not name or not amount:
        return None
    return {"name": name, "amount": amount, "group": "食材"}


def normalize_nutrition_summary(value):
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    summary = {"note": text}
    calories = extract_calories_text(text)
    protein = extract_protein_text(text)
    if calories:
        summary["calories"] = calories
    if protein:
        summary["protein"] = protein
    return summary


def extract_calories_text(text):
    match = re.search(r"(约?\s*\d+(?:\.\d+)?\s*(?:kcal|千卡|大卡)(?:/人)?)", text, re.IGNORECASE)
    return normalize_inline_space(match.group(1)) if match else ""


def extract_protein_text(text):
    match = re.search(r"蛋白(?:质)?[^0-9约]*(约?\s*\d+(?:\.\d+)?\s*(?:g|克)(?:/人)?)", text, re.IGNORECASE)
    return normalize_inline_space(match.group(1)) if match else ""


def normalize_inline_space(value):
    return re.sub(r"\s+", " ", str(value or "").strip())


def validate_profile_constraints(cards, profile, context):
    forbidden_terms = profile_terms(profile, context)
    for card in cards:
        searchable = normalize_text(card_search_text(card))
        for term in forbidden_terms:
            if normalize_text(term) in searchable:
                raise ValueError(f"LLM card contains forbidden food: {term}")

    recent_titles = [
        meal.get("title")
        for meal in (context or {}).get("recentMeals", [])
        if isinstance(meal, dict) and meal.get("title")
    ]
    recent_texts = {normalize_text(title) for title in recent_titles}
    for card in cards:
        if normalize_text(card.get("title")) in recent_texts:
            raise ValueError(f"LLM card repeats recent meal: {card.get('title')}")


def profile_terms(profile, context=None):
    source = profile or {}
    feedback_learning = (context or {}).get("feedbackLearning") if isinstance(context, dict) else {}
    raw_terms = [
        *safe_list(source.get("allergies")),
        *safe_list(source.get("dislikes")),
        *safe_list(source.get("taboos")),
        *safe_list((feedback_learning or {}).get("avoidedKeywords")),
    ]
    expanded_terms = []
    for term in unique_clean_list(raw_terms):
        expanded_terms.extend(expand_profile_term(term))
    return [term for term in unique_clean_list(expanded_terms) if term != "其他"]


def expand_profile_term(term):
    text = str(term or "").strip()
    if not text or text == "其他":
        return []

    terms = [text]
    for suffix in ["过敏", "不耐受", "不耐"]:
        if text.endswith(suffix):
            terms.append(text[: -len(suffix)])

    if text.startswith("不吃"):
        without_prefix = text[2:].strip()
        if without_prefix:
            terms.append(without_prefix)
            if without_prefix == "牛羊":
                terms.extend(["牛", "羊", "牛肉", "羊肉"])
    return [value for value in terms if value]


def safe_list(value):
    return value if isinstance(value, list) else []


def card_search_text(card):
    values = [
        card.get("title"),
        card.get("subtitle"),
        card.get("reason"),
        *card.get("searchKeywords", []),
    ]
    if card.get("type") == "cook":
        values.extend(item.get("name") for item in card.get("ingredients", []) if isinstance(item, dict))
        values.extend(card.get("steps", []))
        nutrition_summary = card.get("nutritionSummary")
        if isinstance(nutrition_summary, dict):
            values.extend(nutrition_summary.values())
        elif nutrition_summary:
            values.append(nutrition_summary)
    return " ".join(str(value or "") for value in values)


def normalize_text(value):
    return re.sub(r"\s+", "", str(value or "").lower())
