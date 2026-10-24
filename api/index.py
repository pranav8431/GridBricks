"""Vercel entry point: exposes the FastAPI app as a Python serverless function.

Vercel serves the built React app from its CDN and routes /api/* here (see vercel.json).
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend" / "src"))

os.environ.setdefault("GRIDBRICKS_ENVIRONMENT", "production")
os.environ.setdefault("GRIDBRICKS_LOG_JSON", "true")

from gridbricks.main import create_app  # noqa: E402

app = create_app()
