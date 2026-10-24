from __future__ import annotations

from datetime import date, time

import pytest

from factories import utc
from gridbricks.domain.market import (
    MarketRuleError,
    decision_cutoff,
    delivery_hours,
    delivery_window,
    parse_hhmm,
    resolve_gate,
)


def test_winter_delivery_window_runs_23_to_23_uk() -> None:
    start, end = delivery_window(date(2026, 1, 15))
    assert start == utc(2026, 1, 14, 23)
    assert end == utc(2026, 1, 15, 23)
    assert len(delivery_hours(date(2026, 1, 15))) == 24


def test_summer_window_is_shifted_by_bst() -> None:
    start, end = delivery_window(date(2026, 6, 15))
    assert start == utc(2026, 6, 14, 22)
    assert end == utc(2026, 6, 15, 22)


def test_spring_clock_change_day_has_23_hours() -> None:
    # Clocks go forward at 01:00 GMT on Sunday 29 March 2026.
    assert len(delivery_hours(date(2026, 3, 29))) == 23


def test_autumn_clock_change_day_has_25_hours() -> None:
    # Clocks go back at 02:00 BST on Sunday 25 October 2026.
    assert len(delivery_hours(date(2026, 10, 25))) == 25


@pytest.mark.parametrize(
    ("delivery", "gate", "expected"),
    [
        (date(2026, 1, 15), time(9, 20), utc(2026, 1, 14, 9, 20)),  # GMT: UK time == UTC
        (date(2026, 1, 15), time(15, 30), utc(2026, 1, 14, 15, 30)),
        (date(2026, 6, 15), time(9, 20), utc(2026, 6, 14, 8, 20)),  # BST: UTC+1
    ],
)
def test_decision_cutoff_is_gate_closure_on_d_minus_1_uk_time(
    delivery: date, gate: time, expected: object
) -> None:
    assert decision_cutoff(delivery, gate) == expected


def test_presets_resolve_to_published_gate_closures() -> None:
    assert resolve_gate("epex_hourly").gate_closure == time(9, 20)
    assert resolve_gate("n2ex").gate_closure == time(9, 50)
    assert resolve_gate("epex_halfhourly").gate_closure == time(15, 30)


def test_custom_cutoff_overrides_preset() -> None:
    gate = resolve_gate("n2ex", "10:45")
    assert gate.is_custom
    assert gate.id == "custom"
    assert gate.gate_closure == time(10, 45)
    assert gate.hhmm == "10:45"


@pytest.mark.parametrize("bad", ["9:20", "24:00", "09:60", "0920", "", "09:20:00"])
def test_parse_hhmm_rejects_malformed_times(bad: str) -> None:
    with pytest.raises(MarketRuleError):
        parse_hhmm(bad)


def test_cutoff_after_delivery_start_is_rejected() -> None:
    with pytest.raises(MarketRuleError, match="before 23:00"):
        resolve_gate("epex_hourly", "23:30")


def test_unknown_gate_is_rejected() -> None:
    with pytest.raises(MarketRuleError, match="Unknown gate"):
        resolve_gate("apx")
