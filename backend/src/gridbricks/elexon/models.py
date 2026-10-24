"""Validated records from the Elexon BMRS Insights API (stream endpoints)."""

from __future__ import annotations

from datetime import UTC, date
from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


def _iso_z(value: AwareDatetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class _Record(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore", populate_by_name=True)


class WindForecastRecord(_Record):
    """One WINDFOR point: the wind forecast for ``start_time``, published at ``publish_time``."""

    dataset: Literal["WINDFOR"]
    publish_time: AwareDatetime = Field(alias="publishTime")
    start_time: AwareDatetime = Field(alias="startTime")
    generation: float = Field(ge=0, le=100_000)

    @property
    def key(self) -> tuple[str, str]:
        return (_iso_z(self.publish_time), _iso_z(self.start_time))

    def to_snapshot(self) -> dict[str, Any]:
        return {
            "publishTime": _iso_z(self.publish_time),
            "startTime": _iso_z(self.start_time),
            "generation": self.generation,
        }


class FuelHHRecord(_Record):
    """Half-hourly outturn for one fuel type (average MW over the settlement period)."""

    dataset: Literal["FUELHH"]
    publish_time: AwareDatetime = Field(alias="publishTime")
    start_time: AwareDatetime = Field(alias="startTime")
    settlement_date: date = Field(alias="settlementDate")
    settlement_period: int = Field(alias="settlementPeriod", ge=1, le=50)
    fuel_type: str = Field(alias="fuelType")
    generation: float

    def to_snapshot(self) -> dict[str, Any]:
        return {
            "publishTime": _iso_z(self.publish_time),
            "startTime": _iso_z(self.start_time),
            "settlementDate": self.settlement_date.isoformat(),
            "settlementPeriod": self.settlement_period,
            "generation": self.generation,
        }
