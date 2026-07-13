import json
import unittest

from server.analytics import summarize_events


def row(user_id, event_name, payload=None, created_at="2026-07-13T20:00:00.000Z"):
    return {
        "user_id": user_id,
        "event_name": event_name,
        "payload_json": json.dumps(payload or {}, ensure_ascii=False),
        "created_at": created_at,
        "client_created_at": created_at,
    }


class AnalyticsSummaryTests(unittest.TestCase):
    def test_summarizes_core_product_funnel_metrics(self):
        rows = [
            row("u1", "app_opened"),
            row("u1", "onboarding_started"),
            row("u1", "onboarding_completed"),
            row("u1", "decision_generated", {"durationMs": 1200}),
            row("u1", "refresh", {"scope": "all", "decisionId": "d1"}),
            row("u1", "refresh", {"scope": "one", "decisionId": "d1"}),
            row("u1", "card_selected", {"decisionId": "d1", "cardId": "cook-1"}),
            row("u1", "fulfillment_opened", {"cardId": "cook-1"}),
            row("u1", "platform_link_clicked", {"platform": "xiaoxiang", "status": "fallback_copy_keywords"}),
            row("u1", "feedback_submitted", {"cardId": "cook-1", "tag": "太贵"}),
            row("u2", "app_opened"),
            row("u2", "onboarding_started"),
            row("u2", "decision_generated", {"durationMs": 3600}),
            row("u2", "card_selected", {"decisionId": "d2", "cardId": "takeout-1"}),
            row("u3", "app_opened"),
            row("u3", "decision_generated", {"durationMs": 900}),
        ]

        summary = summarize_events(rows)

        self.assertEqual(summary["totalEvents"], 16)
        self.assertEqual(summary["uniqueUsers"], 3)
        self.assertEqual(summary["funnel"]["decision_generated"], 3)
        self.assertEqual(summary["funnel"]["card_selected"], 2)
        self.assertEqual(summary["rates"]["onboardingCompletionRate"], 0.5)
        self.assertEqual(summary["rates"]["adoptionRate"], 0.667)
        self.assertEqual(summary["rates"]["feedbackRate"], 0.5)
        self.assertEqual(summary["decision"]["medianDecisionDurationSeconds"], 1.2)
        self.assertEqual(summary["refresh"]["averageRefreshesPerDecision"], 1.0)
        self.assertEqual(summary["platformLinks"]["fallbackCount"], 1)


if __name__ == "__main__":
    unittest.main()
