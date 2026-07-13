import tempfile
import unittest

from fastapi import HTTPException
from pathlib import Path

from server.database import Database
from server.main import FeedbackRequest, MemoryRequest, ProfileRequest, RefreshRequest, SelectRequest, create_app
from server.recommender import build_decision
from server.sample_data import DEFAULT_CONTEXT, DEFAULT_PROFILE


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


class RecommenderTests(unittest.TestCase):
    def test_build_decision_returns_three_cards_and_top_recommendation(self):
        decision = build_decision(DEFAULT_PROFILE, DEFAULT_CONTEXT)

        self.assertEqual(len(decision["cards"]), 3)
        self.assertIn(decision["topRecommendation"]["id"], [card["id"] for card in decision["cards"]])
        self.assertEqual({card["type"] for card in decision["cards"]}, {"cook", "takeout", "dine_out"})


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
                    RefreshRequest(type="snack", currentId=decision["cards"][0]["id"], mood="normal"),
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
                refresh(decision["decisionId"], RefreshRequest(type="cook", currentId="missing-card", mood="normal"))

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
                refresh(decision["decisionId"], RefreshRequest(type="cook", currentId=takeout["id"], mood="normal"))

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


def route_endpoint(app, path, method):
    for route in app.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route.endpoint
    raise AssertionError(f"Route {method} {path} not found")


if __name__ == "__main__":
    unittest.main()
