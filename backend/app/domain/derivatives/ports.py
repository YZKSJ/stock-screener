"""Ports for domestic derivatives market-data providers."""
from __future__ import annotations

from datetime import datetime
from typing import Protocol, Sequence, runtime_checkable

from .contracts import FuturesContract, FuturesMarketObservation


@runtime_checkable
class FuturesMarketDataProvider(Protocol):
    """Adapter contract; provider-specific types must not leak into the domain."""

    @property
    def provider_name(self) -> str:
        """Stable provider identifier used for provenance."""

    def latest_snapshot(self, contract: FuturesContract) -> FuturesMarketObservation:
        """Return the latest observation or raise a provider-specific exception."""

    def history(
        self,
        contract: FuturesContract,
        *,
        start: datetime,
        end: datetime,
        interval: str,
    ) -> Sequence[FuturesMarketObservation]:
        """Return observations in [start, end] for a supported interval."""
