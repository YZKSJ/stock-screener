"""Tests for deterministic daily futures indicators."""
from datetime import date, timedelta
import pytest
from app.domain.derivatives.analytics import calculate_daily_indicators
from app.domain.derivatives.history import FuturesDailyBar

def bars_from_closes(closes, *, volumes=None, oi=None):
    origin = date(2026, 9, 1)
    rows = []
    for index, close in enumerate(closes):
        rows.append(FuturesDailyBar(
            trading_date=origin + timedelta(days=index),
            open_price=close, high_price=close + 1, low_price=close - 1,
            close_price=close, volume=volumes[index] if volumes is not None else 100,
            open_interest=oi[index] if oi is not None else 1000 + index,
            settlement_price=close,
        ))
    return rows

def test_indicators_use_sorted_bars_and_expected_formulas():
    closes = [100.0 + index for index in range(30)]
    volumes = [100] * 25 + [200] * 5
    result = calculate_daily_indicators(list(reversed(bars_from_closes(closes, volumes=volumes))))
    assert result is not None
    assert result.bar_count == 30
    assert result.latest_close == 129.0
    assert result.return_5_bar_pct == pytest.approx((129 / 124 - 1) * 100)
    assert result.return_20_bar_pct == pytest.approx((129 / 109 - 1) * 100)
    assert result.volume_ratio_5_to_previous_20 == pytest.approx(2.0)
    assert result.sma_5 == pytest.approx(sum(closes[-5:]) / 5)
    assert result.sma_20 == pytest.approx(sum(closes[-20:]) / 20)
    assert result.realized_volatility_20_annualized_pct is not None
    assert result.trend_state == "uptrend"

def test_insufficient_history_leaves_long_window_indicators_unavailable():
    result = calculate_daily_indicators(bars_from_closes([100.0, 101.0, 99.0]))
    assert result is not None
    assert result.return_1_bar_pct == pytest.approx((99 / 101 - 1) * 100)
    assert result.return_5_bar_pct is None
    assert result.sma_20 is None
    assert result.realized_volatility_20_annualized_pct is None
    assert result.trend_state == "insufficient_history"

def test_empty_history_returns_none():
    assert calculate_daily_indicators([]) is None

def test_annualization_periods_must_be_positive():
    with pytest.raises(ValueError, match="annualization_periods"):
        calculate_daily_indicators(bars_from_closes([100]), annualization_periods=0)

def test_missing_open_interest_stays_unavailable():
    rows = bars_from_closes([100 + i for i in range(7)])
    last = rows[-1]
    rows[-1] = FuturesDailyBar(last.trading_date, last.open_price, last.high_price,
                              last.low_price, last.close_price, last.volume, None, last.settlement_price)
    result = calculate_daily_indicators(rows)
    assert result is not None
    assert result.open_interest_change_5_bar_pct is None
