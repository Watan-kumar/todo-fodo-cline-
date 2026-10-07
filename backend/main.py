from pathlib import Path
import json
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from backend.services.predictor import Predictor

BASE = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE / "ml" / "models"
KNOWLEDGE = BASE / "backend" / "data" / "disease_knowledge.json"

app = FastAPI(title="Crop Disease AI", version="1.0.0")

# Enable CORS for Live Server (Port 5500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=BASE / "frontend" / "static"), name="static")
templates = Jinja2Templates(directory=BASE / "frontend" / "templates")

predictor = Predictor(MODEL_DIR, KNOWLEDGE)

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/health")
def health():
    return {"status": "ok", "model_loaded": predictor.loaded}

@app.get("/api/classes")
def classes():
    return {"classes": predictor.classes}

@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is larger than 10 MB.")
    try:
        return predictor.predict(content)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))