from __future__ import annotations

import json
import logging
import math
import pathlib
from typing import Any, Optional
import httpx

from app.core.config import settings
from app.schemas.hospital import HospitalResponse, NearbyHospitalsResponse

logger = logging.getLogger(__name__)


class HospitalServiceError(Exception):
    """Base exception for hospital service errors."""
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class UpstreamTimeoutError(HospitalServiceError):
    """Raised when the upstream map/geodata service times out."""
    def __init__(self, message: str = "Upstream map service timed out. Please try again or dial 112 / 108 / 911."):
        super().__init__(message, status_code=504)


class UpstreamServiceError(HospitalServiceError):
    """Raised when the upstream map service fails or returns an unexpected error."""
    def __init__(self, message: str = "Upstream map service is temporarily unavailable. In an emergency, dial 112 / 108 / 911."):
        super().__init__(message, status_code=502)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth
    using the Haversine formula. Returns distance in kilometres rounded to 2 decimal places.
    """
    earth_radius_km = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    a = max(0.0, min(1.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(earth_radius_km * c, 2)


def _format_address(tags: dict[str, Any]) -> Optional[str]:
    """Assemble an address string from available OSM tags without fabricating fields."""
    if "addr:full" in tags and str(tags["addr:full"]).strip():
        return str(tags["addr:full"]).strip()

    parts: list[str] = []
    housenumber = str(tags.get("addr:housenumber", "")).strip()
    street = str(tags.get("addr:street", "")).strip()
    if housenumber and street:
        parts.append(f"{housenumber} {street}")
    elif street:
        parts.append(street)
    elif housenumber:
        parts.append(housenumber)

    for field in ("addr:suburb", "addr:city", "addr:state", "addr:postcode"):
        val = str(tags.get(field, "")).strip()
        if val:
            parts.append(val)

    return ", ".join(parts) if parts else None


def _build_directions_url(lat: float, lon: float) -> str:
    """Construct a universal Google Maps directions link."""
    return f"https://www.google.com/maps/dir/?api=1&destination={lat:.6f},{lon:.6f}"


def build_overpass_query(lat: float, lng: float, radius_meters: int) -> str:
    """Construct a minimal Overpass QL query searching hospital nodes and ways."""
    return f"""[out:json][timeout:{settings.OVERPASS_TIMEOUT_SECONDS}];
(
  node["amenity"="hospital"](around:{radius_meters},{lat},{lng});
  way["amenity"="hospital"](around:{radius_meters},{lat},{lng});
  node["amenity"="clinic"](around:{radius_meters},{lat},{lng});
  way["amenity"="clinic"](around:{radius_meters},{lat},{lng});
);
out center tags;
"""


def parse_overpass_elements(
    elements: list[dict[str, Any]],
    origin_lat: float,
    origin_lng: float,
) -> list[HospitalResponse]:
    """Parse raw Overpass JSON elements into verified HospitalResponse objects."""
    hospitals: list[HospitalResponse] = []

    for element in elements:
        element_id = element.get("id")
        tags: dict[str, Any] = element.get("tags") or {}

        elem_lat: Optional[float] = None
        elem_lon: Optional[float] = None

        if "lat" in element and "lon" in element:
            elem_lat = element["lat"]
            elem_lon = element["lon"]
        elif "center" in element and isinstance(element["center"], dict):
            elem_lat = element["center"].get("lat")
            elem_lon = element["center"].get("lon")

        if elem_lat is None or elem_lon is None:
            continue

        try:
            elem_lat = float(elem_lat)
            elem_lon = float(elem_lon)
        except (ValueError, TypeError):
            continue

        name = tags.get("name") or tags.get("name:en")
        if not name or not str(name).strip():
            facility_type = tags.get("amenity", "hospital").capitalize()
            name = f"Unnamed {facility_type} (OSM ID {element_id})"
        else:
            name = str(name).strip()

        distance = haversine_distance_km(origin_lat, origin_lng, elem_lat, elem_lon)
        address = _format_address(tags)
        phone = tags.get("phone") or tags.get("contact:phone")
        emergency = tags.get("emergency")
        opening_hours = tags.get("opening_hours")
        operator = tags.get("operator")
        facility_type = tags.get("amenity")

        hospitals.append(
            HospitalResponse(
                id=element_id,
                name=name,
                latitude=elem_lat,
                longitude=elem_lon,
                distance_km=distance,
                address=address,
                phone=phone.strip() if phone else None,
                emergency=emergency.strip() if emergency else None,
                opening_hours=opening_hours.strip() if opening_hours else None,
                operator=operator.strip() if operator else None,
                facility_type=facility_type.strip() if facility_type else None,
                directions_url=_build_directions_url(elem_lat, elem_lon),
            )
        )

    return hospitals


def parse_nominatim_results(
    items: list[dict[str, Any]],
    origin_lat: float,
    origin_lng: float,
    radius_km: float,
) -> list[HospitalResponse]:
    """
    Parse Nominatim OpenStreetMap search results into verified HospitalResponse objects.
    Filters strictly by radius using Haversine calculation.
    """
    hospitals: list[HospitalResponse] = []

    for item in items:
        try:
            elem_lat = float(item["lat"])
            elem_lon = float(item["lon"])
        except (KeyError, ValueError, TypeError):
            continue

        distance = haversine_distance_km(origin_lat, origin_lng, elem_lat, elem_lon)
        if distance > radius_km:
            continue

        osm_id = item.get("osm_id") or item.get("place_id") or "osm_unknown"
        raw_name = item.get("name")
        display_name = item.get("display_name") or ""
        if not raw_name or not str(raw_name).strip():
            raw_name = display_name.split(",")[0].strip() if display_name else f"Medical Facility (OSM ID {osm_id})"
        else:
            raw_name = str(raw_name).strip()

        addr_dict = item.get("address") or {}
        addr_parts = [
            v for k, v in addr_dict.items()
            if k in ("road", "suburb", "town", "city", "county", "state_district", "state", "postcode")
            and isinstance(v, str)
        ]
        address = ", ".join(addr_parts) if addr_parts else (display_name if display_name else None)

        extratags = item.get("extratags") or {}
        phone = extratags.get("phone") or extratags.get("contact:phone")
        emergency = extratags.get("emergency")
        opening_hours = extratags.get("opening_hours")
        operator = extratags.get("operator")
        facility_type = item.get("type") or "hospital"

        hospitals.append(
            HospitalResponse(
                id=osm_id,
                name=raw_name,
                latitude=elem_lat,
                longitude=elem_lon,
                distance_km=distance,
                address=address,
                phone=phone.strip() if phone else None,
                emergency=emergency.strip() if emergency else None,
                opening_hours=opening_hours.strip() if opening_hours else None,
                operator=operator.strip() if operator else None,
                facility_type=facility_type.strip() if facility_type else None,
                directions_url=_build_directions_url(elem_lat, elem_lon),
            )
        )

    return hospitals


def load_local_osm_facilities(
    origin_lat: float,
    origin_lng: float,
    radius_km: float,
) -> list[HospitalResponse]:
    """
    Search within the local verified OpenStreetMap extract snapshot.
    Provides offline and fallback hospital lookup for academic testing and resilience.
    Coverage is static and does not confirm live emergency capacity.
    """
    app_dir = pathlib.Path(__file__).parent.parent
    data_path = app_dir / "data" / "osm_hospitals_reference.json"

    if not data_path.exists():
        return []

    try:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        logger.warning("Could not read local OSM reference dataset: %s", exc)
        return []

    facilities_raw = data.get("facilities", [])
    matched: list[HospitalResponse] = []

    for fac in facilities_raw:
        try:
            h_lat = float(fac["latitude"])
            h_lon = float(fac["longitude"])
        except (KeyError, ValueError, TypeError):
            continue

        distance = haversine_distance_km(origin_lat, origin_lng, h_lat, h_lon)
        if distance <= radius_km:
            matched.append(
                HospitalResponse(
                    id=fac.get("id", "osm_local"),
                    name=fac.get("name", "Medical Facility"),
                    latitude=h_lat,
                    longitude=h_lon,
                    distance_km=distance,
                    address=fac.get("address"),
                    phone=fac.get("phone"),
                    emergency=fac.get("emergency"),
                    opening_hours=fac.get("opening_hours"),
                    operator=fac.get("operator"),
                    facility_type=fac.get("facility_type", "hospital"),
                    directions_url=_build_directions_url(h_lat, h_lon),
                )
            )

    return matched


def query_nominatim(
    lat: float,
    lng: float,
    radius_km: float,
    client: httpx.Client,
) -> list[HospitalResponse]:
    """Query OpenStreetMap Nominatim search API for nearby medical facilities."""
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * max(0.1, math.cos(math.radians(lat))))

    min_lat = lat - lat_delta
    max_lat = lat + lat_delta
    min_lon = lng - lon_delta
    max_lon = lng + lon_delta

    params = {
        "q": "hospital",
        "format": "jsonv2",
        "addressdetails": "1",
        "extratags": "1",
        "limit": "50",
        "viewbox": f"{min_lon:.5f},{max_lat:.5f},{max_lon:.5f},{min_lat:.5f}",
        "bounded": "1",
    }
    headers = {
        "User-Agent": getattr(
            settings,
            "NOMINATIM_USER_AGENT",
            "SmartAidAcademicProject/1.0 (smartaid-project@college.edu)",
        ),
    }

    url = getattr(settings, "NOMINATIM_API_URL", "https://nominatim.openstreetmap.org/search")
    response = client.get(url, params=params, headers=headers)
    response.raise_for_status()

    items = response.json()
    if not isinstance(items, list):
        return []

    return parse_nominatim_results(items, lat, lng, radius_km)


def query_overpass(
    lat: float,
    lng: float,
    radius_km: float,
    client: httpx.Client,
) -> list[HospitalResponse]:
    """Query OpenStreetMap Overpass API instances for nearby medical facilities."""
    radius_meters = int(radius_km * 1000)
    query = build_overpass_query(lat, lng, radius_meters)

    headers = {
        "User-Agent": "SmartAidAcademicProject/1.0 (smartaid-project@college.edu)"
    }

    endpoints: list[str] = [settings.OVERPASS_API_URL]
    for fb in getattr(settings, "OVERPASS_FALLBACK_URLS", []):
        if fb and fb not in endpoints:
            endpoints.append(fb)

    data: Optional[dict[str, Any]] = None
    last_error: Optional[Exception] = None

    for idx, endpoint in enumerate(endpoints):
        try:
            response = client.post(
                endpoint,
                data={"data": query},
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            break
        except httpx.TimeoutException as exc:
            logger.warning("Overpass endpoint %s timed out for (%.4f, %.4f)", endpoint, lat, lng)
            last_error = exc
            if idx < len(endpoints) - 1:
                continue
            raise UpstreamTimeoutError(
                "Upstream Overpass map service timed out. Dial 112 / 108 / 911 for emergencies."
            ) from exc
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "Overpass endpoint %s returned HTTP %s for (%.4f, %.4f)",
                endpoint,
                exc.response.status_code,
                lat,
                lng,
            )
            last_error = exc
            if exc.response.status_code in (429, 502, 503, 504) and idx < len(endpoints) - 1:
                continue
            status_code = exc.response.status_code
            msg = (
                f"Upstream map service error (HTTP {status_code})."
                if status_code not in (429, 502, 503, 504)
                else "Upstream map service is temporarily at capacity (HTTP 502)."
            )
            raise UpstreamServiceError(msg) from exc
        except (httpx.RequestError, ValueError) as exc:
            logger.warning("Failed to query Overpass %s: %s", endpoint, exc)
            last_error = exc
            if idx < len(endpoints) - 1:
                continue
            raise UpstreamServiceError("Upstream map service is temporarily unavailable.") from exc

    if data is None:
        if isinstance(last_error, httpx.TimeoutException):
            raise UpstreamTimeoutError()
        raise UpstreamServiceError("Upstream map service is temporarily unavailable.")

    elements = data.get("elements")
    if not isinstance(elements, list):
        return []

    return parse_overpass_elements(elements, lat, lng)


def find_nearby_hospitals(
    lat: float,
    lng: float,
    radius_km: float = 10.0,
    limit: int = 10,
    client: Optional[httpx.Client] = None,
    provider: Optional[str] = None,
) -> NearbyHospitalsResponse:
    """
    Search for verified nearby medical facilities, sort ascending by straight-line distance,
    and return structured responses.

    Supports configurable providers ("nominatim", "overpass", "local_osm") and
    graceful fallback to verified OpenStreetMap reference extracts if public APIs fail.
    """
    should_close_client = False
    if client is None:
        timeout_sec = float(getattr(settings, "HOSPITAL_TIMEOUT_SECONDS", 10))
        client = httpx.Client(timeout=timeout_sec)
        should_close_client = True

    active_provider = (
        provider or getattr(settings, "HOSPITAL_PROVIDER", "nominatim")
    ).strip().lower()

    hospitals: list[HospitalResponse] = []
    upstream_error: Optional[Exception] = None

    try:
        if active_provider == "nominatim":
            try:
                hospitals = query_nominatim(lat, lng, radius_km, client)
            except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError) as exc:
                logger.warning("Nominatim query failed for (%.4f, %.4f): %s", lat, lng, exc)
                upstream_error = exc

        elif active_provider == "overpass":
            try:
                hospitals = query_overpass(lat, lng, radius_km, client)
            except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError) as exc:
                logger.warning("Overpass query failed for (%.4f, %.4f): %s", lat, lng, exc)
                upstream_error = exc

        elif active_provider == "local_osm":
            hospitals = load_local_osm_facilities(lat, lng, radius_km)

        # Fallback to local verified OSM snapshot if upstream failed or returned 0 items
        if getattr(settings, "ENABLE_LOCAL_OSM_FALLBACK", True):
            if upstream_error is not None or len(hospitals) == 0:
                local_matches = load_local_osm_facilities(lat, lng, radius_km)
                if local_matches:
                    logger.info(
                        "Serving %d hospital(s) from verified local OSM reference dataset for (%.4f, %.4f)",
                        len(local_matches),
                        lat,
                        lng,
                    )
                    hospitals = local_matches
                    upstream_error = None  # Successfully resolved via verified local snapshot

        if upstream_error is not None:
            if isinstance(upstream_error, httpx.TimeoutException):
                raise UpstreamTimeoutError(
                    "Upstream map service timed out. In an emergency, dial 112 / 108 / 911 immediately."
                ) from upstream_error
            if isinstance(upstream_error, httpx.HTTPStatusError):
                status_code = upstream_error.response.status_code
                if status_code in (429, 502, 503, 504):
                    raise UpstreamServiceError(
                        "Upstream map service is temporarily at capacity (HTTP 502). In an emergency, dial 112 / 108 / 911 immediately."
                    ) from upstream_error
                raise UpstreamServiceError(
                    f"Upstream map service error (HTTP {status_code}). In an emergency, dial 112 / 108 / 911 immediately."
                ) from upstream_error
            raise UpstreamServiceError(
                "Upstream map service is temporarily unavailable. In an emergency, dial 112 / 108 / 911 immediately."
            ) from upstream_error

    finally:
        if should_close_client:
            client.close()

    # Sort strictly by distance ascending
    hospitals.sort(key=lambda h: h.distance_km)

    limited = hospitals[:limit]

    return NearbyHospitalsResponse(
        latitude=lat,
        longitude=lng,
        radius_km=radius_km,
        count=len(limited),
        hospitals=limited,
    )
