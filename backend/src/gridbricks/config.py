"""Runtime configuration (12-factor): any setting can be overridden by a GRIDBRICKS_* variable."""

from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from gridbricks.domain.calibration import CalibrationConfig

PACKAGE_DIR = Path(__file__).resolve().parent
#: backend/data/snapshot, resolved relative to the source tree so it works in Docker and Vercel.
DEFAULT_DATA_DIR = PACKAGE_DIR.parents[1] / "data" / "snapshot"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GRIDBRICKS_", env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    log_json: bool = False

    data_dir: Path = DEFAULT_DATA_DIR
    static_dir: Path | None = None
    cors_origins: list[str] = Field(default_factory=list)

    # Scope: purchase decisions taken on these days (inclusive), each for delivery the next day.
    first_decision_date: date = date(2026, 1, 1)
    last_decision_date: date = date(2026, 1, 31)

    calibration_window_days: int = Field(default=14, ge=1, le=90)
    calibration_gap_days: int = Field(default=2, ge=2, le=14)
    calibration_min_samples: int = Field(default=48, ge=1)

    # Browser and CDN caching of API responses. The data is immutable within a deployment.
    browser_cache_seconds: int = 300
    cdn_cache_seconds: int = 86_400

    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    elexon_timeout_seconds: float = 30.0
    elexon_chunk_days: int = Field(default=7, ge=1, le=31)

    @model_validator(mode="after")
    def _check_scope(self) -> Settings:
        if self.first_decision_date > self.last_decision_date:
            raise ValueError("first_decision_date must not be after last_decision_date.")
        return self

    @property
    def calibration(self) -> CalibrationConfig:
        return CalibrationConfig(
            window_days=self.calibration_window_days,
            gap_days=self.calibration_gap_days,
            min_samples=self.calibration_min_samples,
        )

    @property
    def first_delivery_date(self) -> date:
        return self.first_decision_date + timedelta(days=1)

    @property
    def last_delivery_date(self) -> date:
        return self.last_decision_date + timedelta(days=1)

    @property
    def warmup_start_date(self) -> date:
        """Earliest delivery day whose errors calibrate the first in-scope decision."""
        return self.calibration.window_for(self.first_delivery_date)[0]


@lru_cache
def get_settings() -> Settings:
    return Settings()
