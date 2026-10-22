import { apiRequest } from "./api";

export interface Hospital {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  address?: string | null;
  phone?: string | null;
  emergency?: string | null;
  opening_hours?: string | null;
  operator?: string | null;
  facility_type?: string | null;
  directions_url: string;
}

export interface NearbyHospitalsResponse {
  latitude: number;
  longitude: number;
  radius_km: number;
  count: number;
  hospitals: Hospital[];
  disclaimer: string;
}

export interface NearbyHospitalsParams {
  lat: number;
  lng: number;
  radius_km?: number;
  limit?: number;
}

/**
 * Fetch nearby verified hospitals from the SmartAid backend.
 * Uses OpenStreetMap Overpass data via the backend service with straight-line Haversine calculations.
 */
export async function getNearbyHospitals(
  params: NearbyHospitalsParams,
): Promise<NearbyHospitalsResponse> {
  const { lat, lng, radius_km = 10, limit = 10 } = params;

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("Invalid coordinates provided.");
  }

  const query = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radius_km: radius_km.toString(),
    limit: limit.toString(),
  });

  return apiRequest<NearbyHospitalsResponse>(`/hospitals/nearby?${query.toString()}`);
}
