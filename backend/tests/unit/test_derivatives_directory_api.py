from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.api.v1 import derivatives
from app.infra.providers.akshare_futures_directory import (
    FuturesDirectoryItem, FuturesDirectorySnapshot,
)


class FakeDirectoryProvider:
    provider_name = "test-directory"

    def directory(self):
        return FuturesDirectorySnapshot(
            provider=self.provider_name,
            fetched_at=datetime(2026, 10, 25, tzinfo=timezone.utc),
            source_updated_at=datetime(2026, 10, 24, 12, 30, tzinfo=timezone.utc),
            items=(
                FuturesDirectoryItem("MA701", "CZCE", "MA", "甲醇", "甲醇701", 10, 1),
                FuturesDirectoryItem("RB2701", "SHFE", "RB", "螺纹钢", "螺纹钢2701", 10, 1),
            ),
            rows_skipped=2,
        )


def test_directory_search_filters_by_product_and_reports_provenance(monkeypatch):
    monkeypatch.setattr(derivatives, "_directory_provider", FakeDirectoryProvider())
    result = derivatives.futures_contract_directory(q="甲醇", exchange=None, limit=10)
    assert result.provider == "test-directory"
    assert result.total_count == 1
    assert result.result_count == 1
    assert result.items[0].symbol == "MA701"
    assert result.items[0].multiplier == 10
    assert result.rows_skipped == 2
    assert any("expired or stale" in note for note in result.notes)


def test_directory_search_filters_exchange_and_limit(monkeypatch):
    monkeypatch.setattr(derivatives, "_directory_provider", FakeDirectoryProvider())
    result = derivatives.futures_contract_directory(q=None, exchange="SHFE", limit=1)
    assert result.total_count == 1
    assert [item.symbol for item in result.items] == ["RB2701"]


def test_directory_rejects_financial_exchange_filter(monkeypatch):
    monkeypatch.setattr(derivatives, "_directory_provider", FakeDirectoryProvider())
    with pytest.raises(HTTPException) as exc:
        derivatives.futures_contract_directory(q=None, exchange="CFFEX", limit=50)
    assert exc.value.status_code == 422
