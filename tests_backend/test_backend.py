import tempfile
import unittest
from pathlib import Path

from server.database import Database
from server.recommender import build_decision
from server.sample_data import DEFAULT_CONTEXT, DEFAULT_PROFILE


class DatabaseTests(unittest.TestCase):
    def test_profile_round_trips_through_sqlite(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "kaifan.sqlite")
            profile = {**DEFAULT_PROFILE, "peopleCount": "1", "spicyLevel": "none"}

            db.save_profile("user-1", profile)

            self.assertEqual(db.get_profile("user-1"), profile)


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


if __name__ == "__main__":
    unittest.main()
