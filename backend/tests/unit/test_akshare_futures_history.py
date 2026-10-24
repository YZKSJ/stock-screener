"""Tests for the AKShare daily-history adapter without network access."""
from datetime import date, datetime, timezone
import pandas as pd
import pytest
from app.domain.derivatives.contracts import FuturesContract
from app.infra.providers.akshare_futures_history import AkShareSinaDailyHistoryProvider, FuturesHistoryProviderError

NOW = datetime(2026, 10, 24, 15, 0, tzinfo=timezone.utc)

class FakeAkShare:
    def __init__(self, frame):
        self.frame = frame
        self.requested_symbol = None
    def futures_zh_daily_sina(self, *, symbol):
        self.requested_symbol = symbol
        return self.frame

def make_contract(symbol="MA609"):
    return FuturesContract(symbol=symbol, exchange="CZCE", product="MA", multiplier=10, tick_size=1)

def make_frame():
    return pd.DataFrame([
        {"date":"2026-10-20","open":2400,"high":2450,"low":2380,"close":2430,"volume":120,"hold":4500,"settle":2425},
        {"date":"2026-10-21","open":2430,"high":2480,"low":2420,"close":2460,"volume":150,"hold":4700,"settle":0},
        {"date":"2026-10-22","open":2460,"high":2450,"low":2400,"close":2420,"volume":200,"hold":4900,"settle":2410},
    ])

def test_history_filters_date_range_sorts_and_preserves_provenance():
    sdk = FakeAkShare(make_frame())
    result = AkShareSinaDailyHistoryProvider(akshare_module=sdk, clock=lambda: NOW).daily_history(
        make_contract(), start_date=date(2026,10,20), end_date=date(2026,10,21)
    )
    assert sdk.requested_symbol == "MA609"
    assert result.provider == "akshare:futures_zh_daily_sina"
    assert result.series_kind == "single_contract"
    assert result.fetched_at == NOW
    assert [x.trading_date for x in result.bars] == [date(2026,10,20), date(2026,10,21)]
    assert result.bars[1].settlement_price is None
    assert result.rows_skipped == 0

def test_invalid_ohlc_row_is_skipped_not_repaired():
    result = AkShareSinaDailyHistoryProvider(akshare_module=FakeAkShare(make_frame()), clock=lambda: NOW).daily_history(
        make_contract(), start_date=date(2026,10,20), end_date=date(2026,10,22)
    )
    assert [x.trading_date for x in result.bars] == [date(2026,10,20), date(2026,10,21)]
    assert result.rows_skipped == 1

def test_conflicting_duplicate_day_is_excluded():
    first = make_frame().iloc[[0]]
    frame = pd.concat([first, first.assign(close=2440)])
    result = AkShareSinaDailyHistoryProvider(akshare_module=FakeAkShare(frame), clock=lambda: NOW).daily_history(
        make_contract(), start_date=date(2026,10,20), end_date=date(2026,10,20)
    )
    assert result.bars == ()
    assert result.duplicate_dates_skipped == 2

def test_continuous_symbol_is_explicitly_labelled():
    result = AkShareSinaDailyHistoryProvider(akshare_module=FakeAkShare(make_frame()), clock=lambda: NOW).daily_history(
        make_contract("MA0"), start_date=date(2026,10,20), end_date=date(2026,10,21)
    )
    assert result.series_kind == "continuous_proxy"

def test_missing_upstream_columns_fail_closed():
    fake = FakeAkShare(pd.DataFrame([{"date":"2026-10-20","close":1}]))
    with pytest.raises(FuturesHistoryProviderError, match="upstream_schema_missing"):
        AkShareSinaDailyHistoryProvider(akshare_module=fake, clock=lambda: NOW).daily_history(
            make_contract(), start_date=date(2026,10,20), end_date=date(2026,10,21)
        )

def test_empty_provider_result_is_not_fabricated():
    empty = pd.DataFrame(columns=["date","open","high","low","close","volume","hold","settle"])
    result = AkShareSinaDailyHistoryProvider(akshare_module=FakeAkShare(empty), clock=lambda: NOW).daily_history(
        make_contract(), start_date=date(2026,10,20), end_date=date(2026,10,21)
    )
    assert result.bars == ()
    assert result.first_date is None and result.last_date is None

def test_upstream_exception_is_returned_as_safe_reason_code():
    class Broken:
        def futures_zh_daily_sina(self, *, symbol):
            raise RuntimeError("upstream data not to be leaked")
    with pytest.raises(FuturesHistoryProviderError, match="upstream_request_failed"):
        AkShareSinaDailyHistoryProvider(akshare_module=Broken(), clock=lambda: NOW).daily_history(
            make_contract(), start_date=date(2026,10,20), end_date=date(2026,10,21)
        )
