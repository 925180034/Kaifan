import json
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path


FUNNEL_EVENTS = [
    "app_opened",
    "onboarding_started",
    "onboarding_completed",
    "decision_generated",
    "card_selected",
    "fulfillment_opened",
    "fulfillment_completed",
    "feedback_submitted",
]


def load_event_rows(database_path="data/kaifan.sqlite"):
    path = Path(database_path)
    if not path.exists():
        return []

    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT user_id, event_name, payload_json, client_created_at, created_at
            FROM event_log
            ORDER BY id ASC
            """
        ).fetchall()
    except sqlite3.OperationalError:
        return []
    finally:
        connection.close()

    return [dict(row) for row in rows]


def summarize_events(rows):
    events = [normalize_row(row) for row in rows]
    counts = Counter(event["event"] for event in events)
    users = {event["userId"] for event in events if event.get("userId")}
    decision_events = [event for event in events if event["event"] == "decision_generated"]
    selected_events = [event for event in events if event["event"] == "card_selected"]
    feedback_events = [event for event in events if event["event"] == "feedback_submitted"]
    fulfillment_completed = [event for event in events if event["event"] == "fulfillment_completed"]
    refresh_events = [event for event in events if event["event"] == "refresh"]
    platform_events = [event for event in events if event["event"] == "platform_link_clicked"]

    return {
        "totalEvents": len(events),
        "uniqueUsers": len(users),
        "funnel": {event: counts.get(event, 0) for event in FUNNEL_EVENTS},
        "rates": {
            "onboardingCompletionRate": rate(counts.get("onboarding_completed", 0), counts.get("onboarding_started", 0)),
            "adoptionRate": rate(len(selected_events), len(decision_events)),
            "fulfillmentCompletionRate": rate(len(fulfillment_completed), len(selected_events)),
            "feedbackRate": rate(len(feedback_events), len(selected_events)),
        },
        "decision": decision_metrics(decision_events),
        "refresh": refresh_metrics(refresh_events, selected_events, decision_events),
        "platformLinks": platform_link_metrics(platform_events),
        "events": dict(sorted(counts.items())),
    }


def normalize_row(row):
    payload = row.get("payload")
    if payload is None:
        payload = parse_payload(row.get("payload_json"))
    return {
        "userId": row.get("userId") or row.get("user_id") or "",
        "event": row.get("event") or row.get("event_name") or "",
        "payload": payload if isinstance(payload, dict) else {},
        "createdAt": row.get("client_created_at") or row.get("created_at") or row.get("createdAt") or "",
    }


def parse_payload(value):
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value or "{}")
    except (TypeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def rate(numerator, denominator):
    if not denominator:
        return None
    return round(numerator / denominator, 3)


def decision_metrics(events):
    durations = [number(event["payload"].get("durationMs")) / 1000 for event in events if number(event["payload"].get("durationMs"))]
    sources = Counter(str(event["payload"].get("generationSource") or "unknown") for event in events)
    return {
        "count": len(events),
        "medianDecisionDurationSeconds": round(median(durations), 3) if durations else None,
        "generationSources": dict(sorted(sources.items())),
    }


def refresh_metrics(refresh_events, selected_events, decision_events):
    by_decision = defaultdict(int)
    for event in refresh_events:
        decision_id = str(event["payload"].get("decisionId") or event["payload"].get("decision_id") or "unknown")
        by_decision[decision_id] += 1

    denominator = len(selected_events) or len(decision_events) or len(by_decision)
    average = round(sum(by_decision.values()) / denominator, 3) if denominator else None
    scopes = Counter(str(event["payload"].get("scope") or "unknown") for event in refresh_events)
    return {
        "count": len(refresh_events),
        "averageRefreshesPerDecision": average,
        "scopes": dict(sorted(scopes.items())),
    }


def platform_link_metrics(events):
    platforms = Counter(str(event["payload"].get("platform") or "unknown") for event in events)
    statuses = Counter(str(event["payload"].get("status") or "unknown") for event in events)
    fallback_count = sum(count for status, count in statuses.items() if status.startswith("fallback"))
    return {
        "count": len(events),
        "fallbackCount": fallback_count,
        "platforms": dict(sorted(platforms.items())),
        "statuses": dict(sorted(statuses.items())),
    }


def number(value):
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def median(values):
    ordered = sorted(values)
    if not ordered:
        return 0
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2
