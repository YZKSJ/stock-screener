"""Best-effort futures directory via AKShare's OpenCTP reference table."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import isfinite
import re
from threading import Lock
from typing import Any
from zoneinfo import ZoneInfo

_REQUIRED = {"交易所", "合约代码", "合约名称", "品种代码", "品种名称", "合约乘数", "最小跳动", "更新时间"}
_FUTURE_SYMBOL = re.compile(r"^[A-Z]{1,3}[0-9]{3,4}$")
_SHANGHAI = ZoneInfo("Asia/Shanghai")
_COMMODITY_EXCHANGES = frozenset({"SHFE", "DCE", "CZCE", "INE", "GFEX"})
_EXCHANGE_NAMES = {
    "SHFE": "SHFE", "上海期货交易所": "SHFE",
    "DCE": "DCE", "大连商品交易所": "DCE",
    "CZCE": "CZCE", "郑州商品交易所": "CZCE",
    "INE": "INE", "上海国际能源交易中心": "INE",
    "GFEX": "GFEX", "广州期货交易所": "GFEX",
    "CFFEX": "CFFEX", "中国金融期货交易所": "CFFEX",
}


class FuturesDirectoryProviderError(RuntimeError):
    """Directory provider failure with a safe reason code."""


@dataclass(frozen=True, slots=True)
class FuturesDirectoryItem:
    symbol: str
    exchange: str
    product: str
    product_name: str
    contract_name: str
    multiplier: float
    tick_size: float


@dataclass(frozen=True, slots=True)
class FuturesDirectorySnapshot:
    provider: str
    fetched_at: datetime
    source_updated_at: datetime | None
    items: tuple[FuturesDirectoryItem, ...]
    rows_skipped: int = 0


def _text(value: Any) -> str:
    if value is None:
        return ""
    try:
        if value != value:
            return ""
    except (TypeError, ValueError):
        pass
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "nat"} else text


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return number if isfinite(number) else None


def _timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    else:
        text = _text(value)
        if not text:
            return None
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        parsed = parsed.replace(tzinfo=_SHANGHAI)
    return parsed.astimezone(timezone.utc)


class AkShareOpenCtpFuturesDirectory:
    """Normalize and briefly cache the third-party reference list."""

    provider_name = "akshare:futures_fees_info/openctp"

    def __init__(self, *, akshare_module: Any | None = None, clock=None, ttl_seconds: int = 600) -> None:
        if ttl_seconds < 0:
            raise ValueError("ttl_seconds must not be negative")
        self._akshare = akshare_module
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._ttl_seconds = ttl_seconds
        self._lock = Lock()
        self._cached: FuturesDirectorySnapshot | None = None

    def directory(self, *, force_refresh: bool = False) -> FuturesDirectorySnapshot:
        with self._lock:
            now = self._clock()
            if now.tzinfo is None or now.utcoffset() is None:
                raise ValueError("provider clock must be timezone-aware")
            now = now.astimezone(timezone.utc)
            cached = self._cached
            if (not force_refresh and cached is not None and self._ttl_seconds > 0
                    and (now - cached.fetched_at).total_seconds() < self._ttl_seconds):
                return cached

            ak = self._akshare
            if ak is None:
                try:
                    import akshare as ak_module
                except Exception as exc:
                    raise FuturesDirectoryProviderError("akshare_import_failed") from exc
                ak = ak_module
            try:
                frame = ak.futures_fees_info()
            except Exception as exc:
                raise FuturesDirectoryProviderError("upstream_request_failed") from exc
            if frame is None:
                raise FuturesDirectoryProviderError("upstream_payload_missing")
            missing = sorted(_REQUIRED - set(getattr(frame, "columns", ())))
            if missing:
                raise FuturesDirectoryProviderError("upstream_schema_missing:" + ",".join(missing))
            try:
                records = frame.to_dict(orient="records")
            except Exception as exc:
                raise FuturesDirectoryProviderError("upstream_payload_not_tabular") from exc
            if not records:
                raise FuturesDirectoryProviderError("upstream_empty_directory")

            items: dict[tuple[str, str], FuturesDirectoryItem] = {}
            conflicted: set[tuple[str, str]] = set()
            skipped = 0
            timestamps: list[datetime] = []
            for row in records:
                symbol = _text(row.get("合约代码")).upper()
                exchange = _EXCHANGE_NAMES.get(_text(row.get("交易所")).upper())
                product = _text(row.get("品种代码")).upper()
                product_name = _text(row.get("品种名称"))
                contract_name = _text(row.get("合约名称"))
                multiplier = _number(row.get("合约乘数"))
                tick_size = _number(row.get("最小跳动"))
                source_updated = _timestamp(row.get("更新时间"))
                if source_updated is not None:
                    timestamps.append(source_updated)
                # This is a commodity-futures directory, not options or continuous series.
                if (not _FUTURE_SYMBOL.fullmatch(symbol) or exchange not in _COMMODITY_EXCHANGES
                        or not product or multiplier is None or multiplier <= 0
                        or tick_size is None or tick_size <= 0):
                    skipped += 1
                    continue
                item = FuturesDirectoryItem(symbol, exchange, product, product_name,
                                            contract_name, multiplier, tick_size)
                key = (exchange, symbol)
                if key in conflicted:
                    skipped += 1
                    continue
                existing = items.get(key)
                if existing is not None and existing != item:
                    items.pop(key, None)
                    conflicted.add(key)
                    skipped += 2
                elif existing is None:
                    items[key] = item
            if not items:
                raise FuturesDirectoryProviderError("upstream_no_valid_futures_contracts")
            snapshot = FuturesDirectorySnapshot(
                provider=self.provider_name, fetched_at=now,
                source_updated_at=max(timestamps) if timestamps else None,
                items=tuple(sorted(items.values(), key=lambda item: (item.exchange, item.symbol))),
                rows_skipped=skipped,
            )
            self._cached = snapshot
            return snapshot
