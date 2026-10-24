"""Provider-neutral daily futures bars and history batches."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date, datetime
from math import isfinite
from typing import Literal

SeriesKind = Literal["single_contract", "continuous_proxy"]

@dataclass(frozen=True, slots=True)
class FuturesDailyBar:
    trading_date: date
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    volume: int | None
    open_interest: int | None
    settlement_price: float | None

@dataclass(frozen=True, slots=True)
class FuturesDailyHistory:
    symbol: str
    exchange: str
    provider: str
    fetched_at: datetime
    series_kind: SeriesKind
    bars: tuple[FuturesDailyBar, ...]
    rows_skipped: int = 0
    duplicate_dates_skipped: int = 0

    @property
    def first_date(self) -> date | None:
        return self.bars[0].trading_date if self.bars else None

    @property
    def last_date(self) -> date | None:
        return self.bars[-1].trading_date if self.bars else None

def valid_ohlc(open_price: float, high_price: float, low_price: float, close_price: float) -> bool:
    values = (open_price, high_price, low_price, close_price)
    return (
        all(isfinite(float(v)) and float(v) > 0 for v in values)
        and high_price >= max(open_price, low_price, close_price)
        and low_price <= min(open_price, high_price, close_price)
    )
