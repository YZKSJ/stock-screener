"""Read-only API endpoints for domestic futures and derivatives research."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.domain.derivatives.analytics import calculate_daily_indicators
from app.domain.derivatives.contracts import FuturesContract, FuturesMarketObservation
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
    SnapshotValidationRequest,
    SnapshotValidationResponse,
)

router = APIRouter()


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

    metrics = calculate_daily_indicators(result.bars)
    analysis = None
    if metrics is not None:
        analysis = FuturesDailyIndicatorsResponse(
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
    if analysis is None:
        notes.append("No usable bars were returned, so no indicators were calculated.")

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
        analysis=analysis, notes=notes,
    )
