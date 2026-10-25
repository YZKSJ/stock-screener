from datetime import date, datetime, timezone
from types import SimpleNamespace

from app.scripts.export_futures_research_snapshot import (
    build_snapshot,
    contract_expiry_month,
    select_research_contracts,
)
from app.infra.providers.akshare_futures_directory import FuturesDirectoryItem
from app.infra.providers.akshare_futures_history import FuturesHistoryProviderError


def item(symbol: str, product: str, exchange: str = "SHFE") -> FuturesDirectoryItem:
    return FuturesDirectoryItem(
        symbol=symbol,
        exchange=exchange,
        product=product,
        product_name=product,
        contract_name=f"{product} {symbol}",
        multiplier=10,
        tick_size=1,
    )


def test_contract_expiry_parses_four_and_three_digit_suffixes():
    reference = date(2026, 10, 25)

    assert contract_expiry_month("RB2611", reference) == (2026, 11)
    assert contract_expiry_month("MA701", reference) == (2027, 1)
    assert contract_expiry_month("RB2601", reference) == (2026, 1)
    assert contract_expiry_month("MA601", reference) is None  # old one-digit year must not roll forward ten years
    assert contract_expiry_month("BAD000", reference) is None


def test_select_research_contracts_picks_nearest_future_contract_per_product():
    items = [
        item("RB2701", "RB"),
        item("RB2611", "RB"),
        item("RB2609", "RB"),
        item("MA701", "MA", "CZCE"),
        item("MA612", "MA", "CZCE"),
        item("CU2612", "CU", "SHFE"),
    ]

    selected = select_research_contracts(items, date(2026, 10, 25))

    assert [(entry.product, entry.symbol) for entry in selected] == [
        ("RB", "RB2611"),
        ("MA", "MA612"),
        ("CU", "CU2612"),
    ]


def test_build_snapshot_preserves_directory_when_history_provider_fails():
    directory = SimpleNamespace(
        provider="fake-directory",
        fetched_at=datetime(2026, 10, 25, tzinfo=timezone.utc),
        source_updated_at=None,
        rows_skipped=0,
        items=(item("RB2611", "RB"),),
    )

    class DirectoryProvider:
        def directory(self):
            return directory

    class HistoryProvider:
        provider_name = "fake-history"

        def daily_history(self, *args, **kwargs):
            raise FuturesHistoryProviderError("upstream_request_failed")

    snapshot = build_snapshot(
        as_of=date(2026, 10, 25),
        directory_provider=DirectoryProvider(),
        history_provider=HistoryProvider(),
    )

    assert snapshot["status"] == "directory_ready"
    assert snapshot["directory"]["items"][0]["symbol"] == "RB2611"
    assert snapshot["histories"][0]["status"] == "provider_error"
    assert snapshot["histories"][0]["error"] == "upstream_request_failed"

def test_stale_history_does_not_mark_snapshot_publishable():
    from app.domain.derivatives.history import FuturesDailyBar, FuturesDailyHistory

    as_of = date(2026, 10, 25)
    contract_item = item("RB2611", "RB")
    directory = SimpleNamespace(
        provider="fake-directory",
        fetched_at=datetime(2026, 10, 25, tzinfo=timezone.utc),
        source_updated_at=None,
        rows_skipped=0,
        items=(contract_item,),
    )

    class DirectoryProvider:
        def directory(self):
            return directory

    class HistoryProvider:
        provider_name = "fake-history"

        def daily_history(self, contract, *, start_date, end_date):
            bars = tuple(
                FuturesDailyBar(
                    trading_date=date(2026, 9, day),
                    open_price=100 + day,
                    high_price=102 + day,
                    low_price=99 + day,
                    close_price=101 + day,
                    volume=1000 + day,
                    open_interest=2000 + day,
                    settlement_price=101 + day,
                )
                for day in range(1, 6)
            )
            return FuturesDailyHistory(
                symbol=contract.symbol,
                exchange=contract.exchange,
                provider="fake-history",
                fetched_at=datetime(2026, 10, 25, tzinfo=timezone.utc),
                series_kind="single_contract",
                bars=bars,
            )

    snapshot = build_snapshot(
        as_of=as_of,
        directory_provider=DirectoryProvider(),
        history_provider=HistoryProvider(),
    )

    assert snapshot["histories"][0]["status"] == "ok"
    assert snapshot["histories"][0]["end_date_lag_days"] > 7
    assert snapshot["status"] == "directory_ready"
    assert any("last-good snapshot" in note for note in snapshot["notes"])
