from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .database import Database
from .recommender import build_decision, refresh_card
from .sample_data import DEFAULT_CONTEXT, DEFAULT_PROFILE


ROOT_DIR = Path(__file__).resolve().parents[1]


class ProfileRequest(BaseModel):
    profile: dict = Field(default_factory=dict)


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


def create_app(database=None):
    db = database or Database()
    app = FastAPI(title="Kaifan Dinner Decision Assistant")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/profile/{user_id}")
    def get_profile(user_id: str):
        return {"userId": user_id, "profile": db.get_profile(user_id) or DEFAULT_PROFILE}

    @app.post("/api/profile/{user_id}")
    def save_profile(user_id: str, request: ProfileRequest):
        profile = request.profile or DEFAULT_PROFILE
        db.save_profile(user_id, profile)
        return {"userId": user_id, "profile": profile}

    @app.post("/api/decision/today")
    def today_decision(request: DecisionRequest):
        profile = request.profile or db.get_profile(request.userId) or DEFAULT_PROFILE
        context = request.context or DEFAULT_CONTEXT
        db.save_profile(request.userId, profile)
        decision = build_decision(profile, context)
        return db.save_decision(request.userId, decision)

    @app.post("/api/decision/{decision_id}/refresh")
    def refresh_decision(decision_id: str, request: RefreshRequest):
        decision = db.get_decision(decision_id)
        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found")

        next_card = refresh_card(request.type, request.mood, request.currentId)
        decision["cards"] = [
            next_card if card["id"] == request.currentId else card for card in decision["cards"]
        ]
        decision["refreshCount"] = decision.get("refreshCount", 0) + 1
        return db.update_decision(decision)

    @app.post("/api/decision/select")
    def select_decision(request: SelectRequest):
        decision = db.select_card(request.decisionId, request.cardId)
        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found")
        return decision

    @app.post("/api/feedback")
    def feedback(request: FeedbackRequest):
        return db.save_feedback(request.decisionId, request.userId, request.cardId, request.tag)

    app.mount("/src", StaticFiles(directory=ROOT_DIR / "src"), name="src")
    app.mount("/assets", StaticFiles(directory=ROOT_DIR / "assets"), name="assets")
    app.mount("/docs", StaticFiles(directory=ROOT_DIR / "docs"), name="docs")

    @app.get("/styles.css")
    def styles():
        return FileResponse(ROOT_DIR / "styles.css")

    @app.get("/manifest.webmanifest")
    def manifest():
        return FileResponse(ROOT_DIR / "manifest.webmanifest")

    @app.get("/")
    def index():
        return FileResponse(ROOT_DIR / "index.html")

    return app


app = create_app()
