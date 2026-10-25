"""Unit tests for provider-neutral commodity futures data contracts."""
from datetime import datetime, timedelta, timezone

import pytest

from app.domain.derivatives.contracts import FuturesContract, FuturesMarketObservation
from app.domain.derivatives.quality import QualityStatus, validate_market_observation

NOW = datetime(2026, 10, 24, 15, 0, tzinfo=timezone.utc)


def make_contract(**overrides):
    fields = {"symbol": "MA701", "exchange": "CZCE", "product": "MA",
              "multiplier": 10, "tick_size": 1}
    fields.update(overrides)
    return FuturesContract(**fields)


def make_observation(**overrides):
    fields = {
        "symbol": "MA701", "exchange": "CZCE",
        "as_of": NOW - timedelta(seconds=30),
        "fetched_at": NOW - timedelta(seconds=20), "last_price": 2500,
        "volume": 12000, "open_interest": 35000, "open_price": 2480,
        "high_price": 2520, "low_price": 2470, "prev_close": 2490,
        "bid_price_1": 2499, "ask_price_1": 2500, "source": "test-fixture",
    }
    fields.update(overrides)
    return FuturesMarketObservation(**fields)


def test_contract_normalizes_identity_and_preserves_multiplier():
    contract = make_contract(symbol=" ma701 ", exchange="czce", product="ma")
    assert contract.instrument_id == "MA701.CZCE"
    assert contract.multiplier == 10


@pytest.mark.parametrize(("field", "value"), [
    ("multiplier", 0), ("multiplier", float("inf")), ("tick_size", -1),
])
def test_contract_rejects_invalid_price_metadata(field, value):
    with pytest.raises(ValueError):
        make_contract(**{field: value})


def test_contract_rejects_unknown_exchange():
    with pytest.raises(ValueError, match="unsupported exchange"):
        make_contract(exchange="UNKNOWN")


def test_complete_recent_observation_is_valid():
    report = validate_market_observation(make_contract(), make_observation(), now=NOW)
    assert report.status is QualityStatus.VALID
    assert report.instrument_id == "MA701.CZCE"
    assert report.errors == ()
    assert report.warnings == ()


def test_stale_observation_warns_without_inventing_a_value():
    report = validate_market_observation(
        make_contract(), make_observation(as_of=NOW - timedelta(minutes=10)),
        now=NOW, max_age_seconds=180,
    )
    assert report.status is QualityStatus.WARNING
    assert "stale_observation" in report.warnings
    assert report.age_seconds == 600


def test_instrument_mismatch_invalidates_observation():
    report = validate_market_observation(
        make_contract(), make_observation(symbol="MA801"), now=NOW
    )
    assert report.status is QualityStatus.INVALID
    assert "instrument_identity_mismatch" in report.errors


def test_crossed_order_book_is_invalid():
    report = validate_market_observation(
        make_contract(), make_observation(bid_price_1=2501, ask_price_1=2500), now=NOW
    )
    assert report.status is QualityStatus.INVALID
    assert "crossed_order_book" in report.errors


def test_future_dated_market_observation_is_invalid():
    report = validate_market_observation(
        make_contract(), make_observation(as_of=NOW + timedelta(minutes=5)), now=NOW
    )
    assert report.status is QualityStatus.INVALID
    assert "observation_from_future" in report.errors


def test_missing_open_interest_is_warning_not_zero():
    report = validate_market_observation(
        make_contract(), make_observation(open_interest=None), now=NOW
    )
    assert report.status is QualityStatus.WARNING
    assert "missing_open_interest" in report.warnings
