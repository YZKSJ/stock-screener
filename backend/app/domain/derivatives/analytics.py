"""Deterministic descriptive indicators for a supplied futures daily series."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from math import log, sqrt
from statistics import mean, stdev
from typing import Literal, Sequence
from .history import FuturesDailyBar

TrendState = Literal["uptrend", "downtrend", "mixed", "insufficient_history"]

@dataclass(frozen=True, slots=True)
class DailyFuturesIndicators:
    as_of_date: date
    bar_count: int
    latest_close: float
    return_1_bar_pct: float | None
    return_5_bar_pct: float | None
    return_20_bar_pct: float | None
    sma_5: float | None
    sma_20: float | None
    above_sma_20: bool | None
    realized_volatility_20_annualized_pct: float | None
    volume_ratio_5_to_previous_20: float | None
    open_interest_change_5_bar_pct: float | None
    intraday_range_pct: float
    trend_state: TrendState

def _change_pct(current: float, previous: float | None) -> float | None:
    if previous is None or previous <= 0 or current <= 0:
        return None
    return (current / previous - 1.0) * 100.0

def calculate_daily_indicators(
    bars: Sequence[FuturesDailyBar], *, annualization_periods: int = 252
) -> DailyFuturesIndicators | None:
    """Calculate descriptive values from the supplied bars in date order."""
    if annualization_periods < 1:
        raise ValueError("annualization_periods must be positive")
    ordered = sorted(bars, key=lambda bar: bar.trading_date)
    if not ordered:
        return None
    closes = [bar.close_price for bar in ordered]
    latest = ordered[-1]
    sma_5 = mean(closes[-5:]) if len(closes) >= 5 else None
    sma_20 = mean(closes[-20:]) if len(closes) >= 20 else None
    above_sma_20 = latest.close_price > sma_20 if sma_20 is not None else None
    return_1 = _change_pct(closes[-1], closes[-2]) if len(closes) >= 2 else None
    return_5 = _change_pct(closes[-1], closes[-6]) if len(closes) >= 6 else None
    return_20 = _change_pct(closes[-1], closes[-21]) if len(closes) >= 21 else None

    rv20 = None
    if len(closes) >= 21:
        tail = closes[-21:]
        log_returns = [log(tail[i] / tail[i - 1]) for i in range(1, len(tail))]
        rv20 = stdev(log_returns) * sqrt(annualization_periods) * 100.0

    volume_ratio = None
    if len(ordered) >= 25:
        prior = [bar.volume for bar in ordered[-25:-5]]
        recent = [bar.volume for bar in ordered[-5:]]
        if all(value is not None for value in prior + recent):
            baseline = mean(prior)
            if baseline > 0:
                volume_ratio = mean(recent) / baseline

    oi_change = None
    if len(ordered) >= 6:
        current_oi = latest.open_interest
        previous_oi = ordered[-6].open_interest
        oi_change = _change_pct(float(current_oi), float(previous_oi)) if (
            current_oi is not None and previous_oi is not None
        ) else None

    range_pct = (latest.high_price - latest.low_price) / latest.close_price * 100.0
    if sma_5 is None or sma_20 is None:
        trend_state: TrendState = "insufficient_history"
    elif latest.close_price > sma_20 and sma_5 > sma_20:
        trend_state = "uptrend"
    elif latest.close_price < sma_20 and sma_5 < sma_20:
        trend_state = "downtrend"
    else:
        trend_state = "mixed"

    return DailyFuturesIndicators(
        as_of_date=latest.trading_date, bar_count=len(ordered), latest_close=latest.close_price,
        return_1_bar_pct=return_1, return_5_bar_pct=return_5, return_20_bar_pct=return_20,
        sma_5=sma_5, sma_20=sma_20, above_sma_20=above_sma_20,
        realized_volatility_20_annualized_pct=rv20,
        volume_ratio_5_to_previous_20=volume_ratio,
        open_interest_change_5_bar_pct=oi_change,
        intraday_range_pct=range_pct, trend_state=trend_state,
    )
