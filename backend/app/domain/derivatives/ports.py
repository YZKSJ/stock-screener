"""Ports for domestic derivatives market-data providers."""
from __future__ import annotations
from datetime import date, datetime
from typing import Protocol, Sequence, runtime_checkable
from .contracts import FuturesContract, FuturesMarketObservation
from .history import FuturesDailyHistory

@runtime_checkable
class FuturesMarketDataProvider(Protocol):
    @property
    def provider_name(self) -> str: ...
    def latest_snapshot(self, contract: FuturesContract) -> FuturesMarketObservation: ...
    def history(self, contract: FuturesContract, *, start: datetime, end: datetime, interval: str) -> Sequence[FuturesMarketObservation]: ...

@runtime_checkable
class FuturesHistoryProvider(Protocol):
    @property
    def provider_name(self) -> str: ...
    def daily_history(self, contract: FuturesContract, *, start_date: date, end_date: date) -> FuturesDailyHistory: ...
