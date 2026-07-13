from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .database import Database
from .llm_client import DeepSeekClient
from .recommender import build_decision, refresh_card
from .sample_data import DEFAULT_CONTEXT, DEFAULT_PROFILE


ROOT_DIR = Path(__file__).resolve().parents[1]


class ProfileRequest(BaseModel):
    profile: dict = Field(default_factory=dict)


class MemoryRequest(BaseModel):
    memory: dict = Field(default_factory=dict)


class EventRequest(BaseModel):
    userId: str = "local-user"
    event: str
    payload: dict = Field(default_factory=dict)
    createdAt: str | None = None


class DecisionRequest(BaseModel):
    userId: str = "local-user"
    profile: dict = Field(default_factory=lambda: DEFAULT_PROFILE.copy())
    context: dict = Field(default_factory=lambda: DEFAULT_CONTEXT.copy())


class RefreshRequest(BaseModel):
    userId: str = "local-user"
    type: str
    currentId: str | None = None
    mood: str = "normal"


class SelectRequest(BaseModel):
    decisionId: str
    userId: str = "local-user"
    cardId: str


class FeedbackRequest(BaseModel):
    decisionId: str
    userId: str = "local-user"
    cardId: str
    tag: str
    createdAt: str | None = None
    mealSelectedAt: str | None = None


def create_app(database=None, llm_client=None):
    db = database or Database()
    llm_client = llm_client or DeepSeekClient.from_env()
    app = FastAPI(title="Kaifan Dinner Decision Assistant")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/profile/{user_id}")
    def get_profile(user_id: str):
        profile = db.get_profile(user_id)
        if profile is not None:
            return {"userId": user_id, "profile": profile, "profileSource": "stored"}
        return {"userId": user_id, "profile": DEFAULT_PROFILE, "profileSource": "default"}

    @app.post("/api/profile/{user_id}")
    def save_profile(user_id: str, request: ProfileRequest):
        profile = request.profile or DEFAULT_PROFILE
        db.save_profile(user_id, profile)
        return {"userId": user_id, "profile": profile, "profileSource": "stored"}

    @app.get("/api/memory/{user_id}")
    def get_memory(user_id: str):
        return {"userId": user_id, "memory": db.get_memory(user_id) or default_memory()}

    @app.post("/api/memory/{user_id}")
    def save_memory(user_id: str, request: MemoryRequest):
        memory = normalize_memory(request.memory)
        db.save_memory(user_id, memory)
        return {"userId": user_id, "memory": memory}

    @app.post("/api/decision/today")
    def today_decision(request: DecisionRequest):
        profile = request.profile or db.get_profile(request.userId) or DEFAULT_PROFILE
        context = request.context or DEFAULT_CONTEXT
        db.save_profile(request.userId, profile)
        decision = build_decision(profile, context, llm_client=llm_client)
        apply_recipe_cache(db, decision)
        return db.save_decision(request.userId, decision)

    @app.post("/api/decision/{decision_id}/refresh")
    def refresh_decision(decision_id: str, request: RefreshRequest):
        decision = db.get_decision(decision_id)
        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found")
        if request.type not in {"cook", "takeout", "dine_out"}:
            raise HTTPException(status_code=400, detail="Unsupported card type")

        current_card = next((card for card in decision.get("cards", []) if card.get("id") == request.currentId), None)
        if not current_card:
            raise HTTPException(status_code=404, detail="Card not found")
        if current_card.get("type") != request.type:
            raise HTTPException(status_code=400, detail="Refresh type does not match card")

        refresh_context = {**(decision.get("context") or {}), "mood": request.mood}
        next_card = refresh_card(request.type, request.mood, request.currentId, context=refresh_context)
        decision["cards"] = [
            next_card if card["id"] == request.currentId else card for card in decision["cards"]
        ]
        decision["refreshCount"] = decision.get("refreshCount", 0) + 1
        return db.update_decision(decision)

    @app.post("/api/decision/select")
    def select_decision(request: SelectRequest):
        decision = db.get_decision(request.decisionId)
        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found")
        card_ids = {card.get("id") for card in decision.get("cards", []) if isinstance(card, dict)}
        if request.cardId not in card_ids:
            raise HTTPException(status_code=404, detail="Card not found")
        selected = db.select_card(request.decisionId, request.cardId)
        if not selected:
            raise HTTPException(status_code=404, detail="Decision not found")
        return selected

    @app.post("/api/feedback")
    def feedback(request: FeedbackRequest):
        return db.save_feedback(
            request.decisionId,
            request.userId,
            request.cardId,
            request.tag,
            created_at=request.createdAt,
            meal_selected_at=request.mealSelectedAt,
        )

    @app.post("/api/events")
    def save_event(request: EventRequest):
        return db.save_event(
            request.userId,
            request.event,
            request.payload,
            created_at=request.createdAt,
        )

    app.mount("/src", StaticFiles(directory=ROOT_DIR / "src"), name="src")
    app.mount("/assets", StaticFiles(directory=ROOT_DIR / "assets"), name="assets")
    app.mount("/docs", StaticFiles(directory=ROOT_DIR / "docs"), name="docs")

    @app.get("/styles.css")
    def styles():
        return FileResponse(ROOT_DIR / "styles.css")

    @app.get("/manifest.webmanifest")
    def manifest():
        return FileResponse(ROOT_DIR / "manifest.webmanifest")

    @app.get("/sw.js")
    def service_worker():
        return FileResponse(ROOT_DIR / "sw.js", media_type="application/javascript")

    @app.get("/")
    @app.get("/index.html")
    def index():
        return FileResponse(ROOT_DIR / "index.html")

    return app


app = create_app()


def apply_recipe_cache(db, decision):
    if decision.get("generationSource") != "llm":
        return decision

    cache_status = "none"
    next_cards = []
    for card in decision.get("cards", []):
        if card.get("type") != "cook":
            next_cards.append(card)
            continue

        cached = db.get_recipe_cache(card)
        if cached:
            card = merge_cached_recipe_card(card, cached)
            cache_status = "hit"
        else:
            db.save_recipe_cache(card)
            cache_status = "miss"
        next_cards.append(card)

    decision["cards"] = next_cards
    if cache_status != "none":
        decision["recipeCacheStatus"] = cache_status

    top_id = decision.get("topRecommendation", {}).get("id")
    if top_id:
        replacement = next((card for card in next_cards if card.get("id") == top_id), None)
        if replacement:
            score = decision.get("topRecommendation", {}).get("score")
            decision["topRecommendation"] = {**replacement, **({"score": score} if score is not None else {})}

    return decision


def merge_cached_recipe_card(current, cached):
    merged = {**current, **cached}
    preserved_fields = [
        "id",
        "type",
        "baseScore",
        "accent",
        "primaryAction",
        "estimatedMinutes",
        "estimatedCostPerPerson",
        "costText",
        "timeText",
    ]
    for field in preserved_fields:
        if field in current:
            merged[field] = current[field]
    return merged


def default_memory():
    return {"recentMeals": [], "favoriteMeals": [], "feedbackLearning": None, "feedback": []}


def normalize_memory(memory):
    source = memory if isinstance(memory, dict) else {}
    return {
        "recentMeals": list_field(source, "recentMeals"),
        "favoriteMeals": list_field(source, "favoriteMeals"),
        "feedbackLearning": source.get("feedbackLearning"),
        "feedback": list_field(source, "feedback"),
    }


def list_field(source, key):
    value = source.get(key, [])
    return value if isinstance(value, list) else []
