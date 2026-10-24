from __future__ import annotations

import itertools
from datetime import date, timedelta

import httpx
import pytest
import respx
from tenacity import wait_none

from factories import utc
from gridbricks.elexon.client import ElexonClient, ElexonError, date_chunks, datetime_chunks

BASE = "https://elexon.test/api/v1"
WINDFOR = f"{BASE}/datasets/WINDFOR/stream"
FUELHH = f"{BASE}/datasets/FUELHH/stream"


def forecast_item(publish: str, start: str, mw: float = 1000.0) -> dict[str, object]:
    return {"dataset": "WINDFOR", "publishTime": publish, "startTime": start, "generation": mw}


def actual_item(
    start: str, publish: str, mw: float = 900.0, fuel: str = "WIND"
) -> dict[str, object]:
    return {
        "dataset": "FUELHH",
        "publishTime": publish,
        "startTime": start,
        "settlementDate": start[:10],
        "settlementPeriod": 1,
        "fuelType": fuel,
        "generation": mw,
    }


def client(**kwargs: object) -> ElexonClient:
    return ElexonClient(BASE, retry_wait=wait_none(), **kwargs)  # type: ignore[arg-type]


def test_datetime_chunks_cover_the_range_without_gaps() -> None:
    chunks = list(datetime_chunks(utc(2026, 1, 1), utc(2026, 1, 20), timedelta(days=7)))
    assert chunks[0][0] == utc(2026, 1, 1)
    assert chunks[-1][1] == utc(2026, 1, 20)
    assert all(a[1] == b[0] for a, b in itertools.pairwise(chunks))


def test_date_chunks_are_inclusive_and_disjoint() -> None:
    chunks = list(date_chunks(date(2026, 1, 1), date(2026, 1, 15), 7))
    assert chunks == [
        (date(2026, 1, 1), date(2026, 1, 7)),
        (date(2026, 1, 8), date(2026, 1, 14)),
        (date(2026, 1, 15), date(2026, 1, 15)),
    ]


@respx.mock
def test_retries_transient_errors_then_succeeds() -> None:
    route = respx.get(WINDFOR).mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(429),
            httpx.Response(
                200, json=[forecast_item("2026-01-14T07:30:00Z", "2026-01-15T00:00:00Z")]
            ),
        ]
    )
    records = client().wind_forecasts(utc(2026, 1, 14), utc(2026, 1, 15))
    assert route.call_count == 3
    assert len(records) == 1
    assert records[0].generation == 1000.0


@respx.mock
def test_gives_up_after_max_attempts() -> None:
    respx.get(WINDFOR).mock(return_value=httpx.Response(502))
    with pytest.raises(httpx.HTTPStatusError):
        client(max_attempts=2).wind_forecasts(utc(2026, 1, 14), utc(2026, 1, 15))


@respx.mock
def test_client_errors_are_not_retried() -> None:
    route = respx.get(WINDFOR).mock(return_value=httpx.Response(400))
    with pytest.raises(httpx.HTTPStatusError):
        client().wind_forecasts(utc(2026, 1, 14), utc(2026, 1, 15))
    assert route.call_count == 1


@respx.mock
def test_chunks_requests_and_deduplicates_boundary_rows() -> None:
    item = forecast_item("2026-01-08T00:00:00Z", "2026-01-09T00:00:00Z")
    route = respx.get(WINDFOR).mock(return_value=httpx.Response(200, json=[item]))
    records = client(chunk_days=7).wind_forecasts(utc(2026, 1, 1), utc(2026, 1, 15))
    assert route.call_count == 2
    assert len(records) == 1
    first = route.calls[0].request.url.params
    assert first["publishDateTimeFrom"] == "2026-01-01T00:00:00Z"
    assert first["publishDateTimeTo"] == "2026-01-08T00:00:00Z"


@respx.mock
def test_actuals_keep_the_latest_publication() -> None:
    respx.get(FUELHH).mock(
        return_value=httpx.Response(
            200,
            json=[
                actual_item("2026-01-14T00:00:00Z", "2026-01-14T00:30:00Z", 900.0),
                actual_item("2026-01-14T00:00:00Z", "2026-01-14T02:00:00Z", 950.0),
            ],
        )
    )
    records = client().wind_actuals(date(2026, 1, 14), date(2026, 1, 14))
    assert [r.generation for r in records] == [950.0]


@respx.mock
def test_unexpected_payloads_raise_clear_errors() -> None:
    respx.get(WINDFOR).mock(return_value=httpx.Response(200, json={"error": "nope"}))
    with pytest.raises(ElexonError, match="JSON array"):
        client().wind_forecasts(utc(2026, 1, 14), utc(2026, 1, 15))

    respx.get(WINDFOR).mock(return_value=httpx.Response(200, json=[{"dataset": "WINDFOR"}]))
    with pytest.raises(ElexonError, match="Unexpected WindForecastRecord"):
        client().wind_forecasts(utc(2026, 1, 14), utc(2026, 1, 15))

    respx.get(FUELHH).mock(
        return_value=httpx.Response(
            200, json=[actual_item("2026-01-14T00:00:00Z", "2026-01-14T00:30:00Z", fuel="CCGT")]
        )
    )
    with pytest.raises(ElexonError, match="fuelType WIND"):
        client().wind_actuals(date(2026, 1, 14), date(2026, 1, 14))
