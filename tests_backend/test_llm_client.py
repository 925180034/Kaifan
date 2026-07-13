import unittest
import json

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


def llm_response(cards):
    return {"choices": [{"message": {"content": json.dumps({"cards": cards}, ensure_ascii=False)}}]}


def llm_response_content(content):
    return {"choices": [{"message": {"content": content}}]}


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
            return llm_response(valid_cards())

        client = DeepSeekClient(api_key="test-key", transport=transport)

        cards = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(len(cards), 3)
        self.assertEqual({card["type"] for card in cards}, {"cook", "takeout", "dine_out"})

    def test_generate_cards_parses_markdown_wrapped_json(self):
        content = "```json\n" + json.dumps({"cards": valid_cards()}, ensure_ascii=False) + "\n```"

        def transport(url, headers, payload, timeout):
            return llm_response_content(content)

        client = DeepSeekClient(api_key="test-key", transport=transport)

        cards = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(len(cards), 3)
        self.assertEqual(cards[0]["type"], "cook")

    def test_generate_cards_extracts_json_object_from_extra_text(self):
        content = "好的,以下是 JSON:\n" + json.dumps({"cards": valid_cards()}, ensure_ascii=False) + "\n请查收。"

        def transport(url, headers, payload, timeout):
            return llm_response_content(content)

        client = DeepSeekClient(api_key="test-key", transport=transport)

        cards = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(len(cards), 3)
        self.assertEqual(cards[1]["type"], "takeout")

    def test_generate_cards_normalizes_primary_actions_for_frontend(self):
        cards = valid_cards()
        cards[1]["primaryAction"] = {"label": "点外卖", "action": "order_food"}
        cards[2]["primaryAction"] = {"label": "查看地图", "action": "view_map"}

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport)

        normalized = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        takeout = next(card for card in normalized if card["type"] == "takeout")
        dine_out = next(card for card in normalized if card["type"] == "dine_out")
        self.assertEqual(takeout["primaryAction"], {"label": "去美团搜", "action": "open_meituan"})
        self.assertEqual(dine_out["primaryAction"], {"label": "去点评搜", "action": "open_dianping"})

    def test_generate_cards_orders_types_and_coerces_numeric_fields(self):
        cards = valid_cards()
        cards = [cards[2], cards[0], cards[1]]
        cards[0]["estimatedMinutes"] = "70分钟"
        cards[1]["baseScore"] = "82"
        cards[2]["estimatedCostPerPerson"] = "约32元"

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport)

        normalized = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual([card["type"] for card in normalized], ["cook", "takeout", "dine_out"])
        self.assertIsInstance(normalized[0]["baseScore"], int)
        self.assertEqual(normalized[1]["estimatedCostPerPerson"], 32)
        self.assertEqual(normalized[2]["estimatedMinutes"], 70)

    def test_generate_cards_normalizes_search_keyword_strings(self):
        cards = valid_cards()
        cards[0]["searchKeywords"] = "虾仁、豆腐, 高蛋白"
        cards[1]["searchKeywords"] = "热汤面 / 少油"
        cards[2]["searchKeywords"] = "附近\n粤菜"

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport)

        try:
            normalized = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)
        except ValueError as exc:
            self.fail(f"expected string searchKeywords to be normalized, got: {exc}")

        self.assertEqual(normalized[0]["searchKeywords"], ["虾仁", "豆腐", "高蛋白"])
        self.assertEqual(normalized[1]["searchKeywords"], ["热汤面", "少油"])
        self.assertEqual(normalized[2]["searchKeywords"], ["附近", "粤菜"])

    def test_generate_cards_normalizes_string_ingredients(self):
        cards = valid_cards()
        cards[0]["ingredients"] = "虾仁 200g、内酯豆腐 1盒、米饭 1碗"

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport)

        try:
            normalized = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)
        except ValueError as exc:
            self.fail(f"expected string ingredients to be normalized, got: {exc}")

        self.assertEqual(
            normalized[0]["ingredients"],
            [
                {"name": "虾仁", "amount": "200g", "group": "食材"},
                {"name": "内酯豆腐", "amount": "1盒", "group": "食材"},
                {"name": "米饭", "amount": "1碗", "group": "食材"},
            ],
        )

    def test_generate_cards_preserves_step_list_sentences_with_commas(self):
        cards = valid_cards()
        cards[0]["steps"] = ["炒熟虾仁和豆腐,盖在米饭上。"]

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport)

        normalized = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(normalized[0]["steps"], ["炒熟虾仁和豆腐,盖在米饭上。"])

    def test_generate_cards_normalizes_string_nutrition_summary(self):
        cards = valid_cards()
        cards[0]["nutritionSummary"] = "约620 kcal/人，蛋白质约35g/人，少油高蛋白"

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport)

        try:
            normalized = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)
        except ValueError as exc:
            self.fail(f"expected string nutritionSummary to be normalized, got: {exc}")

        self.assertEqual(
            normalized[0]["nutritionSummary"],
            {
                "calories": "约620 kcal/人",
                "protein": "约35g/人",
                "note": "约620 kcal/人，蛋白质约35g/人，少油高蛋白",
            },
        )

    def test_generate_cards_rejects_exact_recent_meal_repeats(self):
        context = {
            **DEFAULT_CONTEXT,
            "recentMeals": [{"id": "old-cook", "title": "虾仁豆腐盖饭"}],
        }

        def transport(url, headers, payload, timeout):
            return llm_response(valid_cards())

        client = DeepSeekClient(api_key="test-key", transport=transport)

        with self.assertRaisesRegex(ValueError, "recent meal"):
            client.generate_cards(DEFAULT_PROFILE, context)

    def test_generate_cards_rejects_profile_forbidden_food(self):
        profile = {**DEFAULT_PROFILE, "allergies": ["虾仁"], "dislikes": []}

        def transport(url, headers, payload, timeout):
            return llm_response(valid_cards())

        client = DeepSeekClient(api_key="test-key", transport=transport)

        with self.assertRaisesRegex(ValueError, "forbidden"):
            client.generate_cards(profile, DEFAULT_CONTEXT)

    def test_generate_cards_rejects_taboos_profile_field(self):
        profile = {**DEFAULT_PROFILE, "allergies": [], "dislikes": [], "taboos": ["虾仁"]}

        def transport(url, headers, payload, timeout):
            return llm_response(valid_cards())

        client = DeepSeekClient(api_key="test-key", transport=transport, max_attempts=1)

        with self.assertRaisesRegex(ValueError, "forbidden"):
            client.generate_cards(profile, DEFAULT_CONTEXT)

    def test_generate_cards_rejects_allergy_label_suffix_matches_food_name(self):
        profile = {**DEFAULT_PROFILE, "allergies": ["花生过敏"], "dislikes": []}
        cards = valid_cards()
        cards[0]["title"] = "豆腐盖饭"
        cards[0]["searchKeywords"] = ["豆腐", "高蛋白"]
        cards[0]["ingredients"] = [{"name": "豆腐", "amount": "1盒", "group": "豆制品"}]
        cards[0]["steps"] = ["豆腐煎香后出锅前撒花生碎。"]

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport, max_attempts=1)

        with self.assertRaisesRegex(ValueError, "forbidden"):
            client.generate_cards(profile, DEFAULT_CONTEXT)

    def test_generate_cards_rejects_forbidden_food_in_steps(self):
        profile = {**DEFAULT_PROFILE, "allergies": ["花生"], "dislikes": []}
        cards = valid_cards()
        cards[0]["title"] = "豆腐盖饭"
        cards[0]["searchKeywords"] = ["豆腐", "高蛋白"]
        cards[0]["ingredients"] = [{"name": "豆腐", "amount": "1盒", "group": "豆制品"}]
        cards[0]["steps"] = ["豆腐煎香后出锅前撒花生碎。"]

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport, max_attempts=1)

        with self.assertRaisesRegex(ValueError, "forbidden"):
            client.generate_cards(profile, DEFAULT_CONTEXT)

    def test_generate_cards_rejects_forbidden_food_in_nutrition_summary(self):
        profile = {**DEFAULT_PROFILE, "allergies": ["花生"], "dislikes": []}
        cards = valid_cards()
        cards[0]["title"] = "豆腐盖饭"
        cards[0]["searchKeywords"] = ["豆腐", "高蛋白"]
        cards[0]["ingredients"] = [{"name": "豆腐", "amount": "1盒", "group": "豆制品"}]
        cards[0]["nutritionSummary"] = {"note": "高蛋白,用花生油增香"}

        def transport(url, headers, payload, timeout):
            return llm_response(cards)

        client = DeepSeekClient(api_key="test-key", transport=transport, max_attempts=1)

        with self.assertRaisesRegex(ValueError, "forbidden"):
            client.generate_cards(profile, DEFAULT_CONTEXT)

    def test_generate_cards_retries_with_validation_error_feedback(self):
        attempts = []
        invalid_cards = valid_cards()
        invalid_cards[0]["title"] = "香菜虾仁豆腐盖饭"
        invalid_cards[0]["searchKeywords"] = ["香菜", "虾仁", "豆腐"]

        def transport(url, headers, payload, timeout):
            attempts.append(payload)
            if len(attempts) == 1:
                return llm_response(invalid_cards)
            return llm_response(valid_cards())

        client = DeepSeekClient(api_key="test-key", transport=transport)

        cards = client.generate_cards(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(len(cards), 3)
        self.assertEqual(len(attempts), 2)
        self.assertIn("LLM card contains forbidden food: 香菜", attempts[1]["messages"][-1]["content"])

    def test_generate_cards_treats_missing_profile_constraint_lists_as_empty(self):
        profile = {**DEFAULT_PROFILE, "allergies": None, "dislikes": None}

        def transport(url, headers, payload, timeout):
            return llm_response(valid_cards())

        client = DeepSeekClient(api_key="test-key", transport=transport)

        cards = client.generate_cards(profile, DEFAULT_CONTEXT)

        self.assertEqual(len(cards), 3)

    def test_build_decision_marks_llm_and_fallback_sources(self):
        class WorkingClient:
            def is_configured(self):
                return True

            def generate_cards(self, profile, context):
                return valid_cards()

        class FailingClient:
            def is_configured(self):
                return True

            def generate_cards(self, profile, context):
                raise RuntimeError("network failed")

        llm_decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT, llm_client=WorkingClient())
        fallback_decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT, llm_client=FailingClient())

        self.assertEqual(llm_decision["generationSource"], "llm")
        self.assertEqual(fallback_decision["generationSource"], "fallback")
        self.assertIn("fallbackReason", fallback_decision)

    def test_build_decision_falls_back_when_llm_fails(self):
        class FailingClient:
            def is_configured(self):
                return True

            def generate_cards(self, profile, context):
                raise RuntimeError("network failed")

        decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT, llm_client=FailingClient())

        self.assertEqual(len(decision["cards"]), 3)
        self.assertIn("topRecommendation", decision)

    def test_build_decision_sanitizes_sensitive_llm_fallback_errors(self):
        class FailingClient:
            def is_configured(self):
                return True

            def generate_cards(self, profile, context):
                raise RuntimeError(
                    'DeepSeek API error 401: {"error": {"message": "invalid api key sk-secret123"}} Authorization: Bearer sk-secret123'
                )

        decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT, llm_client=FailingClient())

        self.assertEqual(decision["generationSource"], "fallback")
        self.assertEqual(decision["fallbackReason"], "llm_provider_error")
        self.assertNotIn("sk-secret123", decision["fallbackReason"])
        self.assertNotIn("Authorization", decision["fallbackReason"])
        self.assertNotIn("DeepSeek API error", decision["fallbackReason"])

    def test_system_prompt_guides_recent_meals_and_feedback_learning(self):
        prompt = system_prompt()

        self.assertIn("recentMeals", prompt)
        self.assertIn("favoriteMeals", prompt)
        self.assertIn("feedbackLearning", prompt)
        self.assertIn("避免重复", prompt)
        self.assertIn("长期偏好", prompt)


if __name__ == "__main__":
    unittest.main()
