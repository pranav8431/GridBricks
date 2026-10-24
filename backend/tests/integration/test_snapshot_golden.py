"""Golden tests on the committed January 2026 snapshot.

They pin the headline numbers shown to the client, so any change to the methodology that moves
them is deliberate and reviewed.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from gridbricks.domain.market import resolve_gate
from gridbricks.services.desk import DeskService

pytestmark = pytest.mark.snapshot

EPEX = resolve_gate("epex_hourly")


def test_headline_accuracy_at_0920(snapshot_desk: DeskService) -> None:
    result = snapshot_desk.accuracy(EPEX)
    assert result.published.n == 744
    assert result.published.mae_mw == pytest.approx(2019, abs=2)
    assert result.published.rmse_mw == pytest.approx(2491, abs=2)
    assert result.published.bias_mw == pytest.approx(1747, abs=2)
    assert result.adjusted is not None
    assert result.adjusted.mae_mw == pytest.approx(1236, abs=2)
    assert result.band_coverage == pytest.approx(0.801, abs=0.005)
    assert result.worst_days[0].delivery_date == date(2026, 1, 28)


def test_correction_halves_the_daily_energy_error(snapshot_desk: DeskService) -> None:
    days = [
        d for d in snapshot_desk.accuracy(EPEX).daily if d.adjusted_energy_error_gwh is not None
    ]
    published = sum(abs(d.energy_error_gwh or 0) for d in days) / len(days)
    corrected = sum(abs(d.adjusted_energy_error_gwh or 0) for d in days) / len(days)
    assert published == pytest.approx(43.3, abs=0.2)
    assert corrected == pytest.approx(22.4, abs=0.2)


def test_waiting_for_later_runs_helps_less_than_correcting_bias(snapshot_desk: DeskService) -> None:
    result = snapshot_desk.accuracy(EPEX)
    by_gate = {c.gate.id: c for c in result.gate_comparison}
    assert by_gate["epex_hourly"].typical_run_uk == "07:30"
    assert by_gate["n2ex"].typical_run_uk == "09:30"
    assert by_gate["epex_halfhourly"].typical_run_uk == "11:30"
    best_wait = by_gate["epex_hourly"].mae_mw - by_gate["epex_halfhourly"].mae_mw
    correction = result.published.mae_mw - (result.adjusted.mae_mw if result.adjusted else 0)
    assert correction > 3 * best_wait


def test_bias_grows_with_wind_level(snapshot_desk: DeskService) -> None:
    levels = [b for b in snapshot_desk.accuracy(EPEX).by_level if b.n >= 100]
    biases = [b.bias_mw or 0.0 for b in levels]
    assert biases[-1] > 2 * biases[0]


@pytest.mark.parametrize(
    ("gate", "decision", "expected_run"),
    [
        ("epex_hourly", date(2026, 1, 14), "07:30"),
        ("n2ex", date(2026, 1, 14), "09:30"),
        ("epex_halfhourly", date(2026, 1, 15), "12:25"),  # the late run on 15 Jan
    ],
)
def test_decision_runs(
    snapshot_desk: DeskService, gate: str, decision: date, expected_run: str
) -> None:
    brief = snapshot_desk.brief(decision, resolve_gate(gate))
    assert brief.decision_run is not None
    assert brief.decision_run.strftime("%H:%M") == expected_run


def test_every_january_decision_has_a_full_brief(snapshot_desk: DeskService) -> None:
    for offset in range(31):
        brief = snapshot_desk.brief(date(2026, 1, 1) + timedelta(days=offset), EPEX)
        assert len(brief.hours) == 24
        assert brief.calibration.sufficient
        assert brief.energy.actual_gwh is not None
        assert all(h.forecast_mw is not None for h in brief.hours)


def test_data_quality_findings(snapshot_desk: DeskService) -> None:
    quality = snapshot_desk.quality()
    assert quality.actual_periods_present == quality.actual_periods_expected == 2208
    assert [t.strftime("%d %H:%M") for t in quality.off_schedule_runs] == ["15 12:25"]
    assert len(quality.run_schedule_utc) == 8
