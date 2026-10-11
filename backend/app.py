
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Find the main project folder
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load API keys from the project's .env file
load_dotenv(PROJECT_ROOT / ".env")

# Create the FastAPI application
app = FastAPI(
    title="Autonomous AI Research Agent API",
    description="Backend API for the AI research dashboard",
    version="0.1.0",
)

# Allow the local React website to connect to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def health():
    """Check whether the backend is running."""
    return {
        "status": "ok",
        "service": "Autonomous AI Research Agent API",
    }


@app.get("/api/config/status")
def config_status():
    """Check whether API keys exist without revealing their values."""
    return {
        "tavily_configured": bool(os.getenv("TAVILY_API_KEY")),
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
    }
