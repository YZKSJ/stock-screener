"""Strict API contracts for the read-only derivatives research slice."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.derivatives.contracts import SUPPORTED_EXCHANGES


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class FuturesContractInput(_StrictModel):
    symbol: str = Field(min_length=1, max_length=32)
    exchange: str
    product: str = Field(min_length=1, max_length=16)
    multiplier: float
    tick_size: float
    currency: str = "CNY"

    @field_validator("symbol", "exchange", "product", "currency")
    @classmethod
    def normalize_identifiers(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("exchange")
    @classmethod
    def supported_exchange(cls, value: str) -> str:
        if value not in SUPPORTED_EXCHANGES:
            raise ValueError(f"exchange must be one of {sorted(SUPPORTED_EXCHANGES)}")
        return value

    @field_validator("multiplier", "tick_size")
    @classmethod
    def positive_market_metadata(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("value must be greater than zero")
        return value


class FuturesObservationInput(_StrictModel):
    symbol: str = Field(min_length=1, max_length=32)
    exchange: str
    as_of: datetime
    fetched_at: datetime
    last_price: float | None = None
    volume: float | None = None
    open_interest: float | None = None
    open_price: float | None = None
    high_price: float | None = None
    low_price: float | None = None
    prev_close: float | None = None
    bid_price_1: float | None = None
    ask_price_1: float | None = None
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
