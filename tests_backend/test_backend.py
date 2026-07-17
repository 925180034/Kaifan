import tempfile
import unittest

from fastapi import HTTPException
from pathlib import Path

from server.database import Database
from server.main import DecisionRequest, EventRequest, FeedbackRequest, MemoryRequest, ProfileRequest, RefreshRequest, SelectRequest, create_app
from server.recommender import build_decision
from server.rate_limit import SlidingWindowRateLimiter
from server.sample_data import DEFAULT_CONTEXT, DEFAULT_PROFILE, DINE_OUT_OPTIONS, RECIPE_OPTIONS, TAKEOUT_OPTIONS


class DatabaseTests(unittest.TestCase):
    def test_profile_round_trips_through_sqlite(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "kaifan.sqlite")
            profile = {**DEFAULT_PROFILE, "peopleCount": "1", "spicyLevel": "none"}

            db.save_profile("user-1", profile)

            self.assertEqual(db.get_profile("user-1"), profile)

    def test_memory_round_trips_through_sqlite(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "kaifan.sqlite")
            memory = {
                "recentMeals": [{"id": "cook-1", "title": "番茄虾仁豆腐饭"}],
                "feedbackLearning": {"likedKeywords": ["虾仁"], "avoidedKeywords": []},
                "feedback": [{"cardId": "cook-1", "tag": "好吃,下次还吃"}],
            }

            db.save_memory("user-1", memory)

            self.assertEqual(db.get_memory("user-1"), memory)

    def test_event_log_round_trips_through_sqlite(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "kaifan.sqlite")

            event = db.save_event(
                "user-1",
                "card_selected",
                {"cardId": "cook-1", "source": "today"},
                created_at="2026-07-13T20:00:00.000Z",
            )

            self.assertEqual(event["userId"], "user-1")
            self.assertEqual(event["event"], "card_selected")
            self.assertEqual(event["payload"]["cardId"], "cook-1")
            with db.connect() as connection:
                row = connection.execute("SELECT event_name, payload_json, client_created_at FROM event_log").fetchone()
            self.assertEqual(row["event_name"], "card_selected")
            self.assertIn("cook-1", row["payload_json"])
            self.assertEqual(row["client_created_at"], "2026-07-13T20:00:00.000Z")

    def test_recipe_cache_round_trips_by_title_and_ingredients(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "kaifan.sqlite")
            card = {
                "id": "llm-cook-1",
                "type": "cook",
                "title": "虾仁豆腐盖饭",
                "searchKeywords": ["虾仁", "豆腐"],
                "ingredients": [{"name": "虾仁", "amount": "200g"}],
                "steps": ["缓存步骤"],
                "primaryAction": {"label": "看菜谱", "action": "view_recipe"},
            }

            saved = db.save_recipe_cache(card)
            cached = db.get_recipe_cache({**card, "id": "llm-cook-2"})

            self.assertEqual(saved["card"]["steps"], ["缓存步骤"])
            self.assertEqual(cached["steps"], ["缓存步骤"])


class RecommenderTests(unittest.TestCase):
    def test_build_decision_returns_three_cards_and_top_recommendation(self):
        decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(len(decision["cards"]), 3)
        self.assertIn(decision["topRecommendation"]["id"], [card["id"] for card in decision["cards"]])
        self.assertEqual({card["type"] for card in decision["cards"]}, {"cook", "takeout", "dine_out"})

    def test_fallback_ranking_downranks_avoided_feedback_keywords(self):
        context = {
            **DEFAULT_CONTEXT,
            "weather": {"isRaining": False},
            "feedbackLearning": {
                "likedKeywords": [],
                "avoidedKeywords": ["虾仁", "豆腐"],
                "constraints": ["减少相似口味和关键词"],
            },
        }

        decision = build_decision(DEFAULT_PROFILE, context)

        self.assertNotEqual(decision["topRecommendation"]["id"], "cook-tomato-shrimp-tofu")

    def test_fallback_ranking_boosts_liked_feedback_keywords(self):
        context = {
            **DEFAULT_CONTEXT,
            "weather": {"isRaining": False},
            "feedbackLearning": {
                "likedKeywords": ["麻辣烫"],
                "avoidedKeywords": [],
                "constraints": [],
            },
        }
        cards = [RECIPE_OPTIONS[1], TAKEOUT_OPTIONS[1], DINE_OUT_OPTIONS[0]]

        decision = build_decision(DEFAULT_PROFILE, context, cards=cards)

        self.assertEqual(decision["topRecommendation"]["id"], "takeout-malatang")

    def test_fallback_ranking_downranks_recently_repeated_meals(self):
        context = {
            **DEFAULT_CONTEXT,
            "weather": {"isRaining": False},
            "recentMeals": [
                {
                    "id": "cook-tomato-shrimp-tofu",
                    "title": "番茄虾仁豆腐饭 + 拍黄瓜",
                    "searchKeywords": ["番茄", "虾仁", "豆腐"],
                }
            ],
        }

        decision = build_decision(DEFAULT_PROFILE, context)

        self.assertNotEqual(decision["topRecommendation"]["id"], "cook-tomato-shrimp-tofu")


class DecisionPersistenceTests(unittest.TestCase):
    def test_selecting_a_decision_card_persists_choice(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            db.save_decision("user-1", decision)

            selected = db.select_card(decision["decisionId"], decision["cards"][0]["id"])

            self.assertEqual(selected["selectedCardId"], decision["cards"][0]["id"])

    def test_selecting_unknown_card_id_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            db.save_decision("user-1", decision)

            selected = db.select_card(decision["decisionId"], "missing-card")
            loaded = db.get_decision(decision["decisionId"])

            self.assertIsNone(selected)
            self.assertIsNone(loaded["selectedCardId"])

    def test_feedback_persists_tag(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            db.save_decision("user-1", decision)

            feedback = db.save_feedback(
                decision["decisionId"],
                "user-1",
                decision["cards"][0]["id"],
                "好吃,下次还吃",
            )

            self.assertEqual(feedback["tag"], "好吃,下次还吃")

    def test_feedback_persists_client_meal_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            db.save_decision("user-1", decision)

            feedback = db.save_feedback(
                decision["decisionId"],
                "user-1",
                decision["cards"][0]["id"],
                "好吃,下次还吃",
                created_at="2026-07-09T19:30:00.000Z",
                meal_selected_at="2026-07-09T12:00:00.000Z",
            )

            self.assertEqual(feedback["createdAt"], "2026-07-09T19:30:00.000Z")
            self.assertEqual(feedback["mealSelectedAt"], "2026-07-09T12:00:00.000Z")

            with db.connect() as connection:
                row = connection.execute(
                    "SELECT client_created_at, meal_selected_at FROM feedback WHERE id = ?",
                    (feedback["id"],),
                ).fetchone()
            self.assertEqual(row["client_created_at"], "2026-07-09T19:30:00.000Z")
            self.assertEqual(row["meal_selected_at"], "2026-07-09T12:00:00.000Z")

    def test_existing_feedback_table_gets_metadata_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "api.sqlite"
            db = Database(path)
            with db.connect() as connection:
                connection.execute("ALTER TABLE feedback RENAME TO feedback_old")
                connection.execute(
                    """
                    CREATE TABLE feedback (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        decision_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        card_id TEXT NOT NULL,
                        tag TEXT NOT NULL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                connection.execute("DROP TABLE feedback_old")

            migrated = Database(path)

            with migrated.connect() as connection:
                columns = {row["name"] for row in connection.execute("PRAGMA table_info(feedback)")}
            self.assertIn("client_created_at", columns)
            self.assertIn("meal_selected_at", columns)


class ProfileApiTests(unittest.TestCase):
    def test_profile_api_marks_default_profiles_for_new_users(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            app = create_app(database=db)
            get_profile = route_endpoint(app, "/api/profile/{user_id}", "GET")

            response = get_profile("new-user")

            self.assertEqual(response["profileSource"], "default")
            self.assertEqual(response["profile"], DEFAULT_PROFILE)

    def test_profile_api_marks_saved_profiles_as_stored(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            app = create_app(database=db)
            save_profile = route_endpoint(app, "/api/profile/{user_id}", "POST")
            get_profile = route_endpoint(app, "/api/profile/{user_id}", "GET")
            profile = {**DEFAULT_PROFILE, "peopleCount": "1", "spicyLevel": "none"}

            save_profile("user-1", ProfileRequest(profile=profile))
            response = get_profile("user-1")

            self.assertEqual(response["profileSource"], "stored")
            self.assertEqual(response["profile"], profile)


class RefreshApiTests(unittest.TestCase):
    def test_refresh_api_rejects_unknown_type_without_mutating_decision(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            db.save_decision("user-1", decision)
            app = create_app(database=db)
            refresh = route_endpoint(app, "/api/decision/{decision_id}/refresh", "POST")

            with self.assertRaises(HTTPException) as exc:
                refresh(
                    decision["decisionId"],
                    RefreshRequest(userId="user-1", type="snack", currentId=decision["cards"][0]["id"], mood="normal"),
                )

            loaded = db.get_decision(decision["decisionId"])
            self.assertEqual(exc.exception.status_code, 400)
            self.assertEqual(exc.exception.detail, "Unsupported card type")
            self.assertEqual(loaded["refreshCount"], 0)

    def test_refresh_api_rejects_unknown_current_card_without_mutating_decision(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            db.save_decision("user-1", decision)
            app = create_app(database=db)
            refresh = route_endpoint(app, "/api/decision/{decision_id}/refresh", "POST")

            with self.assertRaises(HTTPException) as exc:
                refresh(decision["decisionId"], RefreshRequest(userId="user-1", type="cook", currentId="missing-card", mood="normal"))

            loaded = db.get_decision(decision["decisionId"])
            self.assertEqual(exc.exception.status_code, 404)
            self.assertEqual(exc.exception.detail, "Card not found")
            self.assertEqual(loaded["refreshCount"], 0)

    def test_refresh_api_rejects_type_mismatch_without_replacing_card(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            takeout = next(card for card in decision["cards"] if card["type"] == "takeout")
            db.save_decision("user-1", decision)
            app = create_app(database=db)
            refresh = route_endpoint(app, "/api/decision/{decision_id}/refresh", "POST")

            with self.assertRaises(HTTPException) as exc:
                refresh(decision["decisionId"], RefreshRequest(userId="user-1", type="cook", currentId=takeout["id"], mood="normal"))

            loaded = db.get_decision(decision["decisionId"])
            self.assertEqual(exc.exception.status_code, 400)
            self.assertEqual(exc.exception.detail, "Refresh type does not match card")
            self.assertEqual(loaded["refreshCount"], 0)
            self.assertEqual([card["type"] for card in loaded["cards"]], [card["type"] for card in decision["cards"]])


class SelectApiTests(unittest.TestCase):
    def test_select_api_reports_unknown_card_for_existing_decision(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            db.save_decision("user-1", decision)
            app = create_app(database=db)
            select_card = route_endpoint(app, "/api/decision/select", "POST")

            with self.assertRaises(HTTPException) as exc:
                select_card(SelectRequest(decisionId=decision["decisionId"], userId="user-1", cardId="missing-card"))

            self.assertEqual(exc.exception.status_code, 404)
            self.assertEqual(exc.exception.detail, "Card not found")


class FakeLLMClient:
    def __init__(self, cards):
        self.cards = cards
        self.call_count = 0

    def is_configured(self):
        return True

    def generate_cards(self, profile, context):
        self.call_count += 1
        return self.cards


def generated_llm_cards():
    return [
        {
            "id": "llm-cook-new",
            "type": "cook",
            "title": "虾仁豆腐盖饭",
            "subtitle": "高蛋白快手饭",
            "reason": "符合偏好",
            "estimatedMinutes": 22,
            "estimatedCostPerPerson": 26,
            "costText": "约¥26/人",
            "timeText": "22分钟",
            "difficulty": "easy",
            "complexity": "easy",
            "baseScore": 82,
            "accent": "green",
            "nutritionSummary": {"protein": "约35g/人"},
            "ingredients": [{"name": "虾仁", "amount": "200g", "group": "肉蛋奶"}],
            "steps": ["LLM 新步骤"],
            "searchKeywords": ["虾仁", "豆腐"],
            "primaryAction": {"label": "看菜谱", "action": "view_recipe"},
        },
        {
            "id": "llm-takeout",
            "type": "takeout",
            "title": "热汤面",
            "reason": "省心",
            "costText": "约¥32/人",
            "timeText": "35分钟",
            "estimatedMinutes": 35,
            "estimatedCostPerPerson": 32,
            "baseScore": 70,
            "accent": "amber",
            "searchKeywords": ["热汤面"],
            "primaryAction": {"label": "去美团搜", "action": "open_meituan"},
        },
        {
            "id": "llm-dine",
            "type": "dine_out",
            "title": "附近粤菜",
            "reason": "清淡",
            "costText": "约¥88/人",
            "timeText": "70分钟",
            "estimatedMinutes": 70,
            "estimatedCostPerPerson": 88,
            "baseScore": 60,
            "accent": "blue",
            "searchKeywords": ["粤菜"],
            "primaryAction": {"label": "去点评搜", "action": "open_dianping"},
        },
    ]


class RecipeCacheApiTests(unittest.TestCase):
    def test_today_decision_reuses_existing_user_date_decision_without_llm_call(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            llm_client = FakeLLMClient(generated_llm_cards())
            app = create_app(database=db, llm_client=llm_client)
            today = route_endpoint(app, "/api/decision/today", "POST")
            request = DecisionRequest(userId="user-cache", profile=DEFAULT_PROFILE, context=DEFAULT_CONTEXT)

            first = today(request)
            second = today(request)

            self.assertEqual(llm_client.call_count, 1)
            self.assertEqual(second["decisionId"], first["decisionId"])
            self.assertEqual(second["generationSource"], "cached")
            self.assertEqual([card["id"] for card in second["cards"]], [card["id"] for card in first["cards"]])

    def test_today_decision_force_regenerate_bypasses_user_date_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            llm_client = FakeLLMClient(generated_llm_cards())
            app = create_app(database=db, llm_client=llm_client)
            today = route_endpoint(app, "/api/decision/today", "POST")
            first_request = DecisionRequest(userId="user-force", profile=DEFAULT_PROFILE, context=DEFAULT_CONTEXT)
            force_request = DecisionRequest(
                userId="user-force",
                profile=DEFAULT_PROFILE,
                context=DEFAULT_CONTEXT,
                forceRegenerate=True,
            )

            first = today(first_request)
            second = today(force_request)

            self.assertEqual(llm_client.call_count, 2)
            self.assertNotEqual(second["decisionId"], first["decisionId"])
            self.assertEqual(second["generationSource"], "llm")

    def test_today_decision_reuses_cached_cook_recipe_details(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            cached_card = {
                **generated_llm_cards()[0],
                "id": "cached-cook",
                "steps": ["缓存步骤"],
                "ingredients": [{"name": "缓存虾仁", "amount": "220g", "group": "肉蛋奶"}],
            }
            db.save_recipe_cache(cached_card)
            app = create_app(database=db, llm_client=FakeLLMClient(generated_llm_cards()))
            today = route_endpoint(app, "/api/decision/today", "POST")

            response = today(DecisionRequest(userId="user-1", profile=DEFAULT_PROFILE, context=DEFAULT_CONTEXT))
            cook = next(card for card in response["cards"] if card["type"] == "cook")

            self.assertEqual(cook["id"], "llm-cook-new")
            self.assertEqual(cook["steps"], ["缓存步骤"])
            self.assertEqual(cook["ingredients"][0]["name"], "缓存虾仁")


class EventApiTests(unittest.TestCase):
    def test_event_api_saves_tracking_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            app = create_app(database=db)
            save_event = route_endpoint(app, "/api/events", "POST")

            response = save_event(
                EventRequest(
                    userId="user-1",
                    event="decision_generated",
                    payload={"generationSource": "fallback", "cardCount": 3},
                    createdAt="2026-07-13T20:05:00.000Z",
                )
            )

            self.assertEqual(response["event"], "decision_generated")
            self.assertEqual(response["payload"]["generationSource"], "fallback")
            self.assertEqual(response["createdAt"], "2026-07-13T20:05:00.000Z")


class FeedbackApiTests(unittest.TestCase):
    def test_feedback_api_saves_meal_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            app = create_app(database=db)
            save_feedback = route_endpoint(app, "/api/feedback", "POST")

            response = save_feedback(
                FeedbackRequest(
                    decisionId="decision-1",
                    userId="user-1",
                    cardId="cook-1",
                    tag="好吃,下次还吃",
                    createdAt="2026-07-09T19:30:00.000Z",
                    mealSelectedAt="2026-07-09T12:00:00.000Z",
                )
            )

            self.assertEqual(response["createdAt"], "2026-07-09T19:30:00.000Z")
            self.assertEqual(response["mealSelectedAt"], "2026-07-09T12:00:00.000Z")


class MemoryApiTests(unittest.TestCase):
    def test_memory_api_saves_and_returns_user_memory(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            app = create_app(database=db)
            save_memory = route_endpoint(app, "/api/memory/{user_id}", "POST")
            get_memory = route_endpoint(app, "/api/memory/{user_id}", "GET")
            memory = {
                "recentMeals": [{"id": "takeout-1", "title": "热汤面"}],
                "favoriteMeals": [{"id": "cook-1", "title": "番茄鸡蛋面"}],
                "feedbackLearning": {"likedKeywords": ["热汤面"], "constraints": []},
                "feedback": [],
            }

            saved = save_memory("user-1", MemoryRequest(memory=memory))
            loaded = get_memory("user-1")

            self.assertEqual(saved["memory"], memory)
            self.assertEqual(loaded["memory"], memory)

    def test_memory_api_returns_empty_memory_for_new_user(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            app = create_app(database=db)
            get_memory = route_endpoint(app, "/api/memory/{user_id}", "GET")

            response = get_memory("new-user")

            self.assertEqual(
                response["memory"],
                {"recentMeals": [], "favoriteMeals": [], "feedbackLearning": None, "feedback": []},
            )

    def test_memory_api_discards_malformed_list_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            app = create_app(database=db)
            save_memory = route_endpoint(app, "/api/memory/{user_id}", "POST")
            malformed = {
                "recentMeals": "not-a-list",
                "favoriteMeals": {"id": "fav-1"},
                "feedbackLearning": {"likedKeywords": ["番茄"]},
                "feedback": None,
            }

            response = save_memory("user-1", MemoryRequest(memory=malformed))

            self.assertEqual(
                response["memory"],
                {
                    "recentMeals": [],
                    "favoriteMeals": [],
                    "feedbackLearning": {"likedKeywords": ["番茄"]},
                    "feedback": [],
                },
            )


class StaticAssetTests(unittest.TestCase):
    def test_health_route_supports_deployment_checks(self):
        app = create_app()
        health = route_endpoint(app, "/api/health", "GET")

        self.assertEqual(health(), {"status": "ok"})

    def test_index_aliases_serve_app_shell(self):
        app = create_app()
        root = route_endpoint(app, "/", "GET")
        index = route_endpoint(app, "/index.html", "GET")

        self.assertEqual(Path(root().path).name, "index.html")
        self.assertEqual(Path(index().path).name, "index.html")

    def test_static_asset_routes_serve_pwa_entry_files(self):
        app = create_app()
        routes = {
            "/styles.css": "styles.css",
            "/manifest.webmanifest": "manifest.webmanifest",
            "/sw.js": "sw.js",
        }

        for route_path, file_name in routes.items():
            with self.subTest(route=route_path):
                endpoint = route_endpoint(app, route_path, "GET")
                response = endpoint()
                self.assertEqual(Path(response.path).name, file_name)

    def test_service_worker_route_uses_javascript_media_type(self):
        app = create_app()
        service_worker = route_endpoint(app, "/sw.js", "GET")

        response = service_worker()

        self.assertEqual(response.media_type, "application/javascript")


class SessionTests(unittest.TestCase):
    def test_issued_session_uses_a_random_user_id_and_rejects_wrong_tokens(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            identity = db.create_session()
            self.assertRegex(identity["userId"], r"^[0-9a-f-]{36}$")
            self.assertGreaterEqual(len(identity["sessionToken"]), 40)
            self.assertTrue(db.verify_session(identity["userId"], identity["sessionToken"]))
            self.assertFalse(db.verify_session(identity["userId"], "wrong"))
            self.assertFalse(db.verify_session("not-a-user", identity["sessionToken"]))


class DecisionRateLimitTests(unittest.TestCase):
    def test_force_regeneration_uses_fallback_after_the_generation_limit(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            llm_client = FakeLLMClient(generated_llm_cards())
            limiter = SlidingWindowRateLimiter(limit=1, window_seconds=60, clock=lambda: 0)
            app = create_app(database=db, llm_client=llm_client, generation_limiter=limiter)
            today = route_endpoint(app, "/api/decision/today", "POST")
            request = DecisionRequest(userId="user-rate", profile=DEFAULT_PROFILE, context=DEFAULT_CONTEXT, forceRegenerate=True)

            first = today(request)
            second = today(request)

            self.assertEqual(first["generationSource"], "llm")
            self.assertEqual(llm_client.call_count, 1)
            self.assertEqual(second["generationSource"], "fallback")
            self.assertEqual(second["fallbackReason"], "rate_limited")

    def test_refresh_limit_rejects_a_second_same_window_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)
            db.save_decision("user-rate", decision)
            limiter = SlidingWindowRateLimiter(limit=1, window_seconds=60, clock=lambda: 0)
            app = create_app(database=db, refresh_limiter=limiter)
            refresh = route_endpoint(app, "/api/decision/{decision_id}/refresh", "POST")
            cook = next(card for card in decision["cards"] if card["type"] == "cook")

            refreshed = refresh(
                decision["decisionId"],
                RefreshRequest(userId="user-rate", type="cook", currentId=cook["id"], mood="normal"),
            )
            next_cook = next(card for card in refreshed["cards"] if card["type"] == "cook")

            with self.assertRaises(HTTPException) as exc:
                refresh(
                    decision["decisionId"],
                    RefreshRequest(userId="user-rate", type="cook", currentId=next_cook["id"], mood="normal"),
                )

            self.assertEqual(exc.exception.status_code, 429)


def route_endpoint(app, path, method):
    for route in app.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route.endpoint
    raise AssertionError(f"Route {method} {path} not found")


if __name__ == "__main__":
    unittest.main()
