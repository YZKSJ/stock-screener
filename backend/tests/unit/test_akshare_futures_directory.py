from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from app.infra.providers.akshare_futures_directory import (
    AkShareOpenCtpFuturesDirectory, FuturesDirectoryProviderError,
)

NOW = datetime(2026, 10, 25, 0, 0, tzinfo=timezone.utc)


class FakeAkShare:
    def __init__(self, frame):
        self.frame = frame
        self.calls = 0

    def futures_fees_info(self):
        self.calls += 1
        return self.frame


def make_frame():
    return pd.DataFrame([
        {"交易所": "SHFE", "合约代码": "rb2701", "合约名称": "螺纹钢2701",
         "品种代码": "rb", "品种名称": "螺纹钢", "合约乘数": 10,
         "最小跳动": 1, "更新时间": "2026-10-24 20:30:00"},
        {"交易所": "CZCE", "合约代码": "MA701", "合约名称": "甲醇701",
         "品种代码": "MA", "品种名称": "甲醇", "合约乘数": 10,
         "最小跳动": 1, "更新时间": "2026-10-24 20:30:00"},
        {"交易所": "SHFE", "合约代码": "cu2701C80000", "合约名称": "铜期权",
         "品种代码": "CU", "品种名称": "铜", "合约乘数": 5,
         "最小跳动": 2, "更新时间": "2026-10-24 20:30:00"},
        {"交易所": "SHFE", "合约代码": "RB0", "合约名称": "螺纹钢连续",
         "品种代码": "RB", "品种名称": "螺纹钢", "合约乘数": 10,
         "最小跳动": 1, "更新时间": "2026-10-24 20:30:00"},
        {"交易所": "CFFEX", "合约代码": "IF2701", "合约名称": "沪深300期指",
         "品种代码": "IF", "品种名称": "沪深300", "合约乘数": 300,
         "最小跳动": 0.2, "更新时间": "2026-10-24 20:30:00"},
    ])


def test_directory_normalizes_futures_and_excludes_options_continuous_and_financial_symbols():
    source = FakeAkShare(make_frame())
    result = AkShareOpenCtpFuturesDirectory(akshare_module=source, clock=lambda: NOW).directory()
    assert [(item.exchange, item.symbol) for item in result.items] == [
        ("CZCE", "MA701"), ("SHFE", "RB2701")
    ]
    assert result.items[0].multiplier == 10
    assert result.items[0].tick_size == 1
    assert result.provider == "akshare:futures_fees_info/openctp"
    assert result.source_updated_at == datetime(2026, 10, 24, 12, 30, tzinfo=timezone.utc)
    assert result.rows_skipped == 3


def test_directory_cache_reuses_snapshot_until_ttl_expires():
    source = FakeAkShare(make_frame())
    now = [NOW]
    provider = AkShareOpenCtpFuturesDirectory(
        akshare_module=source, clock=lambda: now[0], ttl_seconds=600
    )
    first = provider.directory()
    now[0] += timedelta(seconds=300)
    assert provider.directory() is first
    assert source.calls == 1
    now[0] += timedelta(seconds=601)
    assert provider.directory() is not first
    assert source.calls == 2


def test_directory_can_force_refresh():
    source = FakeAkShare(make_frame())
    provider = AkShareOpenCtpFuturesDirectory(
        akshare_module=source, clock=lambda: NOW, ttl_seconds=600
    )
    provider.directory()
    provider.directory(force_refresh=True)
    assert source.calls == 2


def test_directory_fails_closed_when_columns_change():
    source = FakeAkShare(pd.DataFrame([{"合约代码": "RB2701"}]))
    with pytest.raises(FuturesDirectoryProviderError, match="upstream_schema_missing"):
        AkShareOpenCtpFuturesDirectory(akshare_module=source, clock=lambda: NOW).directory()


def test_directory_reports_upstream_request_failure_without_leaking_exception_text():
    class Broken:
        def futures_fees_info(self):
            raise RuntimeError("may include data from remote page")
    with pytest.raises(FuturesDirectoryProviderError, match="upstream_request_failed"):
        AkShareOpenCtpFuturesDirectory(akshare_module=Broken(), clock=lambda: NOW).directory()


def test_conflicting_duplicate_contract_specs_are_excluded():
    frame = make_frame().iloc[[0, 0]].copy()
    frame.iloc[1, frame.columns.get_loc("合约乘数")] = 99
    source = FakeAkShare(frame)
    with pytest.raises(FuturesDirectoryProviderError, match="upstream_no_valid_futures_contracts"):
        AkShareOpenCtpFuturesDirectory(akshare_module=source, clock=lambda: NOW).directory()
