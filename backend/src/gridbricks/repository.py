"""Data access. The app depends on the ``DataRepository`` protocol, not on files.

The pilot reads a committed snapshot (gzipped JSON plus a checksummed manifest). A database
adapter can implement the same protocol later without touching the analytics.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

import pandas as pd

from gridbricks.domain.frames import (
    ACTUAL_COLUMNS,
    GENERATION_MW,
    PUBLISH_TIME,
    SETTLEMENT_DATE,
    SETTLEMENT_PERIOD,
    START_TIME,
    to_utc,
)

FORECASTS_FILE = "windfor.json.gz"
ACTUALS_FILE = "fuelhh_wind.json.gz"
MANIFEST_FILE = "manifest.json"


class SnapshotUnavailableError(RuntimeError):
    """The data snapshot is missing or fails its integrity check."""


@dataclass(frozen=True, slots=True)
class DatasetManifest:
    dataset: str
    endpoint: str
    params: dict[str, str]
    file: str
    rows: int
    sha256: str


@dataclass(frozen=True, slots=True)
class SnapshotManifest:
    generated_at: datetime
    source: str
    datasets: dict[str, DatasetManifest] = field(default_factory=dict)

    @property
    def version(self) -> str:
        """Short content hash identifying this snapshot (used in ETags)."""
        digest = hashlib.sha256("".join(sorted(d.sha256 for d in self.datasets.values())).encode())
        return digest.hexdigest()[:12]

    def to_json(self) -> dict[str, Any]:
        return {
            "generated_at": self.generated_at.isoformat(),
            "source": self.source,
            "datasets": {
                name: {
                    "dataset": d.dataset,
                    "endpoint": d.endpoint,
                    "params": d.params,
                    "file": d.file,
                    "rows": d.rows,
                    "sha256": d.sha256,
                }
                for name, d in sorted(self.datasets.items())
            },
        }

    @classmethod
    def from_json(cls, payload: dict[str, Any]) -> SnapshotManifest:
        return cls(
            generated_at=datetime.fromisoformat(payload["generated_at"]),
            source=payload["source"],
            datasets={name: DatasetManifest(**d) for name, d in payload["datasets"].items()},
        )


class DataRepository(Protocol):
    def load_forecasts(self) -> pd.DataFrame:
        """WINDFOR runs: ``publish_time``, ``start_time``, ``generation_mw`` (UTC, MW)."""
        ...

    def load_actuals(self) -> pd.DataFrame:
        """FUELHH WIND outturn: ``start_time``, ``publish_time``, settlement fields, MW."""
        ...

    def manifest(self) -> SnapshotManifest: ...


def canonical_json_bytes(records: list[dict[str, Any]]) -> bytes:
    return json.dumps(records, separators=(",", ":"), sort_keys=True).encode()


def forecasts_frame(records: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            PUBLISH_TIME: to_utc([r["publishTime"] for r in records]),
            START_TIME: to_utc([r["startTime"] for r in records]),
            GENERATION_MW: pd.Series([r["generation"] for r in records], dtype="float64"),
        }
    )


def actuals_frame(records: list[dict[str, Any]]) -> pd.DataFrame:
    frame = pd.DataFrame(
        {
            START_TIME: to_utc([r["startTime"] for r in records]),
            PUBLISH_TIME: to_utc([r["publishTime"] for r in records]),
            SETTLEMENT_DATE: [datetime.fromisoformat(r["settlementDate"]).date() for r in records],
            SETTLEMENT_PERIOD: pd.Series([r["settlementPeriod"] for r in records], dtype="int64"),
            GENERATION_MW: pd.Series([r["generation"] for r in records], dtype="float64"),
        }
    )
    return frame[ACTUAL_COLUMNS]


class SnapshotRepository:
    """Reads the committed snapshot and verifies each file against its manifest checksum."""

    def __init__(self, data_dir: Path) -> None:
        self._dir = data_dir

    def manifest(self) -> SnapshotManifest:
        path = self._dir / MANIFEST_FILE
        if not path.is_file():
            raise SnapshotUnavailableError(
                f"No data snapshot at {self._dir}. Run `python -m gridbricks.ingest` first."
            )
        return SnapshotManifest.from_json(json.loads(path.read_text()))

    def load_forecasts(self) -> pd.DataFrame:
        return forecasts_frame(self._read_dataset("WINDFOR"))

    def load_actuals(self) -> pd.DataFrame:
        return actuals_frame(self._read_dataset("FUELHH"))

    def _read_dataset(self, name: str) -> list[dict[str, Any]]:
        entry = self.manifest().datasets.get(name)
        if entry is None:
            raise SnapshotUnavailableError(f"Dataset {name} is missing from the manifest.")
        path = self._dir / entry.file
        try:
            raw = gzip.decompress(path.read_bytes())
        except OSError as exc:
            raise SnapshotUnavailableError(f"Cannot read {path}: {exc}") from exc
        if hashlib.sha256(raw).hexdigest() != entry.sha256:
            raise SnapshotUnavailableError(f"Checksum mismatch for {path}; re-run the ingest.")
        records: list[dict[str, Any]] = json.loads(raw)
        return records


class InMemoryRepository:
    """Repository backed by ready-made frames: used by tests and ad-hoc analysis."""

    def __init__(
        self, forecasts: pd.DataFrame, actuals: pd.DataFrame, manifest: SnapshotManifest
    ) -> None:
        self._forecasts = forecasts
        self._actuals = actuals
        self._manifest = manifest

    def load_forecasts(self) -> pd.DataFrame:
        return self._forecasts.copy()

    def load_actuals(self) -> pd.DataFrame:
        return self._actuals.copy()

    def manifest(self) -> SnapshotManifest:
        return self._manifest
