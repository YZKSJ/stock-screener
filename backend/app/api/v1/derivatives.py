"""Read-only API endpoints for domestic futures and derivatives research."""
from __future__ import annotations

from fastapi import APIRouter

from app.domain.derivatives.contracts import FuturesContract, FuturesMarketObservation
from app.domain.derivatives.quality import validate_market_observation
from app.schemas.derivatives import SnapshotValidationRequest, SnapshotValidationResponse

router = APIRouter()


@router.post(
    "/validate-snapshot",
    response_model=SnapshotValidationResponse,
    summary="Validate a supplied futures quote snapshot",
)
def validate_snapshot(request: SnapshotValidationRequest) -> SnapshotValidationResponse:
    """Validate a supplied normalized snapshot; this endpoint never fetches live data."""
    contract = FuturesContract(**request.contract.model_dump())
    observation = FuturesMarketObservation(**request.observation.model_dump())
    report = validate_market_observation(
        contract, observation, max_age_seconds=request.max_age_seconds
    )
    return SnapshotValidationResponse(
        status=report.status.value,
        instrument_id=report.instrument_id,
        source=report.source,
        as_of=report.as_of,
        age_seconds=report.age_seconds,
        errors=list(report.errors),
        warnings=list(report.warnings),
    )
