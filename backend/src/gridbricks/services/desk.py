"""Facade the HTTP layer talks to: validates scope, caches decision tables, builds views."""

from __future__ import annotations

import threading
from collections import OrderedDict
from datetime import date, time, timedelta

from gridbricks.config import Settings
from gridbricks.domain.market import PRESETS, Gate, resolve_gate
from gridbricks.errors import ScopeError
from gridbricks.repository import DataRepository, SnapshotUnavailableError
from gridbricks.schemas import (
    AccuracyResponse,
    BriefResponse,
    EvolutionResponse,
    HorizonResponse,
    MetaResponse,
    QualityResponse,
)
from gridbricks.services.accuracy import build_accuracy, build_horizon
from gridbricks.services.brief import brief_csv, build_brief, build_evolution
from gridbricks.services.dataset import DeskData, load_desk_data
from gridbricks.services.decision_table import DecisionTable, build_decision_table
from gridbricks.services.reference import build_meta, build_quality

#: Decision tables for presets stay cached; custom cutoffs share a small LRU.
_MAX_CACHED_TABLES = 16


class DeskService:
    def __init__(self, repository: DataRepository, settings: Settings) -> None:
        self._repository = repository
        self._settings = settings
        self._lock = threading.RLock()
        self._data: DeskData | None = None
        self._tables: OrderedDict[time, DecisionTable] = OrderedDict()

    @property
    def settings(self) -> Settings:
        return self._settings

    # --- Data and caches ---------------------------------------------------------------

    @property
    def data(self) -> DeskData:
        if self._data is None:
            with self._lock:
                if self._data is None:
                    self._data = load_desk_data(self._repository)
        return self._data

    def snapshot_version(self) -> str | None:
        try:
            return self._repository.manifest().version
        except SnapshotUnavailableError:
            return None

    def delivery_dates(self) -> list[date]:
        """Warm-up calibration days plus every in-scope delivery day."""
        first, last = self._settings.warmup_start_date, self._settings.last_delivery_date
        return [first + timedelta(days=i) for i in range((last - first).days + 1)]

    def table(self, gate: Gate) -> DecisionTable:
        key = gate.gate_closure
        with self._lock:
            cached = self._tables.get(key)
            if cached is not None:
                self._tables.move_to_end(key)
                return cached
            table = build_decision_table(
                self.data, self.delivery_dates(), key, self._settings.calibration
            )
            self._tables[key] = table
            while len(self._tables) > _MAX_CACHED_TABLES:
                self._tables.popitem(last=False)
            return table

    def warm_up(self) -> None:
        """Load data and build every preset's table so the first request is fast."""
        for preset_id in PRESETS:
            self.table(resolve_gate(preset_id))

    # --- Scope -------------------------------------------------------------------------

    def check_decision_date(self, decision_date: date) -> None:
        first, last = self._settings.first_decision_date, self._settings.last_decision_date
        if not first <= decision_date <= last:
            raise ScopeError(
                f"Decision date {decision_date} is outside the pilot scope ({first} to {last})."
            )

    def decision_range(self, start: date | None, end: date | None) -> tuple[date, date]:
        start = start or self._settings.first_decision_date
        end = end or self._settings.last_decision_date
        self.check_decision_date(start)
        self.check_decision_date(end)
        if start > end:
            raise ScopeError("decision_from must not be after decision_to.")
        return start, end

    # --- Views -------------------------------------------------------------------------

    def brief(self, decision_date: date, gate: Gate) -> BriefResponse:
        self.check_decision_date(decision_date)
        return build_brief(self.data, self.table(gate), decision_date, gate)

    def brief_csv(self, decision_date: date, gate: Gate) -> str:
        return brief_csv(self.brief(decision_date, gate))

    def evolution(self, decision_date: date, gate: Gate) -> EvolutionResponse:
        self.check_decision_date(decision_date)
        return build_evolution(self.data, self.table(gate), decision_date, gate)

    def accuracy(
        self, gate: Gate, decision_from: date | None = None, decision_to: date | None = None
    ) -> AccuracyResponse:
        start, end = self.decision_range(decision_from, decision_to)
        comparisons = [(g, self.table(g)) for g in (resolve_gate(p) for p in PRESETS)]
        if gate.is_custom:
            comparisons.append((gate, self.table(gate)))
        return build_accuracy(self.data, gate, self.table(gate), comparisons, start, end)

    def horizon(self, gate: Gate) -> HorizonResponse:
        s = self._settings
        return build_horizon(
            self.data, gate, self.table(gate), s.first_delivery_date, s.last_delivery_date
        )

    def quality(self) -> QualityResponse:
        return build_quality(self.data, self._settings)

    def meta(self) -> MetaResponse:
        return build_meta(self.data, self._settings)
