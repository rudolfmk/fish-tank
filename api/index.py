"""Vercel entrypoint: serves the FastAPI backend under /api."""

import sys
from pathlib import Path

from fastapi import FastAPI

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from main import app as backend  # noqa: E402

app = FastAPI()
app.mount("/api", backend)
