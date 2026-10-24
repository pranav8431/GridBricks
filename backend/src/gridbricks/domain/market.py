"""GB day-ahead market conventions: delivery windows, gate closures and decision cutoffs.

All timestamps leave this module in UTC. Local UK time (Europe/London) is used only to
anchor market rules, so clock changes are handled in one place.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

UK_TZ = ZoneInfo("Europe/London")

#: Hourly day-ahead products for delivery day D run from 23:00 on D-1 to 23:00 on D (UK time).
DELIVERY_DAY_START_LOCAL = time(23, 0)

_HHMM = re.compile(r"^(?P<h>[01]\d|2[0-3]):(?P<m>[0-5]\d)$")


@dataclass(frozen=True, slots=True)
class GatePreset:
    """A day-ahead auction whose gate closure on D-1 fixes the decision time."""

    id: str
    label: str
    venue: str
    gate_closure: time
    description: str


PRESETS: dict[str, GatePreset] = {
    preset.id: preset
    for preset in (
        GatePreset(
            id="epex_hourly",
            label="EPEX hourly · 09:20",
            venue="EPEX SPOT",
            gate_closure=time(9, 20),
            description="EPEX SPOT GB 60-minute day-ahead auction",
        ),
        GatePreset(
            id="n2ex",
            label="N2EX · 09:50",
            venue="Nord Pool",
            gate_closure=time(9, 50),
            description="Nord Pool N2EX GB day-ahead auction",
        ),
        GatePreset(
            id="epex_halfhourly",
            label="EPEX half-hourly · 15:30",
            venue="EPEX SPOT",
            gate_closure=time(15, 30),
            description="EPEX SPOT GB 30-minute day-ahead auction",
        ),
    )
}
DEFAULT_PRESET_ID = "epex_hourly"


@dataclass(frozen=True, slots=True)
class Gate:
    """The decision time actually in use: a preset, or a preset overridden by a custom time."""

    id: str
    label: str
    venue: str
    gate_closure: time
    is_custom: bool

    @property
    def hhmm(self) -> str:
        return self.gate_closure.strftime("%H:%M")


class MarketRuleError(ValueError):
    """Raised when a market parameter (gate, cutoff time) is invalid."""


def parse_hhmm(value: str) -> time:
    """Parse a strict ``HH:MM`` string into a ``time``."""
    match = _HHMM.match(value)
    if match is None:
        raise MarketRuleError(f"Cutoff time must be HH:MM (24-hour), got {value!r}.")
    return time(int(match["h"]), int(match["m"]))


def resolve_gate(preset_id: str = DEFAULT_PRESET_ID, custom_cutoff: str | None = None) -> Gate:
    """Return the gate for a preset id, optionally overridden by a custom ``HH:MM`` cutoff."""
    preset = PRESETS.get(preset_id)
    if preset is None:
        known = ", ".join(PRESETS)
        raise MarketRuleError(f"Unknown gate {preset_id!r}. Use one of: {known}.")
    if custom_cutoff is None:
        return Gate(preset.id, preset.label, preset.venue, preset.gate_closure, is_custom=False)
    cutoff = parse_hhmm(custom_cutoff)
    if cutoff >= DELIVERY_DAY_START_LOCAL:
        raise MarketRuleError(
            "The decision must be taken before 23:00 on D-1, when delivery starts."
        )
    return Gate(
        id="custom",
        label=f"Custom · {cutoff:%H:%M}",
        venue="Custom",
        gate_closure=cutoff,
        is_custom=True,
    )


def _local(day: date, at: time) -> datetime:
    return datetime.combine(day, at, tzinfo=UK_TZ)


def delivery_window(delivery_date: date) -> tuple[datetime, datetime]:
    """UTC start (inclusive) and end (exclusive) of delivery day ``delivery_date``.

    The window is 24 hours long, except 23 hours on the spring clock change and 25 hours on
    the autumn one.
    """
    start = _local(delivery_date - timedelta(days=1), DELIVERY_DAY_START_LOCAL)
    end = _local(delivery_date, DELIVERY_DAY_START_LOCAL)
    return start.astimezone(UTC), end.astimezone(UTC)


def delivery_hours(delivery_date: date) -> list[datetime]:
    """UTC start time of every hourly product in the delivery day."""
    start, end = delivery_window(delivery_date)
    hours = int((end - start) / timedelta(hours=1))
    return [start + timedelta(hours=i) for i in range(hours)]


def decision_cutoff(delivery_date: date, gate_closure: time) -> datetime:
    """UTC instant of the decision for ``delivery_date``: the gate closure on D-1, UK time."""
    return _local(delivery_date - timedelta(days=1), gate_closure).astimezone(UTC)


def decision_date_for(delivery_date: date) -> date:
    return delivery_date - timedelta(days=1)


def delivery_date_for(decision_date: date) -> date:
    return decision_date + timedelta(days=1)


def uk_date(instant: datetime) -> date:
    """Calendar date in the UK for a timezone-aware instant."""
    return instant.astimezone(UK_TZ).date()
