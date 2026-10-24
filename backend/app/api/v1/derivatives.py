"""Read-only API endpoints for domestic futures and derivatives research."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.domain.derivatives.analytics import calculate_daily_indicators
from app.domain.derivatives.contracts import FuturesContract, FuturesMarketObservation
from app.domain.derivatives.history import FuturesDailyBar
from app.domain.derivatives.quality import validate_market_observation
from app.infra.providers.akshare_futures_history import (
    AkShareSinaDailyHistoryProvider,
    FuturesHistoryProviderError,
)
from app.schemas.derivatives import (
    FuturesDailyBarResponse,
    FuturesDailyHistoryRequest,
    FuturesDailyHistoryResponse,
    FuturesDailyIndicatorsResponse,
    FuturesDailyScanItemResponse,
    FuturesDailyScanRequest,
    FuturesDailyScanResponse,
    SnapshotValidationRequest,
    SnapshotValidationResponse,
)

router = APIRouter()


def _indicator_response(bars: tuple[FuturesDailyBar, ...]) -> FuturesDailyIndicatorsResponse | None:
    metrics = calculate_daily_indicators(bars)
    if metrics is None:
        return None
    return FuturesDailyIndicatorsResponse(
        as_of_date=metrics.as_of_date, bar_count=metrics.bar_count,
        latest_close=metrics.latest_close,
        return_1_bar_pct=metrics.return_1_bar_pct,
        return_5_bar_pct=metrics.return_5_bar_pct,
        return_20_bar_pct=metrics.return_20_bar_pct,
        sma_5=metrics.sma_5, sma_20=metrics.sma_20,
        above_sma_20=metrics.above_sma_20,
        realized_volatility_20_annualized_pct=metrics.realized_volatility_20_annualized_pct,
        volume_ratio_5_to_previous_20=metrics.volume_ratio_5_to_previous_20,
        open_interest_change_5_bar_pct=metrics.open_interest_change_5_bar_pct,
        intraday_range_pct=metrics.intraday_range_pct,
        trend_state=metrics.trend_state,
    )


def _history_quality_warnings(
    *, series_kind: str, row_count: int, rows_skipped: int, duplicate_dates_skipped: int,
) -> list[str]:
    """Return human-readable, non-blocking warnings for a history series."""
    warnings: list[str] = []
    if series_kind == "continuous_proxy":
        warnings.append("Continuous/rolled series may contain roll discontinuities; do not treat as a deliverable contract.")
    if rows_skipped:
        warnings.append(f"{rows_skipped} malformed OHLC row(s) were excluded.")
    if duplicate_dates_skipped:
        warnings.append(f"{duplicate_dates_skipped} duplicate/conflicting row(s) were excluded.")
    if row_count == 0:
        warnings.append("No daily bars were returned for this symbol and date range; verify symbol and source coverage.")
    elif row_count < 21:
        warnings.append(f"Only {row_count} daily bar(s) returned; at least 21 are needed for a 20-bar return.")
    return warnings


def _rank_scan_items(
    items: list[FuturesDailyScanItemResponse],
) -> list[FuturesDailyScanItemResponse]:
    rankable = []
    unranked = []
    for item in items:
        if item.analysis is not None and item.analysis.return_20_bar_pct is not None:
            rankable.append(item)
        else:
            unranked.append(item)
    rankable.sort(key=lambda item: item.analysis.return_20_bar_pct, reverse=True)
    ranked = [
        item.model_copy(update={"rank": index})
        for index, item in enumerate(rankable, start=1)
    ]
    return ranked + unranked


@router.post(
    "/validate-snapshot",
    response_model=SnapshotValidationResponse,
    summary="Validate a supplied futures quote snapshot",
)
def validate_snapshot(request: SnapshotValidationRequest) -> SnapshotValidationResponse:
    """Validate a supplied normalized snapshot; never fetches live data."""
    contract = FuturesContract(**request.contract.model_dump())
    observation = FuturesMarketObservation(**request.observation.model_dump())
    report = validate_market_observation(
        contract, observation, max_age_seconds=request.max_age_seconds
    )
    return SnapshotValidationResponse(
        status=report.status.value, instrument_id=report.instrument_id,
        source=report.source, as_of=report.as_of, age_seconds=report.age_seconds,
        errors=list(report.errors), warnings=list(report.warnings),
    )


@router.post(
    "/history/daily",
    response_model=FuturesDailyHistoryResponse,
    summary="Fetch best-effort daily futures history and basic indicators",
)
def daily_history(request: FuturesDailyHistoryRequest) -> FuturesDailyHistoryResponse:
    """Fetch historical bars via AKShare/Sina and return provenance and indicators."""
    contract = FuturesContract(**request.contract.model_dump())
    provider = AkShareSinaDailyHistoryProvider()
    try:
        result = provider.daily_history(
            contract, start_date=request.start_date, end_date=request.end_date
        )
    except FuturesHistoryProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "futures_history_provider_error",
                "reason": str(exc),
                "provider": provider.provider_name,
            },
        ) from exc

    notes = [
        "AKShare/Sina is a best-effort third-party source; verify coverage and freshness before use.",
        "Results are filtered to requested dates; missing trading sessions are not inferred.",
        "Invalid OHLC rows and conflicting duplicate dates are omitted and counted.",
    ]
    if result.series_kind == "continuous_proxy":
        notes.append(
            "Continuous/rolled series, not one deliverable contract; validate roll adjustments before returns/backtests."
        )
    if result.rows_skipped:
        notes.append("Malformed source rows were skipped; inspect quality counters.")
    if result.duplicate_dates_skipped:
        notes.append("Duplicate/conflicting dates were excluded rather than arbitrarily selected.")

    return FuturesDailyHistoryResponse(
        symbol=result.symbol, exchange=result.exchange, provider=result.provider,
        fetched_at=result.fetched_at, series_kind=result.series_kind,
        requested_start_date=request.start_date, requested_end_date=request.end_date,
        first_date=result.first_date, last_date=result.last_date,
        row_count=len(result.bars), rows_skipped=result.rows_skipped,
        duplicate_dates_skipped=result.duplicate_dates_skipped,
        bars=[
            FuturesDailyBarResponse(
                trading_date=bar.trading_date, open_price=bar.open_price,
                high_price=bar.high_price, low_price=bar.low_price,
                close_price=bar.close_price, volume=bar.volume,
                open_interest=bar.open_interest, settlement_price=bar.settlement_price,
            ) for bar in result.bars
        ],
        analysis=_indicator_response(result.bars),
        notes=notes,
    )


@router.post(
    "/scan/daily",
    response_model=FuturesDailyScanResponse,
    summary="Scan a bounded list of user-selected futures contracts",
)
def scan_daily(request: FuturesDailyScanRequest) -> FuturesDailyScanResponse:
    """Fetch each submitted symbol serially to avoid uncontrolled provider fan-out."""
    provider = AkShareSinaDailyHistoryProvider()
    items: list[FuturesDailyScanItemResponse] = []
    for contract_input in request.contracts:
        contract = FuturesContract(**contract_input.model_dump())
        try:
            result = provider.daily_history(
                contract, start_date=request.start_date, end_date=request.end_date
            )
        except FuturesHistoryProviderError as exc:
            items.append(FuturesDailyScanItemResponse(
                symbol=contract.symbol, exchange=contract.exchange,
                provider=provider.provider_name, status="provider_error",
                reason_code=str(exc),
            ))
            continue

        analysis = _indicator_response(result.bars)
        status = "ok" if analysis is not None and analysis.return_20_bar_pct is not None else "insufficient_history"
        items.append(FuturesDailyScanItemResponse(
            symbol=result.symbol, exchange=result.exchange, provider=result.provider,
            status=status, series_kind=result.series_kind,
            first_date=result.first_date, last_date=result.last_date,
            row_count=len(result.bars), rows_skipped=result.rows_skipped,
            duplicate_dates_skipped=result.duplicate_dates_skipped,
            quality_warnings=_history_quality_warnings(
                series_kind=result.series_kind, row_count=len(result.bars),
                rows_skipped=result.rows_skipped,
                duplicate_dates_skipped=result.duplicate_dates_skipped,
            ),
            analysis=analysis,
            reason_code=(
                "insufficient_history_for_20_bar_return"
                if status == "insufficient_history" else None
            ),
        ))

    ranked = _rank_scan_items(items)
    return FuturesDailyScanResponse(
        requested_start_date=request.start_date,
        requested_end_date=request.end_date,
        requested_count=len(request.contracts),
        scanned_count=sum(item.status != "provider_error" for item in ranked),
        failed_count=sum(item.status == "provider_error" for item in ranked),
        items=ranked,
    )
