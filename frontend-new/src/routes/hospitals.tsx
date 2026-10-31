import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadSession, type Session } from "@/lib/smartaid";
import {
  getNearbyHospitals,
  type Hospital,
} from "@/lib/hospitalService";

export const Route = createFileRoute("/hospitals")({
  head: () => ({
    meta: [
      { title: "Hospital Recommendation — SmartAid AI" },
      {
        name: "description",
        content:
          "Locate verified nearby hospitals and clinics based on your current location and emergency assessment.",
      },
      { property: "og:title", content: "Hospital Recommendation — SmartAid AI" },
      {
        property: "og:description",
        content: "Verified emergency facilities and directions assistance.",
      },
    ],
  }),
  component: HospitalsPage,
});

type SearchStatus =
  | "idle"
  | "locating"
  | "searching"
  | "success"
  | "empty"
  | "permission_denied"
  | "unsupported"
  | "error";

function isSafeDirectionsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      (parsed.hostname === "www.google.com" ||
        parsed.hostname === "google.com" ||
        parsed.hostname === "maps.google.com") &&
      parsed.pathname.startsWith("/maps/dir/")
    );
  } catch {
    return false;
  }
}

function HospitalsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const severity = session?.result?.severity;

  const handleLocateAndSearch = (radiusOverride?: number) => {
    const targetRadius = radiusOverride ?? radiusKm;

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setErrorMessage(
        "Geolocation is not supported by this browser. Please search for local facilities directly or call emergency services."
      );
      return;
    }

    setStatus("locating");
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setCoords({ lat: userLat, lng: userLng });
        setStatus("searching");

        try {
          const res = await getNearbyHospitals({
            lat: userLat,
            lng: userLng,
            radius_km: targetRadius,
            limit: 15,
          });

          setDisclaimer(res.disclaimer);

          if (!res.hospitals || res.hospitals.length === 0) {
            setHospitals([]);
            setStatus("empty");
          } else {
            setHospitals(res.hospitals);
            setStatus("success");
          }
        } catch (err) {
          setStatus("error");
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Failed to connect to the hospital locator service. Please try again or call emergency services."
          );
        }
      },
      (geoErr) => {
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setStatus("permission_denied");
          setErrorMessage(
            "Location access was denied. To find hospitals closest to you, enable location permissions in your browser settings."
          );
        } else {
          setStatus("error");
          setErrorMessage(
            "Unable to determine your GPS location. Please check your device location settings or enter coordinates manually."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  return (
    <div className="container-flow py-10 md:py-14">
      {/* Header section */}
      <div className="rise">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" /> SmartAid Locator · GPS Verified
        </span>
        <h1 className="mt-5 text-3xl font-semibold md:text-4xl">Nearby Medical Facilities</h1>
        <p className="mt-2 text-muted-foreground">
          {severity
            ? `Assisting with recommended facilities for a ${severity.toLowerCase()} ${session?.result?.emergency.label.toLowerCase() || "emergency"}.`
            : "Locate verified hospitals and clinics closest to your current location."}
        </p>
      </div>

      {/* Mandatory Emergency Medical Warning */}
      <div className="mt-6 rounded-2xl border border-critical/30 bg-critical-soft p-5 text-sm text-foreground shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 shrink-0 text-critical" aria-hidden="true" />
          <div>
            <p className="font-semibold text-critical">
              In a Life-Threatening Emergency, Call Immediately
            </p>
            <p className="mt-1 leading-relaxed text-foreground/80">
              If the patient is unconscious, not breathing, in cardiac arrest, or experiencing severe bleeding,{" "}
              <strong>do not delay by driving to a clinic</strong>. Call national emergency services{" "}
              <strong>(112 / 108 / 911)</strong> for immediate dispatch.
            </p>
            <div className="mt-3">
              <a
                href="tel:112"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-critical px-3.5 text-xs font-semibold text-critical-foreground hover:bg-critical/90"
              >
                <Phone className="size-3.5" aria-hidden="true" /> Emergency Call (112)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* GPS Action Bar */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {status === "success"
                ? `Found ${hospitals.length} verified facilities near you`
                : "Search from your current location"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Uses device GPS coordinates to query verified OpenStreetMap facilities.
              Distances represent approximate straight-line measurements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Radius selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="radius-select" className="text-xs text-muted-foreground">
                Radius:
              </label>
              <select
                id="radius-select"
                value={radiusKm}
                disabled={status === "locating" || status === "searching"}
                onChange={(e) => {
                  const newR = Number(e.target.value);
                  setRadiusKm(newR);
                  if (coords) {
                    handleLocateAndSearch(newR);
                  }
                }}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={20}>20 km</option>
                <option value={30}>30 km</option>
              </select>
            </div>

            <Button
              size="default"
              disabled={status === "locating" || status === "searching"}
              onClick={() => handleLocateAndSearch()}
              className="gap-2"
            >
              {status === "locating" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Acquiring GPS...
                </>
              ) : status === "searching" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Searching Facilities...
                </>
              ) : status === "success" ? (
                <>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Refresh Location
                </>
              ) : (
                <>
                  <Compass className="size-4" aria-hidden="true" />
                  Find Nearby Hospitals
                </>
              )}
            </Button>
          </div>
        </div>

        {/* State messages */}
        {status === "permission_denied" && (
          <div className="mt-4 rounded-xl border border-moderate/30 bg-moderate-soft p-4 text-xs text-foreground">
            <p className="font-semibold text-moderate flex items-center gap-2">
              <ShieldAlert className="size-4" /> Location Permission Required
            </p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{errorMessage}</p>
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 rounded-xl border border-critical/30 bg-critical-soft p-4 text-xs text-foreground">
            <p className="font-semibold text-critical flex items-center gap-2">
              <AlertTriangle className="size-4" /> Service Error
            </p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLocateAndSearch()}
              className="mt-3 text-xs"
            >
              Retry Search
            </Button>
          </div>
        )}

        {status === "unsupported" && (
          <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground">
            {errorMessage}
          </div>
        )}

        {status === "empty" && (
          <div className="mt-4 rounded-xl border border-border bg-surface p-6 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="mt-2 font-medium text-foreground">No hospitals found within {radiusKm} km</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try increasing the search radius above or contact local emergency services directly.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRadiusKm(25);
                handleLocateAndSearch(25);
              }}
              className="mt-4"
            >
              Expand Search to 25 km
            </Button>
          </div>
        )}
      </div>

      {/* Hospital results list */}
      {status === "success" && hospitals.length > 0 && (
        <div className="mt-6">
          <ul className="space-y-3">
            {hospitals.map((h, i) => {
              const safeDirections = isSafeDirectionsUrl(h.directions_url)
                ? h.directions_url
                : `https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`;

              return (
                <li
                  key={h.id}
                  className={`rounded-2xl border bg-card p-5 transition-shadow ${
                    i === 0 ? "border-primary/40 shadow-soft" : "border-border"
                  }`}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {i === 0 && (
                          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                            Closest Verified
                          </span>
                        )}
                        {h.facility_type && (
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium capitalize text-secondary-foreground">
                            {h.facility_type}
                          </span>
                        )}
                        {h.emergency === "yes" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-critical-soft px-2.5 py-0.5 text-[11px] font-semibold text-critical">
                            <Stethoscope className="size-3" aria-hidden="true" />
                            Emergency Ward Verified
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-base font-semibold text-foreground truncate">
                        {h.name}
                      </p>

                      {h.address && (
                        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{h.address}</span>
                        </p>
                      )}

                      {h.operator && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Operator: {h.operator}
                        </p>
                      )}

                      {h.opening_hours && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reported hours: {h.opening_hours}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold text-primary">
                        {h.distance_km} km
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        straight-line
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                    {h.phone && (
                      <a
                        href={`tel:${h.phone.replace(/[^0-9+]/g, "")}`}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        <Phone className="size-3.5" aria-hidden="true" /> Call {h.phone}
                      </a>
                    )}
                    <a
                      href={safeDirections}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-xs font-medium text-foreground hover:bg-secondary"
                    >
                      <Navigation className="size-3.5" aria-hidden="true" /> Get Directions
                      <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>

          {disclaimer && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {disclaimer}
            </p>
          )}
        </div>
      )}

      {/* Idle / Unsearched State Explanation */}
      {status === "idle" && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
          <Compass className="mx-auto size-10 text-primary/70" aria-hidden="true" />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            Ready to search medical facilities
          </h3>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            Click <strong>&quot;Find Nearby Hospitals&quot;</strong> above to enable GPS and retrieve verified
            facilities from OpenStreetMap nearest to your location.
          </p>
        </div>
      )}

      {/* Footer navigation */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/70 pt-6">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/report">Emergency Report</Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
          <Link to="/guidance">Back to First Aid</Link>
        </Button>
      </div>
    </div>
  );
}
