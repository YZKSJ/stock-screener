"""Deterministic quality checks for normalized futures observations."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
from math import isfinite

from .contracts import FuturesContract, FuturesMarketObservation


class QualityStatus(StrEnum):
    VALID = "valid"
    WARNING = "warning"
    INVALID = "invalid"


@dataclass(frozen=True, slots=True)
class QualityReport:
    status: QualityStatus
    instrument_id: str
    source: str
    as_of: datetime
    age_seconds: float | None
    errors: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()


def _finite(value: float | None) -> bool:
    return value is not None and isfinite(float(value))


def _positive(value: float | None) -> bool:
    return _finite(value) and float(value) > 0


def _aware(value: datetime) -> bool:
    return value.tzinfo is not None and value.utcoffset() is not None


def validate_market_observation(
    contract: FuturesContract,
    observation: FuturesMarketObservation,
    *,
    now: datetime | None = None,
    max_age_seconds: int = 180,
    future_tolerance_seconds: int = 60,
) -> QualityReport:
    """Check identity, prices, quote coherence, and freshness without fetching data."""
    if not 1 <= max_age_seconds <= 86_400:
        raise ValueError("max_age_seconds must be between 1 and 86400")
    if future_tolerance_seconds < 0:
        raise ValueError("future_tolerance_seconds cannot be negative")

    clock = now or datetime.now(timezone.utc)
    if not _aware(clock):
        raise ValueError("now must be timezone-aware")
    errors: list[str] = []
    warnings: list[str] = []
    age_seconds: float | None = None

    if observation.symbol != contract.symbol or observation.exchange != contract.exchange:
        errors.append("instrument_identity_mismatch")

    if not _aware(observation.as_of) or not _aware(observation.fetched_at):
        errors.append("timezone_missing")
    else:
        age_seconds = (clock - observation.as_of).total_seconds()
        if age_seconds < -future_tolerance_seconds:
            errors.append("observation_from_future")
        elif age_seconds > max_age_seconds:
            warnings.append("stale_observation")
        fetch_skew = (observation.fetched_at - observation.as_of).total_seconds()
        if fetch_skew < -future_tolerance_seconds:
            warnings.append("fetch_time_precedes_market_time")
        if (observation.fetched_at - clock).total_seconds() > future_tolerance_seconds:
            warnings.append("provider_clock_ahead")

    if not _positive(observation.last_price):
        errors.append("invalid_last_price")

    optional_prices = {
        "open_price": observation.open_price,
        "high_price": observation.high_price,
        "low_price": observation.low_price,
        "prev_close": observation.prev_close,
    }
    for name, value in optional_prices.items():
        if value is not None and not _positive(value):
            errors.append(f"invalid_{name}")

    if (_positive(observation.high_price) and _positive(observation.low_price)
            and observation.high_price < observation.low_price):
        errors.append("high_below_low")
    if _positive(observation.high_price):
        for name, value in (("open_price", observation.open_price),
                            ("last_price", observation.last_price)):
            if _positive(value) and observation.high_price < value:
                errors.append(f"high_below_{name}")
    if _positive(observation.low_price):
        for name, value in (("open_price", observation.open_price),
                            ("last_price", observation.last_price)):
            if _positive(value) and observation.low_price > value:
                errors.append(f"low_above_{name}")

    for name, value in (("volume", observation.volume),
                        ("open_interest", observation.open_interest)):
        if value is None:
            warnings.append(f"missing_{name}")
        elif not _finite(value) or value < 0:
            errors.append(f"invalid_{name}")

    bid, ask = observation.bid_price_1, observation.ask_price_1
    for name, value in (("bid_price_1", bid), ("ask_price_1", ask)):
        if value is not None and (not _finite(value) or value < 0):
            errors.append(f"invalid_{name}")
    if _positive(bid) and _positive(ask):
        if ask < bid:
            errors.append("crossed_order_book")
    else:
        warnings.append("top_of_book_incomplete")

    if observation.source == "unspecified":
        warnings.append("source_unspecified")

    status = QualityStatus.INVALID if errors else (
        QualityStatus.WARNING if warnings else QualityStatus.VALID
    )
    return QualityReport(
        status=status,
        instrument_id=contract.instrument_id,
        source=observation.source,
        as_of=observation.as_of,
        age_seconds=round(age_seconds, 3) if age_seconds is not None else None,
        errors=tuple(dict.fromkeys(errors)),
        warnings=tuple(dict.fromkeys(warnings)),
    )
