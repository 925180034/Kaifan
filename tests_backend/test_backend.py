import tempfile
import unittest
from pathlib import Path

from server.database import Database
from server.main import MemoryRequest, create_app
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


class MemoryApiTests(unittest.TestCase):
    def test_memory_api_saves_and_returns_user_memory(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "api.sqlite")
            app = create_app(database=db)
            save_memory = route_endpoint(app, "/api/memory/{user_id}", "POST")
            get_memory = route_endpoint(app, "/api/memory/{user_id}", "GET")
            memory = {
                "recentMeals": [{"id": "takeout-1", "title": "热汤面"}],
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
                {"recentMeals": [], "feedbackLearning": None, "feedback": []},
            )


def route_endpoint(app, path, method):
    for route in app.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route.endpoint
    raise AssertionError(f"Route {method} {path} not found")


if __name__ == "__main__":
    unittest.main()
