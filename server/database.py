import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path


class Database:
    def __init__(self, path="data/kaifan.sqlite"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self):
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    @contextmanager
    def connect(self):
        connection = self._connect()
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _initialize(self):
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS profiles (
                    user_id TEXT PRIMARY KEY,
                    data_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS memories (
                    user_id TEXT PRIMARY KEY,
                    data_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS decisions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    selected_card_id TEXT,
                    refresh_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    decision_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    card_id TEXT NOT NULL,
                    tag TEXT NOT NULL,
                    client_created_at TEXT,
                    meal_selected_at TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            self._ensure_feedback_metadata_columns(connection)

    def _ensure_feedback_metadata_columns(self, connection):
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(feedback)")}
        if "client_created_at" not in columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN client_created_at TEXT")
        if "meal_selected_at" not in columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN meal_selected_at TEXT")

    def save_profile(self, user_id, profile):
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO profiles (user_id, data_json, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    data_json = excluded.data_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (user_id, json.dumps(profile, ensure_ascii=False)),
            )

    def get_profile(self, user_id):
        with self.connect() as connection:
            row = connection.execute(
                "SELECT data_json FROM profiles WHERE user_id = ?",
                (user_id,),
            ).fetchone()
        return json.loads(row["data_json"]) if row else None

    def save_memory(self, user_id, memory):
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO memories (user_id, data_json, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    data_json = excluded.data_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (user_id, json.dumps(memory, ensure_ascii=False)),
            )
        return memory

    def get_memory(self, user_id):
        with self.connect() as connection:
            row = connection.execute(
                "SELECT data_json FROM memories WHERE user_id = ?",
                (user_id,),
            ).fetchone()
        return json.loads(row["data_json"]) if row else None

    def save_decision(self, user_id, decision):
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO decisions (id, user_id, data_json, selected_card_id, refresh_count)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    decision["decisionId"],
                    user_id,
                    json.dumps(decision, ensure_ascii=False),
                    decision.get("selectedCardId"),
                    decision.get("refreshCount", 0),
                ),
            )
        return decision

    def get_decision(self, decision_id):
        with self.connect() as connection:
            row = connection.execute(
                "SELECT data_json, selected_card_id, refresh_count FROM decisions WHERE id = ?",
                (decision_id,),
            ).fetchone()
        if not row:
            return None
        decision = json.loads(row["data_json"])
        decision["selectedCardId"] = row["selected_card_id"]
        decision["refreshCount"] = row["refresh_count"]
        return decision

    def update_decision(self, decision):
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE decisions
                SET data_json = ?, selected_card_id = ?, refresh_count = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    json.dumps(decision, ensure_ascii=False),
                    decision.get("selectedCardId"),
                    decision.get("refreshCount", 0),
                    decision["decisionId"],
                ),
            )
        return decision

    def select_card(self, decision_id, card_id):
        decision = self.get_decision(decision_id)
        if not decision:
            return None
        valid_card_ids = {card.get("id") for card in decision.get("cards", []) if isinstance(card, dict)}
        if card_id not in valid_card_ids:
            return None
        decision["selectedCardId"] = card_id
        return self.update_decision(decision)

    def save_feedback(self, decision_id, user_id, card_id, tag, created_at=None, meal_selected_at=None):
        with self.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO feedback (decision_id, user_id, card_id, tag, client_created_at, meal_selected_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (decision_id, user_id, card_id, tag, created_at, meal_selected_at),
            )
            feedback_id = cursor.lastrowid
        feedback = {
            "id": feedback_id,
            "decisionId": decision_id,
            "userId": user_id,
            "cardId": card_id,
            "tag": tag,
        }
        if created_at:
            feedback["createdAt"] = created_at
        if meal_selected_at:
            feedback["mealSelectedAt"] = meal_selected_at
        return feedback
