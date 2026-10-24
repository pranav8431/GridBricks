"""Snapshot ingest: ``python -m gridbricks.ingest``.

Fetches the WINDFOR runs and FUELHH wind outturn needed for the configured decision window,
including the calibration warm-up, validates them, and writes a deterministic snapshot:
gzipped canonical JSON plus a manifest with request parameters, row counts and checksums.
Re-running against unchanged source data produces byte-identical files.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Any

from gridbricks.config import Settings, get_settings
from gridbricks.domain.market import delivery_window
from gridbricks.elexon.client import FUELHH_PATH, WINDFOR_PATH, ElexonClient
from gridbricks.logging_config import configure_logging, get_logger
from gridbricks.repository import (
    ACTUALS_FILE,
    FORECASTS_FILE,
    MANIFEST_FILE,
    DatasetManifest,
    SnapshotManifest,
    canonical_json_bytes,
)

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class IngestWindows:
    publish_from: datetime
    publish_to: datetime
    settlement_from: date
    settlement_to: date


def default_windows(settings: Settings) -> IngestWindows:
    """Everything the app needs: warm-up calibration days through the last delivery day."""
    earliest_delivery = settings.warmup_start_date
    # Runs from two days before the earliest decision cover its delivery day and any fallback.
    publish_from = datetime.combine(earliest_delivery - timedelta(days=3), time(0), tzinfo=UTC)
    _, publish_to = delivery_window(settings.last_delivery_date)
    return IngestWindows(
        publish_from=publish_from,
        publish_to=publish_to,
        # The delivery window starts at 23:00 the previous evening.
        settlement_from=earliest_delivery - timedelta(days=1),
        settlement_to=settings.last_delivery_date,
    )


def _write_gz(path: Path, records: list[dict[str, Any]]) -> tuple[int, str]:
    raw = canonical_json_bytes(records)
    with (
        path.open("wb") as handle,
        gzip.GzipFile(filename="", mode="wb", fileobj=handle, compresslevel=9, mtime=0) as gz,
    ):
        gz.write(raw)
    return len(records), hashlib.sha256(raw).hexdigest()


def run_ingest(client: ElexonClient, windows: IngestWindows, out_dir: Path) -> SnapshotManifest:
    out_dir.mkdir(parents=True, exist_ok=True)
    forecasts = client.wind_forecasts(windows.publish_from, windows.publish_to)
    actuals = client.wind_actuals(windows.settlement_from, windows.settlement_to)
    if not forecasts or not actuals:
        raise RuntimeError("Elexon returned no data for the requested windows.")

    f_rows, f_sha = _write_gz(out_dir / FORECASTS_FILE, [r.to_snapshot() for r in forecasts])
    a_rows, a_sha = _write_gz(out_dir / ACTUALS_FILE, [r.to_snapshot() for r in actuals])
    manifest = SnapshotManifest(
        generated_at=datetime.now(UTC).replace(microsecond=0),
        source="Elexon BMRS Insights API (https://data.elexon.co.uk/bmrs/api/v1)",
        datasets={
            "WINDFOR": DatasetManifest(
                dataset="WINDFOR",
                endpoint=WINDFOR_PATH,
                params={
                    "publishDateTimeFrom": windows.publish_from.isoformat(),
                    "publishDateTimeTo": windows.publish_to.isoformat(),
                },
                file=FORECASTS_FILE,
                rows=f_rows,
                sha256=f_sha,
            ),
            "FUELHH": DatasetManifest(
                dataset="FUELHH",
                endpoint=FUELHH_PATH,
                params={
                    "settlementDateFrom": windows.settlement_from.isoformat(),
                    "settlementDateTo": windows.settlement_to.isoformat(),
                    "fuelType": "WIND",
                },
                file=ACTUALS_FILE,
                rows=a_rows,
                sha256=a_sha,
            ),
        },
    )
    (out_dir / MANIFEST_FILE).write_text(json.dumps(manifest.to_json(), indent=2) + "\n")
    log.info("ingest.complete", forecasts=f_rows, actuals=a_rows, version=manifest.version)
    return manifest


def _parse_args(
    argv: list[str] | None, defaults: IngestWindows, settings: Settings
) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0] if __doc__ else None)
    parser.add_argument("--out", type=Path, default=settings.data_dir, help="snapshot directory")
    parser.add_argument(
        "--publish-from", type=datetime.fromisoformat, default=defaults.publish_from
    )
    parser.add_argument("--publish-to", type=datetime.fromisoformat, default=defaults.publish_to)
    parser.add_argument(
        "--settlement-from", type=date.fromisoformat, default=defaults.settlement_from
    )
    parser.add_argument("--settlement-to", type=date.fromisoformat, default=defaults.settlement_to)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)
    args = _parse_args(argv, default_windows(settings), settings)
    windows = IngestWindows(
        publish_from=args.publish_from.astimezone(UTC),
        publish_to=args.publish_to.astimezone(UTC),
        settlement_from=args.settlement_from,
        settlement_to=args.settlement_to,
    )
    log.info("ingest.start", windows=str(windows), out=str(args.out))
    with ElexonClient(
        settings.elexon_base_url,
        timeout_seconds=settings.elexon_timeout_seconds,
        chunk_days=settings.elexon_chunk_days,
    ) as client:
        run_ingest(client, windows, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
