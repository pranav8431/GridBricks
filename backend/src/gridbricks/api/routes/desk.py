"""Version 1 endpoints."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import Response

from gridbricks.api.deps import DecisionDate, Desk, SelectedGate
from gridbricks.schemas import (
    AccuracyResponse,
    BriefResponse,
    EvolutionResponse,
    HorizonResponse,
    MetaResponse,
    QualityResponse,
)

router = APIRouter()


@router.get("/meta", response_model=MetaResponse, summary="Scope, gates and snapshot details")
def meta(desk: Desk) -> MetaResponse:
    return desk.meta()


@router.get(
    "/brief",
    response_model=BriefResponse,
    summary="Day-ahead brief: the forecast available at the decision cutoff",
)
def brief(desk: Desk, decision_date: DecisionDate, gate: SelectedGate) -> BriefResponse:
    return desk.brief(decision_date, gate)


@router.get(
    "/brief.csv",
    summary="The day-ahead brief's hourly products as CSV",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
def brief_csv(desk: Desk, decision_date: DecisionDate, gate: SelectedGate) -> Response:
    body = desk.brief_csv(decision_date, gate)
    filename = f"gridbricks-brief-{decision_date.isoformat()}-{gate.id}.csv"
    return Response(
        body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/evolution",
    response_model=EvolutionResponse,
    summary="Every forecast run for the delivery day, before and after the decision",
)
def evolution(desk: Desk, decision_date: DecisionDate, gate: SelectedGate) -> EvolutionResponse:
    return desk.evolution(decision_date, gate)


@router.get(
    "/accuracy",
    response_model=AccuracyResponse,
    summary="Backtest accuracy of the decision-time forecast",
)
def accuracy(
    desk: Desk,
    gate: SelectedGate,
    decision_from: Annotated[date | None, Query(description="First decision day.")] = None,
    decision_to: Annotated[date | None, Query(description="Last decision day.")] = None,
) -> AccuracyResponse:
    return desk.accuracy(gate, decision_from, decision_to)


@router.get(
    "/accuracy/horizon",
    response_model=HorizonResponse,
    summary="Accuracy of all forecast runs by lead time",
)
def horizon(desk: Desk, gate: SelectedGate) -> HorizonResponse:
    return desk.horizon(gate)


@router.get("/quality", response_model=QualityResponse, summary="Data-quality checks")
def quality(desk: Desk) -> QualityResponse:
    return desk.quality()
