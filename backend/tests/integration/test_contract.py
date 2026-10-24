"""The frontend's committed OpenAPI document must match what the API actually serves."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from gridbricks.main import create_app

FRONTEND_SPEC = Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "openapi.json"


def test_frontend_types_are_generated_from_the_current_api() -> None:
    served = create_app().openapi()
    committed = json.loads(FRONTEND_SPEC.read_text())
    assert committed == served, "Run `make contracts` to regenerate the frontend API types."


def test_served_spec_documents_every_route(client: TestClient) -> None:
    spec = client.get("/api/openapi.json").json()
    assert set(spec["paths"]) >= {
        "/api/health",
        "/api/v1/meta",
        "/api/v1/brief",
        "/api/v1/brief.csv",
        "/api/v1/evolution",
        "/api/v1/accuracy",
        "/api/v1/accuracy/horizon",
        "/api/v1/quality",
    }
    assert spec["paths"]["/api/v1/brief"]["get"]["parameters"][1]["schema"]["$ref"].endswith(
        "GateId"
    )
