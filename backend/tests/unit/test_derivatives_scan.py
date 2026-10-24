"""Tests for ranking logic used by the bounded daily scan."""
from datetime import date
from app.schemas.derivatives import FuturesDailyIndicatorsResponse, FuturesDailyScanItemResponse
from app.api.v1.derivatives import _rank_scan_items


def item(symbol, ret, *, status="ok"):
    analysis = None
    if ret is not None:
        analysis = FuturesDailyIndicatorsResponse(
            as_of_date=date(2026, 10, 24), bar_count=30, latest_close=2500,
            return_1_bar_pct=0.1, return_5_bar_pct=1.2, return_20_bar_pct=ret,
            sma_5=2490, sma_20=2470, above_sma_20=True,
            realized_volatility_20_annualized_pct=22.0,
            volume_ratio_5_to_previous_20=1.4, open_interest_change_5_bar_pct=2.0,
            intraday_range_pct=1.1, trend_state="uptrend",
        )
    return FuturesDailyScanItemResponse(
        symbol=symbol, exchange="CZCE", provider="test", status=status,
        analysis=analysis, reason_code=None if ret is not None else "insufficient_history_for_20_bar_return",
    )


def test_scan_ranks_20_bar_return_descending_and_leaves_unranked_last():
    ranked = _rank_scan_items([item("MA", 2.0), item("RB", -1.0), item("FG", None, status="insufficient_history")])
    assert [x.symbol for x in ranked] == ["MA", "RB", "FG"]
    assert [x.rank for x in ranked] == [1, 2, None]
