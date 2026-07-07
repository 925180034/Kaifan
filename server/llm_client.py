import json
import urllib.error
import urllib.request


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
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.transport = transport or self._default_transport

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

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt()},
                {"role": "user", "content": user_prompt(profile, context)},
            ],
            "response_format": {"type": "json_object"},
            "stream": False,
            "temperature": 0.7,
            "max_tokens": 2600,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        response = self.transport(
            f"{self.base_url}/chat/completions",
            headers,
            payload,
            self.timeout,
        )
        content = response["choices"][0]["message"].get("content", "")
        if not content.strip():
            raise ValueError("DeepSeek returned empty content")

        parsed = json.loads(content)
        cards = parsed.get("cards")
        validate_cards(cards)
        return normalize_cards(cards)

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
今日情境 JSON 可能包含 feedbackLearning, 其中 likedKeywords 可适度靠近, avoidedKeywords 和 constraints 应明显减少或规避。
如果 recentMeals 与 likedKeywords 冲突, 优先保持新鲜感, 用相近但不同的食材或做法替代。
""".strip()


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
    return (
        "请根据用户画像和今日情境生成晚餐三选一 JSON。\n"
        f"用户画像 JSON: {json.dumps(profile, ensure_ascii=False)}\n"
        f"今日情境 JSON: {json.dumps(context, ensure_ascii=False)}\n"
        f"JSON 示例: {json.dumps(example, ensure_ascii=False)}"
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
        if not isinstance(card["searchKeywords"], list) or not card["searchKeywords"]:
            raise ValueError("searchKeywords must be a non-empty list")
        if not isinstance(card["primaryAction"], dict):
            raise ValueError("primaryAction must be an object")
        if card["type"] == "cook":
            for field in ["ingredients", "steps", "nutritionSummary", "difficulty", "complexity"]:
                if field not in card:
                    raise ValueError(f"Cook card missing {field}")


def normalize_cards(cards):
    action_by_type = {
        "cook": {"label": "看菜谱", "action": "view_recipe", "accent": "green"},
        "takeout": {"label": "去美团搜", "action": "open_meituan", "accent": "amber"},
        "dine_out": {"label": "去点评搜", "action": "open_dianping", "accent": "blue"},
    }
    normalized = []
    for card in cards:
        next_card = dict(card)
        spec = action_by_type[next_card["type"]]
        next_card["primaryAction"] = {"label": spec["label"], "action": spec["action"]}
        next_card["accent"] = spec["accent"]
        normalized.append(next_card)
    return normalized
