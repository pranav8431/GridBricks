"""FastAPI dependencies shared by the routers."""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Annotated

from fastapi import Depends, Query, Request

from gridbricks.domain.market import DEFAULT_PRESET_ID, PRESETS, Gate, resolve_gate
from gridbricks.services.desk import DeskService

GateId = StrEnum("GateId", {preset_id: preset_id for preset_id in PRESETS})  # type: ignore[misc]
DEFAULT_GATE = GateId(DEFAULT_PRESET_ID)


def get_desk(request: Request) -> DeskService:
    desk: DeskService = request.app.state.desk
    return desk


def get_gate(
    gate: Annotated[
        GateId,
        Query(description="Day-ahead auction whose gate closure sets the decision time."),
    ] = DEFAULT_GATE,
    cutoff: Annotated[
        str | None,
        Query(
            pattern=r"^([01]\d|2[0-3]):[0-5]\d$",
            description="Optional custom decision time on D-1 (UK, HH:MM). Overrides the gate.",
            examples=["10:30"],
        ),
    ] = None,
) -> Gate:
    return resolve_gate(str(gate), cutoff)


DecisionDate = Annotated[
    date,
    Query(description="Day the purchase decision is taken (D-1). Delivery is the next day."),
]
Desk = Annotated[DeskService, Depends(get_desk)]
SelectedGate = Annotated[Gate, Depends(get_gate)]
