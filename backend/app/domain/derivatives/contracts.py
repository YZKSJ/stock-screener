"""Provider-neutral contracts and quote observations."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import isfinite

SUPPORTED_EXCHANGES = frozenset({"SHFE", "DCE", "CZCE", "CFFEX", "INE", "GFEX"})


def _positive_finite(value: float, field_name: str) -> None:
    if not isfinite(float(value)) or float(value) <= 0:
        raise ValueError(f"{field_name} must be finite and greater than zero")


@dataclass(frozen=True, slots=True)
class FuturesContract:
    """Minimal contract identity required for safe price interpretation."""
    symbol: str
    exchange: str
    product: str
    multiplier: float
    tick_size: float
    currency: str = "CNY"

    def __post_init__(self) -> None:
        symbol = self.symbol.strip().upper()
        exchange = self.exchange.strip().upper()
        product = self.product.strip().upper()
        currency = self.currency.strip().upper()
        if not symbol:
            raise ValueError("symbol is required")
        if exchange not in SUPPORTED_EXCHANGES:
            raise ValueError(f"unsupported exchange: {exchange or '(empty)'}")
        if not product:
            raise ValueError("product is required")
        _positive_finite(self.multiplier, "multiplier")
        _positive_finite(self.tick_size, "tick_size")
        if not currency:
            raise ValueError("currency is required")
        object.__setattr__(self, "symbol", symbol)
        object.__setattr__(self, "exchange", exchange)
        object.__setattr__(self, "product", product)
        object.__setattr__(self, "currency", currency)

    @property
    def instrument_id(self) -> str:
        """Stable display key; the contract symbol remains exchange-specific."""
        return f"{self.symbol}.{self.exchange}"


@dataclass(frozen=True, slots=True)
class FuturesMarketObservation:
    """One normalized quote/tick snapshot with explicit source timestamps."""
    symbol: str
    exchange: str
    as_of: datetime
    fetched_at: datetime
    last_price: float | None
    volume: float | None = None
    open_interest: float | None = None
    open_price: float | None = None
    high_price: float | None = None
    low_price: float | None = None
    prev_close: float | None = None
    bid_price_1: float | None = None
    ask_price_1: float | None = None
    source: str = "unspecified"

    def __post_init__(self) -> None:
        object.__setattr__(self, "symbol", self.symbol.strip().upper())
        object.__setattr__(self, "exchange", self.exchange.strip().upper())
        object.__setattr__(self, "source", self.source.strip() or "unspecified")
