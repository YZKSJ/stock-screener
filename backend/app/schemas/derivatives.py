"""Strict API contracts for the read-only derivatives research slice."""
from __future__ import annotations
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.domain.derivatives.contracts import SUPPORTED_EXCHANGES

class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

class FuturesContractInput(_StrictModel):
    symbol: str = Field(min_length=1, max_length=32)
    exchange: str
    product: str = Field(min_length=1, max_length=16)
    multiplier: float = Field(gt=0, allow_inf_nan=False)
    tick_size: float = Field(gt=0, allow_inf_nan=False)
    currency: str = Field(default="CNY", min_length=3, max_length=3)
    @field_validator("symbol", "exchange", "product", "currency")
    @classmethod
    def normalize_identifiers(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("identifier cannot be blank")
        return normalized
    @field_validator("exchange")
    @classmethod
    def supported_exchange(cls, value: str) -> str:
        if value not in SUPPORTED_EXCHANGES:
            raise ValueError(f"exchange must be one of {sorted(SUPPORTED_EXCHANGES)}")
        return value

class FuturesObservationInput(_StrictModel):
    symbol: str = Field(min_length=1, max_length=32)
    exchange: str
    as_of: datetime
    fetched_at: datetime
    last_price: float | None = Field(default=None, allow_inf_nan=False)
    volume: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    open_interest: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    open_price: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    high_price: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    low_price: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    prev_close: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    bid_price_1: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    ask_price_1: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    source: str = "unspecified"
    @field_validator("symbol", "exchange")
    @classmethod
    def normalize_identifiers(cls, value: str) -> str:
        return value.strip().upper()
    @field_validator("as_of", "fetched_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include a timezone")
        return value

class SnapshotValidationRequest(_StrictModel):
    contract: FuturesContractInput
    observation: FuturesObservationInput
    max_age_seconds: int = Field(default=180, ge=1, le=86400)

class SnapshotValidationResponse(_StrictModel):
    status: Literal["valid", "warning", "invalid"]
    instrument_id: str
    source: str
    as_of: datetime
    age_seconds: float | None = None
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=lambda: [
        "Validation only: no market data was fetched or persisted.",
        "Quality status does not establish that the provider is authoritative.",
    ])

class FuturesDailyHistoryRequest(_StrictModel):
    contract: FuturesContractInput
    start_date: date
    end_date: date
    @model_validator(mode="after")
    def validate_date_range(self):
        if self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date")
        return self

class FuturesDailyScanRequest(_StrictModel):
    contracts: list[FuturesContractInput] = Field(min_length=1, max_length=8)
    start_date: date
    end_date: date
    @model_validator(mode="after")
    def validate_request(self):
        if self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date")
        identities = [f"{item.symbol}.{item.exchange}" for item in self.contracts]
        if len(identities) != len(set(identities)):
            raise ValueError("contracts must not contain duplicate symbol/exchange pairs")
        return self

class FuturesDailyBarResponse(_StrictModel):
    trading_date: date
    open_price: float = Field(gt=0)
    high_price: float = Field(gt=0)
    low_price: float = Field(gt=0)
    close_price: float = Field(gt=0)
    volume: int | None = Field(default=None, ge=0)
    open_interest: int | None = Field(default=None, ge=0)
    settlement_price: float | None = Field(default=None, gt=0)

class FuturesDailyIndicatorsResponse(_StrictModel):
    as_of_date: date
    bar_count: int = Field(ge=1)
    latest_close: float = Field(gt=0)
    return_1_bar_pct: float | None = None
    return_5_bar_pct: float | None = None
    return_20_bar_pct: float | None = None
    sma_5: float | None = Field(default=None, gt=0)
    sma_20: float | None = Field(default=None, gt=0)
    above_sma_20: bool | None = None
    realized_volatility_20_annualized_pct: float | None = Field(default=None, ge=0)
    volume_ratio_5_to_previous_20: float | None = Field(default=None, ge=0)
    open_interest_change_5_bar_pct: float | None = None
    intraday_range_pct: float = Field(ge=0)
    trend_state: Literal["uptrend", "downtrend", "mixed", "insufficient_history"]
    formula_notes: list[str] = Field(default_factory=lambda: [
        "Returns are percentages over bars in this requested series, not calendar days.",
        "20-return realized volatility is annualized using 252 periods per year.",
        "Volume ratio compares the latest five bars with the previous twenty bars.",
        "Trend state is descriptive only and is not a trade recommendation.",
    ])

class FuturesDailyHistoryResponse(_StrictModel):
    symbol: str
    exchange: str
    provider: str
    fetched_at: datetime
    series_kind: Literal["single_contract", "continuous_proxy"]
    requested_start_date: date
    requested_end_date: date
    first_date: date | None = None
    last_date: date | None = None
    row_count: int = Field(ge=0)
    rows_skipped: int = Field(ge=0)
    duplicate_dates_skipped: int = Field(ge=0)
    bars: list[FuturesDailyBarResponse]
    analysis: FuturesDailyIndicatorsResponse | None = None
    notes: list[str] = Field(default_factory=list)

class FuturesDailyScanItemResponse(_StrictModel):
    symbol: str
    exchange: str
    provider: str
    status: Literal["ok", "insufficient_history", "provider_error"]
    rank: int | None = Field(default=None, ge=1)
    series_kind: Literal["single_contract", "continuous_proxy"] | None = None
    first_date: date | None = None
    last_date: date | None = None
    row_count: int = Field(default=0, ge=0)
    rows_skipped: int = Field(default=0, ge=0)
    analysis: FuturesDailyIndicatorsResponse | None = None
    reason_code: str | None = None

class FuturesDailyScanResponse(_StrictModel):
    requested_start_date: date
    requested_end_date: date
    requested_count: int = Field(ge=1, le=8)
    scanned_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    items: list[FuturesDailyScanItemResponse]
    notes: list[str] = Field(default_factory=lambda: [
        "Only the submitted contracts were scanned; this is not a full-market universe scan.",
        "Rank is by 20-bar return descending; contracts without that history are unranked.",
        "AKShare/Sina is a best-effort historical source, not an exchange-certified live feed.",
    ])
