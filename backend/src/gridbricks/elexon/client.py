"""HTTP client for the Elexon BMRS Insights API: chunked, retried and validated."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from types import TracebackType
from typing import Any, Self

import httpx
from pydantic import ValidationError
from tenacity import (
    Retrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential_jitter,
)
from tenacity.wait import WaitBaseT

from gridbricks import __version__
from gridbricks.elexon.models import FuelHHRecord, WindForecastRecord
from gridbricks.logging_config import get_logger

DEFAULT_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
WINDFOR_PATH = "/datasets/WINDFOR/stream"
FUELHH_PATH = "/datasets/FUELHH/stream"

log = get_logger(__name__)


class ElexonError(RuntimeError):
    """The API returned something unusable after all retries."""


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        return status == 429 or status >= 500
    return False


def _iso_z(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def datetime_chunks(
    start: datetime, end: datetime, size: timedelta
) -> Iterator[tuple[datetime, datetime]]:
    """Split ``[start, end]`` into consecutive windows no longer than ``size``."""
    if end < start:
        raise ValueError("end must not be before start.")
    cursor = start
    while cursor < end:
        upper = min(cursor + size, end)
        yield cursor, upper
        cursor = upper


def date_chunks(start: date, end: date, days: int) -> Iterator[tuple[date, date]]:
    """Split the inclusive date range ``[start, end]`` into non-overlapping inclusive chunks."""
    if end < start:
        raise ValueError("end must not be before start.")
    cursor = start
    while cursor <= end:
        upper = min(cursor + timedelta(days=days - 1), end)
        yield cursor, upper
        cursor = upper + timedelta(days=1)


class ElexonClient:
    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        *,
        timeout_seconds: float = 30.0,
        chunk_days: int = 7,
        max_attempts: int = 5,
        retry_wait: WaitBaseT | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._chunk_days = chunk_days
        self._max_attempts = max_attempts
        self._retry_wait = retry_wait or wait_exponential_jitter(initial=0.5, max=10)
        self._http = httpx.Client(
            base_url=base_url,
            timeout=timeout_seconds,
            transport=transport,
            headers={"Accept": "application/json", "User-Agent": f"gridbricks/{__version__}"},
        )

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def wind_forecasts(
        self, publish_from: datetime, publish_to: datetime
    ) -> list[WindForecastRecord]:
        """Every WINDFOR run published in ``[publish_from, publish_to]``, deduplicated."""
        unique: dict[tuple[str, str], WindForecastRecord] = {}
        for lo, hi in datetime_chunks(publish_from, publish_to, timedelta(days=self._chunk_days)):
            params = {"publishDateTimeFrom": _iso_z(lo), "publishDateTimeTo": _iso_z(hi)}
            for item in self._get_list(WINDFOR_PATH, params):
                record = self._validate(WindForecastRecord, item)
                unique[record.key] = record
        return sorted(unique.values(), key=lambda r: (r.publish_time, r.start_time))

    def wind_actuals(self, settlement_from: date, settlement_to: date) -> list[FuelHHRecord]:
        """FUELHH wind outturn for settlement dates in the inclusive range, latest publish wins."""
        latest: dict[datetime, FuelHHRecord] = {}
        for lo, hi in date_chunks(settlement_from, settlement_to, self._chunk_days):
            params = {
                "settlementDateFrom": lo.isoformat(),
                "settlementDateTo": hi.isoformat(),
                "fuelType": "WIND",
            }
            for item in self._get_list(FUELHH_PATH, params):
                record = self._validate(FuelHHRecord, item)
                if record.fuel_type != "WIND":
                    raise ElexonError(f"Expected fuelType WIND, got {record.fuel_type!r}.")
                current = latest.get(record.start_time)
                if current is None or record.publish_time > current.publish_time:
                    latest[record.start_time] = record
        return sorted(latest.values(), key=lambda r: r.start_time)

    @staticmethod
    def _validate[T: (WindForecastRecord, FuelHHRecord)](model: type[T], item: Any) -> T:
        try:
            return model.model_validate(item)
        except ValidationError as exc:
            raise ElexonError(f"Unexpected {model.__name__} payload: {exc}") from exc

    def _get_list(self, path: str, params: dict[str, str]) -> list[Any]:
        retrying = Retrying(
            stop=stop_after_attempt(self._max_attempts),
            wait=self._retry_wait,
            retry=retry_if_exception(_is_retryable),
            reraise=True,
        )
        for attempt in retrying:
            with attempt:
                number = attempt.retry_state.attempt_number
                log.debug("elexon.request", path=path, params=params, attempt=number)
                response = self._http.get(path, params=params)
                response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            raise ElexonError(f"Expected a JSON array from {path}, got {type(payload).__name__}.")
        return payload
