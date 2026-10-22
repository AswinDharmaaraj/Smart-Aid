from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.hospital import NearbyHospitalsResponse
from app.services.hospital_service import (
    HospitalServiceError,
    find_nearby_hospitals,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


@router.get(
    "/nearby",
    response_model=NearbyHospitalsResponse,
    summary="Locate verified nearby hospitals and clinics",
    description=(
        "Queries OpenStreetMap for verified medical facilities within the given radius, "
        "calculates straight-line Haversine distance, and sorts nearest first. "
        "Location assistance only — call local emergency services in critical cases."
    ),
)
def get_nearby_hospitals(
    lat: float = Query(
        ...,
        ge=-90.0,
        le=90.0,
        description="Patient or station latitude (-90 to 90)",
    ),
    lng: float = Query(
        ...,
        ge=-180.0,
        le=180.0,
        description="Patient or station longitude (-180 to 180)",
    ),
    radius_km: float = Query(
        default=10.0,
        gt=0.0,
        le=50.0,
        description="Search radius in kilometres (0 < radius <= 50, default 10)",
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of results to return (1 <= limit <= 50, default 10)",
    ),
) -> NearbyHospitalsResponse:
    """Find and return nearest hospitals sorted by distance."""
    try:
        return find_nearby_hospitals(
            lat=lat,
            lng=lng,
            radius_km=radius_km,
            limit=limit,
        )
    except HospitalServiceError as exc:
        logger.error("Hospital service error: %s", exc.message)
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in nearby hospitals locator: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while locating nearby hospitals.",
        ) from exc
