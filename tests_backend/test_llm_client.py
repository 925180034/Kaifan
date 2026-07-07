import unittest

from server.llm_client import DeepSeekClient, system_prompt
from server.recommender import build_decision
from server.sample_data import DEFAULT_CONTEXT, DEFAULT_PROFILE


def valid_cards():
    return [
        {
            "id": "llm-cook",
            "type": "cook",
            "title": "虾仁豆腐盖饭",
            "subtitle": "高蛋白快手饭",
            "reason": "符合你喜欢虾仁和豆腐的偏好。",
            "estimatedMinutes": 22,
            "estimatedCostPerPerson": 26,
            "costText": "约¥26/人",
            "timeText": "22分钟",
            "difficulty": "easy",
            "complexity": "easy",
            "baseScore": 82,
            "accent": "green",
            "nutritionSummary": {"calories": "约620 kcal/人", "protein": "约35g/人", "note": "蛋白质充足"},
            "ingredients": [{"name": "虾仁", "amount": "200g", "group": "肉蛋奶"}],
            "steps": ["炒熟虾仁和豆腐,盖在米饭上。"],
            "searchKeywords": ["虾仁", "豆腐"],
            "primaryAction": {"label": "看菜谱", "action": "view_recipe"},
        },
        {
            "id": "llm-takeout",
            "type": "takeout",
            "title": "热汤面",
            "subtitle": "雨天省心",
            "reason": "今晚下雨,外卖更省事。",
            "estimatedMinutes": 35,
            "estimatedCostPerPerson": 32,
            "costText": "约¥32/人",
            "timeText": "35分钟",
            "baseScore": 80,
            "accent": "amber",
            "searchKeywords": ["热汤面", "少油"],
            "primaryAction": {"label": "去美团搜", "action": "open_meituan"},
        },
        {
            "id": "llm-dine",
            "type": "dine_out",
            "title": "附近粤菜小馆",
            "subtitle": "清淡一点",
            "reason": "适合想吃好点但不想太油的晚上。",
            "estimatedMinutes": 70,
            "estimatedCostPerPerson": 88,
            "costText": "约¥88/人",
            "timeText": "70分钟",
            "baseScore": 64,
            "accent": "blue",
            "searchKeywords": ["附近", "粤菜"],
            "primaryAction": {"label": "去点评搜", "action": "open_dianping"},
        },
    ]


class DeepSeekClientTests(unittest.TestCase):
    def test_generate_cards_uses_flash_model_and_json_response_format(self):
        captured = {}

        def transport(url, headers, payload, timeout):
            captured["url"] = url
            captured["headers"] = headers
            captured["payload"] = payload
            captured["timeout"] = timeout
            return {"choices": [{"message": {"content": '{"cards": []}'}}]}

        client = DeepSeekClient(api_key="test-key", transport=transport)
        with self.assertRaises(ValueError):
            client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(captured["payload"]["model"], "deepseek-v4-flash")
        self.assertEqual(captured["payload"]["response_format"], {"type": "json_object"})
        self.assertEqual(captured["headers"]["Authorization"], "Bearer test-key")
        self.assertTrue(captured["url"].endswith("/chat/completions"))

    def test_generate_cards_parses_valid_deepseek_json(self):
        def transport(url, headers, payload, timeout):
            return {"choices": [{"message": {"content": '{"cards": ' + repr(valid_cards()).replace("'", '"') + "}"}}]}

        client = DeepSeekClient(api_key="test-key", transport=transport)

        cards = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(len(cards), 3)
        self.assertEqual({card["type"] for card in cards}, {"cook", "takeout", "dine_out"})

    def test_generate_cards_normalizes_primary_actions_for_frontend(self):
        cards = valid_cards()
        cards[1]["primaryAction"] = {"label": "点外卖", "action": "order_food"}
        cards[2]["primaryAction"] = {"label": "查看地图", "action": "view_map"}

        def transport(url, headers, payload, timeout):
            return {"choices": [{"message": {"content": '{"cards": ' + repr(cards).replace("'", '"') + "}"}}]}

        client = DeepSeekClient(api_key="test-key", transport=transport)

        normalized = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        takeout = next(card for card in normalized if card["type"] == "takeout")
        dine_out = next(card for card in normalized if card["type"] == "dine_out")
        self.assertEqual(takeout["primaryAction"], {"label": "去美团搜", "action": "open_meituan"})
        self.assertEqual(dine_out["primaryAction"], {"label": "去点评搜", "action": "open_dianping"})

    def test_build_decision_falls_back_when_llm_fails(self):
        class FailingClient:
            def is_configured(self):
                return True

            def generate_cards(self, profile, context):
                raise RuntimeError("network failed")

        decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT, llm_client=FailingClient())

        self.assertEqual(len(decision["cards"]), 3)
        self.assertIn("topRecommendation", decision)

    def test_system_prompt_guides_recent_meals_and_feedback_learning(self):
        prompt = system_prompt()

        self.assertIn("recentMeals", prompt)
        self.assertIn("feedbackLearning", prompt)
        self.assertIn("避免重复", prompt)


if __name__ == "__main__":
    unittest.main()
