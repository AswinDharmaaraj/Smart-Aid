from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class HospitalResponse(BaseModel):
    """Schema representing an individual verified medical facility."""
    id: int | str
    name: str
    latitude: float
    longitude: float
    distance_km: float
    address: Optional[str] = None
    phone: Optional[str] = None
    emergency: Optional[str] = None
    opening_hours: Optional[str] = None
    operator: Optional[str] = None
    facility_type: Optional[str] = None
    directions_url: str

    class Config:
        from_attributes = True


class NearbyHospitalsResponse(BaseModel):
    """Schema representing the collection of nearby hospitals."""
    latitude: float
    longitude: float
    radius_km: float
    count: int
    hospitals: list[HospitalResponse] = Field(default_factory=list)
    disclaimer: str = (
        "Location assistance only. In a life-threatening emergency, call local "
        "emergency services (e.g. 112 / 108 / 911) immediately."
    )

    class Config:
        from_attributes = True
