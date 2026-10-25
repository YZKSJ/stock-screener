"""Build a small, read-only commodity-futures snapshot for static hosting.

The export is a third-party research snapshot, not exchange-certified data or a
live quote service. It selects a small, expiry-aware watchlist to avoid hitting
upstream history endpoints for every contract in the reference directory.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import re
from typing import Any, Iterable

from app.domain.derivatives.analytics import calculate_daily_indicators
from app.domain.derivatives.contracts import FuturesContract
from app.infra.providers.akshare_futures_directory import (
    AkShareOpenCtpFuturesDirectory,
    FuturesDirectoryItem,
)
from app.infra.providers.akshare_futures_history import (
    AkShareSinaDailyHistoryProvider,
    FuturesHistoryProviderError,
)

DEFAULT_PRODUCTS = ("RB", "MA", "I", "CU", "AG")
_SYMBOL_RE = re.compile(r"^([A-Z]{1,3})(\d{3,4})$")


def contract_expiry_month(symbol: str, reference_date: date) -> tuple[int, int] | None:
    """Best-effort parse of common domestic futures YYMM / YMM suffixes.

    This is only a watchlist selection heuristic. It is not an exchange expiry
    calendar and does not determine whether a contract is currently listed.
    """
    match = _SYMBOL_RE.fullmatch(str(symbol or "").strip().upper())
    if not match:
        return None
    digits = match.group(2)
    try:
        month = int(digits[-2:])
    except ValueError:
        return None
    if not 1 <= month <= 12:
        return None
    if len(digits) == 4:
        year = 2000 + int(digits[:2])
        if not reference_date.year - 1 <= year <= reference_date.year + 4:
            return None
        return year, month
    year_digit = int(digits[0])
    candidates = [
        year for year in range(reference_date.year - 1, reference_date.year + 4)
        if year % 10 == year_digit
        and (year, month) >= (reference_date.year, reference_date.month)
    ]
    return (min(candidates), month) if candidates else None


def select_research_contracts(
    items: Iterable[FuturesDirectoryItem],
    reference_date: date,
    products: tuple[str, ...] = DEFAULT_PRODUCTS,
) -> list[FuturesDirectoryItem]:
    """Pick the nearest non-past contract month for each requested product."""
    wanted = {product.upper() for product in products}
    by_product: dict[str, list[tuple[tuple[int, int], FuturesDirectoryItem]]] = {}
    for item in items:
        product = item.product.upper()
        if product not in wanted:
            continue
        expiry = contract_expiry_month(item.symbol, reference_date)
        if expiry is None or expiry < (reference_date.year, reference_date.month):
            continue
        by_product.setdefault(product, []).append((expiry, item))

    selected: list[FuturesDirectoryItem] = []
    for product in products:
        candidates = by_product.get(product.upper(), [])
        if not candidates:
            continue
        candidates.sort(key=lambda pair: (pair[0], pair[1].symbol))
        selected.append(candidates[0][1])
    return selected


def _json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise TypeError(f"Unsupported snapshot value: {type(value).__name__}")


def _base_snapshot(as_of: date) -> dict[str, Any]:
    return {
        "schema_version": "futures-research-static-v1",
        "status": "offline",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "as_of_date": as_of.isoformat(),
        "source": "AKShare / Sina daily history and OpenCTP reference table",
        "directory": {
            "provider": "akshare:futures_fees_info/openctp",
            "fetched_at": None,
            "source_updated_at": None,
            "items": [],
        },
        "histories": [],
        "notes": [
            "Static daily snapshot only; not real-time quotes.",
            "Contract specs and listing status must be verified against the exchange or broker.",
            "Expiry selection is a simple code heuristic, not an exchange contract calendar.",
            "No order routing or trading-account connection is included.",
        ],
    }


def build_snapshot(
    *,
    as_of: date,
    directory_provider: Any | None = None,
    history_provider: Any | None = None,
) -> dict[str, Any]:
    """Fetch a small best-effort snapshot. Per-contract failures do not discard others."""
    result = _base_snapshot(as_of)
    directory_provider = directory_provider or AkShareOpenCtpFuturesDirectory()
    history_provider = history_provider or AkShareSinaDailyHistoryProvider()
    try:
        directory = directory_provider.directory()
    except Exception as exc:
        result["notes"].append(f"Contract directory unavailable ({type(exc).__name__}); retry on the next scheduled build.")
        return result

    result["status"] = "directory_ready"
    result["directory"] = {
        "provider": directory.provider,
        "fetched_at": directory.fetched_at,
        "source_updated_at": directory.source_updated_at,
        "rows_skipped": directory.rows_skipped,
        "items": [asdict(item) for item in directory.items],
    }
    selected = select_research_contracts(directory.items, as_of)
    if not selected:
        result["notes"].append("No current-month-or-later contracts were selected by the expiry heuristic.")
        return result

    start_date = as_of - timedelta(days=320)
    for item in selected:
        history_record: dict[str, Any] = {
            "symbol": item.symbol,
            "exchange": item.exchange,
            "product": item.product,
            "product_name": item.product_name,
            "contract_name": item.contract_name,
            "multiplier": item.multiplier,
            "tick_size": item.tick_size,
            "status": "provider_error",
            "provider": getattr(history_provider, "provider_name", "unknown"),
            "bars": [],
            "analysis": None,
            "quality_warnings": [],
        }
        try:
            contract = FuturesContract(
                symbol=item.symbol,
                exchange=item.exchange,
                product=item.product,
                multiplier=item.multiplier,
                tick_size=item.tick_size,
                currency="CNY",
            )
            history = history_provider.daily_history(
                contract, start_date=start_date, end_date=as_of
            )
            metrics = calculate_daily_indicators(history.bars)
            history_record.update({
                "status": "ok" if history.bars else "empty",
                "provider": history.provider,
                "fetched_at": history.fetched_at,
                "series_kind": history.series_kind,
                "first_date": history.first_date,
                "last_date": history.last_date,
                "end_date_lag_days": (
                    max(0, (as_of - history.last_date).days)
                    if history.last_date is not None else None
                ),
                "row_count": len(history.bars),
                "rows_skipped": history.rows_skipped,
                "duplicate_dates_skipped": history.duplicate_dates_skipped,
                "bars": [asdict(bar) for bar in history.bars],
                "analysis": asdict(metrics) if metrics is not None else None,
            })
            if not history.bars:
                history_record["quality_warnings"].append(
                    "No daily bars returned; this directory entry may be stale or unsupported by the history source."
                )
            if history.last_date is not None:
                lag = (as_of - history.last_date).days
                if lag > 7:
                    history_record["quality_warnings"].append(
                        f"Latest bar is {lag} calendar day(s) before snapshot date; this is not exchange-calendar-adjusted."
                    )
            if history.rows_skipped:
                history_record["quality_warnings"].append(
                    f"{history.rows_skipped} malformed OHLC row(s) were skipped."
                )
            if history.duplicate_dates_skipped:
                history_record["quality_warnings"].append(
                    f"{history.duplicate_dates_skipped} duplicate/conflicting row(s) were skipped."
                )
        except Exception as exc:
            history_record["error"] = (
                str(exc) if isinstance(exc, FuturesHistoryProviderError)
                else f"{type(exc).__name__}"
            )
        result["histories"].append(history_record)

    fresh_history_available = any(
        row["status"] == "ok"
        and row.get("last_date") is not None
        and row.get("end_date_lag_days") is not None
        and row["end_date_lag_days"] <= 7
        for row in result["histories"]
    )
    result["status"] = "ready" if fresh_history_available else "directory_ready"
    if not fresh_history_available:
        result["notes"].append(
            "No selected contract returned a recent-enough daily bar (within 7 calendar days of the snapshot date). "
            "The publisher should keep its last-good snapshot."
        )
    result["notes"].append(
        f"Daily history was requested only for a small watchlist of {len(selected)} contracts."
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    args = parser.parse_args()
    snapshot = build_snapshot(as_of=args.as_of)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2, default=_json_default) + "\n",
        encoding="utf-8",
    )
    print(
        f"futures snapshot status={snapshot['status']} "
        f"contracts={len(snapshot['directory']['items'])} histories={len(snapshot['histories'])} "
        f"output={args.output}"
    )
    # This step is best-effort and must not prevent publication of the rest of the static site.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
