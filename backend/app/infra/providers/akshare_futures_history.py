"""Best-effort AKShare/Sina daily history adapter; not a live trading feed."""
from __future__ import annotations
from datetime import date, datetime, timezone
from math import isfinite
from typing import Any

from app.domain.derivatives.contracts import FuturesContract
from app.domain.derivatives.history import FuturesDailyBar, FuturesDailyHistory, SeriesKind, valid_ohlc
from app.domain.derivatives.ports import FuturesHistoryProvider

_REQUIRED = {"date", "open", "high", "low", "close", "volume", "hold", "settle"}

class FuturesHistoryProviderError(RuntimeError):
    """Upstream request or schema failure, with a non-sensitive reason code."""

def _parse_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except (TypeError, ValueError):
        return None

def _number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return result if isfinite(result) else None

def _count(value: Any) -> int | None:
    result = _number(value)
    return int(result) if result is not None and result >= 0 and result.is_integer() else None

class AkShareSinaDailyHistoryProvider:
    provider_name = "akshare:futures_zh_daily_sina"

    def __init__(self, *, akshare_module: Any | None = None, clock=None) -> None:
        self._akshare = akshare_module
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def daily_history(self, contract: FuturesContract, *, start_date: date, end_date: date) -> FuturesDailyHistory:
        if start_date > end_date:
            raise ValueError("start_date must be on or before end_date")
        ak = self._akshare
        if ak is None:
            try:
                import akshare as ak_module
            except Exception as exc:
                raise FuturesHistoryProviderError("akshare_import_failed") from exc
            ak = ak_module
        try:
            frame = ak.futures_zh_daily_sina(symbol=contract.symbol)
        except Exception as exc:
            raise FuturesHistoryProviderError("upstream_request_failed") from exc
        if frame is None:
            raise FuturesHistoryProviderError("upstream_payload_missing")
        columns = set(getattr(frame, "columns", ()))
        if not columns and len(frame) == 0:
            records = []
        else:
            missing = sorted(_REQUIRED - columns)
            if missing:
                raise FuturesHistoryProviderError("upstream_schema_missing:" + ",".join(missing))
            try:
                records = frame.to_dict(orient="records")
            except Exception as exc:
                raise FuturesHistoryProviderError("upstream_payload_not_tabular") from exc

        by_date: dict[date, FuturesDailyBar] = {}
        conflicted: set[date] = set()
        skipped = duplicates = 0
        for record in records:
            day = _parse_date(record.get("date"))
            if day is None:
                skipped += 1
                continue
            if not start_date <= day <= end_date:
                continue
            values = tuple(_number(record.get(k)) for k in ("open", "high", "low", "close"))
            if any(v is None for v in values) or not valid_ohlc(*values):
                skipped += 1
                continue
            o, h, low, c = values
            settle = _number(record.get("settle"))
            if settle is not None and settle <= 0:
                settle = None
            bar = FuturesDailyBar(day, float(o), float(h), float(low), float(c),
                                 _count(record.get("volume")), _count(record.get("hold")), settle)
            if day in conflicted:
                duplicates += 1
            elif day not in by_date:
                by_date[day] = bar
            elif by_date[day] == bar:
                duplicates += 1
            else:
                by_date.pop(day, None)
                conflicted.add(day)
                duplicates += 2

        kind: SeriesKind = "continuous_proxy" if contract.symbol.endswith("0") else "single_contract"
        fetched = self._clock()
        if fetched.tzinfo is None or fetched.utcoffset() is None:
            raise ValueError("provider clock must be timezone-aware")
        return FuturesDailyHistory(
            contract.symbol, contract.exchange, self.provider_name,
            fetched.astimezone(timezone.utc), kind,
            tuple(by_date[d] for d in sorted(by_date)), skipped, duplicates
        )
