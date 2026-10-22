"""
SmartAid AI — Sprint 5: Hospital Locator Tests

Tests cover:
  1. Haversine distance calculation accuracy (same point, known distances).
  2. Parsing of OSM Overpass elements (nodes, ways with center).
  3. Parsing of OSM Nominatim items (genuine OSM IDs, addresses, tags).
  4. Correct ascending sort by Haversine distance.
  5. Result limiting.
  6. Empty results handling from upstream.
  7. Malformed upstream responses (missing tags, bad coords, missing keys).
  8. Local verified OpenStreetMap reference extract fallback (when upstream is offline/502).
  9. Upstream timeout error handling (HTTP 504).
  10. Upstream HTTP / connection error handling (HTTP 502).
  11. Multi-provider configuration (Nominatim, Overpass, Local OSM).
  12. Coordinate and radius boundary validation (HTTP 422 for invalid inputs).
"""
from __future__ import annotations

import httpx
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.hospital_service import (
    haversine_distance_km,
    parse_overpass_elements,
    parse_nominatim_results,
    load_local_osm_facilities,
    find_nearby_hospitals,
    UpstreamTimeoutError,
    UpstreamServiceError,
)

client = TestClient(app)


# ==============================================================================
# 1. HAVERSINE DISTANCE UNIT TESTS
# ==============================================================================
def test_haversine_same_point():
    """Distance between identical coordinates must be exactly 0.0 km."""
    d = haversine_distance_km(9.9312, 76.2673, 9.9312, 76.2673)
    assert d == 0.0


def test_haversine_known_distance():
    """
    Kochi (9.9312, 76.2673) to Ernakulam Town Station (9.9926, 76.2885)
    is approx 7.2 km straight line.
    """
    d = haversine_distance_km(9.9312, 76.2673, 9.9926, 76.2885)
    assert 6.5 <= d <= 8.0


def test_haversine_equator_degree():
    """One degree of longitude along the equator is approximately 111.32 km."""
    d = haversine_distance_km(0.0, 0.0, 0.0, 1.0)
    assert 111.0 <= d <= 112.0


# ==============================================================================
# 2. OVERPASS ELEMENT PARSING & OVERPASS TESTS
# ==============================================================================
def test_parse_overpass_elements_node_and_way():
    """Nodes (lat/lon) and ways (center lat/lon) are both parsed cleanly."""
    elements = [
        {
            "type": "node",
            "id": 101,
            "lat": 9.9350,
            "lon": 76.2700,
            "tags": {
                "name": "General Hospital",
                "addr:street": "Hospital Road",
                "addr:city": "Kochi",
                "phone": "+91 484 236 1234",
                "emergency": "yes",
                "opening_hours": "24/7",
            },
        },
        {
            "type": "way",
            "id": 202,
            "center": {"lat": 9.9450, "lon": 76.2800},
            "tags": {
                "name": "City Trauma Center",
                "amenity": "hospital",
            },
        },
    ]

    origin_lat, origin_lng = 9.9312, 76.2673
    hospitals = parse_overpass_elements(elements, origin_lat, origin_lng)

    assert len(hospitals) == 2

    h1 = hospitals[0]
    assert h1.id == 101
    assert h1.name == "General Hospital"
    assert h1.emergency == "yes"
    assert h1.opening_hours == "24/7"
    assert h1.phone == "+91 484 236 1234"
    assert "Hospital Road" in h1.address
    assert "google.com/maps/dir" in h1.directions_url

    h2 = hospitals[1]
    assert h2.id == 202
    assert h2.name == "City Trauma Center"
    assert h2.address is None
    assert h2.emergency is None


def test_overpass_sorting_by_distance():
    """Hospitals from Overpass must be sorted in ascending order of straight-line distance."""
    mock_elements = [
        {
            "id": 1,
            "lat": 10.1000,
            "lon": 76.3000,
            "tags": {"name": "Far Hospital"},
        },
        {
            "id": 2,
            "lat": 9.9320,
            "lon": 76.2680,
            "tags": {"name": "Near Hospital"},
        },
        {
            "id": 3,
            "lat": 9.9800,
            "lon": 76.2750,
            "tags": {"name": "Mid Hospital"},
        },
    ]

    with patch("httpx.Client.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {"elements": mock_elements}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        res = find_nearby_hospitals(lat=9.9312, lng=76.2673, radius_km=30.0, provider="overpass")

        assert res.count == 3
        assert res.hospitals[0].name == "Near Hospital"
        assert res.hospitals[1].name == "Mid Hospital"
        assert res.hospitals[2].name == "Far Hospital"
        assert res.hospitals[0].distance_km <= res.hospitals[1].distance_km <= res.hospitals[2].distance_km


def test_overpass_limiting():
    """Limit parameter strictly caps returned Overpass items."""
    mock_elements = [
        {"id": i, "lat": 9.9312 + (i * 0.001), "lon": 76.2673, "tags": {"name": f"Hosp {i}"}}
        for i in range(15)
    ]

    with patch("httpx.Client.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {"elements": mock_elements}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        res = find_nearby_hospitals(lat=9.9312, lng=76.2673, limit=5, provider="overpass")
        assert res.count == 5
        assert len(res.hospitals) == 5


def test_overpass_fallback_on_502():
    """When primary Overpass endpoint returns 502, service falls back to secondary endpoint and succeeds."""
    mock_elements = [
        {"id": 401, "lat": 9.9350, "lon": 76.2700, "tags": {"name": "Fallback Hospital"}}
    ]
    req_primary = httpx.Request("POST", "https://overpass-api.de/api/interpreter")
    err_502 = httpx.HTTPStatusError("Bad Gateway", request=req_primary, response=httpx.Response(502, request=req_primary))

    mock_resp_success = MagicMock()
    mock_resp_success.json.return_value = {"elements": mock_elements}
    mock_resp_success.raise_for_status.return_value = None

    with patch("httpx.Client.post", side_effect=[err_502, mock_resp_success]):
        res = find_nearby_hospitals(lat=9.9312, lng=76.2673, provider="overpass")
        assert res.count == 1
        assert res.hospitals[0].name == "Fallback Hospital"


def test_overpass_fallback_on_timeout():
    """When primary Overpass endpoint times out, service falls back to secondary endpoint and succeeds."""
    mock_elements = [
        {"id": 402, "lat": 9.9350, "lon": 76.2700, "tags": {"name": "Timeout Fallback Hospital"}}
    ]
    mock_resp_success = MagicMock()
    mock_resp_success.json.return_value = {"elements": mock_elements}
    mock_resp_success.raise_for_status.return_value = None

    with patch("httpx.Client.post", side_effect=[httpx.TimeoutException("Read timed out"), mock_resp_success]):
        res = find_nearby_hospitals(lat=9.9312, lng=76.2673, provider="overpass")
        assert res.count == 1
        assert res.hospitals[0].name == "Timeout Fallback Hospital"


# ==============================================================================
# 3. NOMINATIM GEODATA PROVIDER TESTS
# ==============================================================================
def test_parse_nominatim_results():
    """Parses raw Nominatim JSON results into verified HospitalResponse objects."""
    raw_items = [
        {
            "place_id": 12345,
            "osm_id": 987654,
            "osm_type": "node",
            "lat": "10.1909987",
            "lon": "76.3895789",
            "name": "Little Flower Hospital",
            "display_name": "Little Flower Hospital, MC Road, Angamaly, Aluva, Kerala, India",
            "type": "hospital",
            "address": {
                "road": "MC Road",
                "suburb": "Angamaly",
                "town": "Aluva",
                "state": "Kerala",
            },
            "extratags": {
                "phone": "+91 484 245 2546",
                "emergency": "yes",
                "opening_hours": "24/7",
            },
        },
        {
            "place_id": 67890,
            "osm_id": 555555,
            "lat": "10.5000",
            "lon": "76.8000",
            "name": "Out of Range Hospital",
            "display_name": "Out of Range Hospital",
            "type": "hospital",
        },
    ]

    # Search origin: 10.1719, 76.4297 with 10 km radius
    hospitals = parse_nominatim_results(raw_items, 10.1719, 76.4297, radius_km=10.0)

    # First hospital is approx 4.8 km away (within 10 km); second is >40 km away (filtered out)
    assert len(hospitals) == 1
    h = hospitals[0]
    assert h.name == "Little Flower Hospital"
    assert h.emergency == "yes"
    assert h.phone == "+91 484 245 2546"
    assert "MC Road" in h.address
    assert "Angamaly" in h.address
    assert h.distance_km < 10.0


def test_nominatim_sorting_and_limiting():
    """Nominatim provider sorts by distance ascending and applies limit."""
    mock_nominatim_items = [
        {
            "osm_id": 1,
            "lat": "10.1750",
            "lon": "76.4300",
            "name": "Near Hospital",
            "type": "hospital",
        },
        {
            "osm_id": 2,
            "lat": "10.2000",
            "lon": "76.4300",
            "name": "Mid Hospital",
            "type": "hospital",
        },
        {
            "osm_id": 3,
            "lat": "10.2200",
            "lon": "76.4300",
            "name": "Far Hospital",
            "type": "hospital",
        },
    ]

    with patch("httpx.Client.get") as mock_get:
        mock_response = MagicMock()
        mock_response.json.return_value = mock_nominatim_items
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = find_nearby_hospitals(lat=10.1719, lng=76.4297, radius_km=15.0, limit=2, provider="nominatim")

        assert res.count == 2
        assert len(res.hospitals) == 2
        assert res.hospitals[0].name == "Near Hospital"
        assert res.hospitals[1].name == "Mid Hospital"
        assert res.hospitals[0].distance_km <= res.hospitals[1].distance_km


# ==============================================================================
# 4. LOCAL VERIFIED OSM REFERENCE EXTRACT FALLBACK TESTS
# ==============================================================================
def test_local_osm_facilities_lookup():
    """Local verified OSM reference extract returns real hospitals for reference test areas."""
    facilities = load_local_osm_facilities(origin_lat=10.1719, origin_lng=76.4297, radius_km=10.0)
    assert len(facilities) > 0
    # Verified hospital names in that area
    names = [f.name for f in facilities]
    assert any("Community Health Centre" in n or "Hospital" in n for n in names)
    assert all(f.distance_km <= 10.0 for f in facilities)


def test_upstream_failure_falls_back_to_local_osm_dataset():
    """When public map service times out or errors, local verified OSM extract serves results seamlessly."""
    with patch("httpx.Client.get", side_effect=httpx.TimeoutException("Upstream timeout")):
        with patch.object(settings, "ENABLE_LOCAL_OSM_FALLBACK", True):
            res = find_nearby_hospitals(lat=10.1719, lng=76.4297, radius_km=10.0, provider="nominatim")
            assert res.count > 0
            assert len(res.hospitals) > 0
            # Distances must be calculated and sorted
            assert res.hospitals[0].distance_km <= res.hospitals[-1].distance_km


def test_upstream_error_raises_honest_504_when_no_local_coverage():
    """When upstream times out and coordinates have no local dataset coverage, raise honest 504."""
    with patch("httpx.Client.get", side_effect=httpx.TimeoutException("Upstream timeout")):
        with pytest.raises(UpstreamTimeoutError) as exc_info:
            # North pole coordinates (no hospitals locally or globally)
            find_nearby_hospitals(lat=89.0, lng=0.0, radius_km=5.0, provider="nominatim")
        assert exc_info.value.status_code == 504
        assert "timed out" in exc_info.value.message.lower()


def test_upstream_error_raises_honest_502_when_no_local_coverage():
    """When upstream returns 502 and coordinates have no local dataset coverage, raise honest 502."""
    req = httpx.Request("GET", "https://nominatim.openstreetmap.org/search")
    err_502 = httpx.HTTPStatusError("Bad Gateway", request=req, response=httpx.Response(502, request=req))

    with patch("httpx.Client.get", side_effect=err_502):
        with pytest.raises(UpstreamServiceError) as exc_info:
            find_nearby_hospitals(lat=89.0, lng=0.0, radius_km=5.0, provider="nominatim")
        assert exc_info.value.status_code == 502
        assert "upstream map service" in exc_info.value.message.lower()


# ==============================================================================
# 5. API ENDPOINT (GET /api/v1/hospitals/nearby) INTEGRATION TESTS
# ==============================================================================
def test_api_nearby_hospitals_valid():
    """GET /api/v1/hospitals/nearby returns 200 and schema with mocked geodata provider."""
    from app.schemas.hospital import HospitalResponse

    mock_hospitals = [
        HospitalResponse(
            id=999,
            name="St. Joseph Memorial Hospital",
            latitude=10.1800,
            longitude=76.4300,
            distance_km=0.89,
            address="MG Road",
            phone="+91 484 220 9999",
            emergency="yes",
            directions_url="https://www.google.com/maps/dir/?api=1&destination=10.180000,76.430000",
        )
    ]

    with patch("app.services.hospital_service.query_nominatim", return_value=mock_hospitals):
        res = client.get("/api/v1/hospitals/nearby?lat=10.1719&lng=76.4297&radius_km=10&limit=5")
        assert res.status_code == 200
        data = res.json()
        assert data["latitude"] == 10.1719
        assert data["longitude"] == 76.4297
        assert data["count"] == 1
        assert len(data["hospitals"]) == 1
        assert data["hospitals"][0]["name"] == "St. Joseph Memorial Hospital"
        assert "disclaimer" in data


def test_api_validation_invalid_latitude():
    """Latitude > 90 or < -90 returns 422 Unprocessable Entity."""
    res_high = client.get("/api/v1/hospitals/nearby?lat=95.0&lng=76.2673")
    assert res_high.status_code == 422

    res_low = client.get("/api/v1/hospitals/nearby?lat=-95.0&lng=76.2673")
    assert res_low.status_code == 422


def test_api_validation_invalid_longitude():
    """Longitude > 180 or < -180 returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/hospitals/nearby?lat=9.9312&lng=185.0")
    assert res.status_code == 422


def test_api_validation_invalid_radius():
    """Radius <= 0 or > 50 returns 422 Unprocessable Entity."""
    res_zero = client.get("/api/v1/hospitals/nearby?lat=9.9312&lng=76.2673&radius_km=0")
    assert res_zero.status_code == 422

    res_too_large = client.get("/api/v1/hospitals/nearby?lat=9.9312&lng=76.2673&radius_km=100")
    assert res_too_large.status_code == 422


def test_api_validation_missing_coordinates():
    """Missing required lat or lng returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/hospitals/nearby?radius_km=10")
    assert res.status_code == 422


def test_api_timeout_returns_504_when_unresolvable():
    """When upstream map service times out and no local fallback matches, return 504."""
    with patch("app.services.hospital_service.query_nominatim", side_effect=httpx.TimeoutException("Timeout")):
        with patch.object(settings, "ENABLE_LOCAL_OSM_FALLBACK", False):
            res = client.get("/api/v1/hospitals/nearby?lat=10.1719&lng=76.4297")
            assert res.status_code == 504
            assert "timed out" in res.json()["detail"].lower()


def test_api_upstream_error_returns_502_when_unresolvable():
    """When upstream fails with 5xx and no local fallback matches, return 502."""
    req = httpx.Request("GET", "https://nominatim.openstreetmap.org/search")
    err = httpx.HTTPStatusError("Bad Gateway", request=req, response=httpx.Response(502, request=req))

    with patch("app.services.hospital_service.query_nominatim", side_effect=err):
        with patch.object(settings, "ENABLE_LOCAL_OSM_FALLBACK", False):
            res = client.get("/api/v1/hospitals/nearby?lat=10.1719&lng=76.4297")
            assert res.status_code == 502
            assert "upstream map service" in res.json()["detail"].lower()
