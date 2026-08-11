import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, MapPin, Navigation, Phone, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOSPITALS, loadSession, type Session } from "@/lib/smartaid";

export const Route = createFileRoute("/hospitals")({
  head: () => ({
    meta: [
      { title: "Hospital Recommendation — SmartAid AI" },
      { name: "description", content: "Nearby hospitals and emergency centres ranked by travel time and the capabilities your emergency needs." },
      { property: "og:title", content: "Hospital Recommendation — SmartAid AI" },
      { property: "og:description", content: "Find the right emergency facility, not just the closest one." },
    ],
  }),
  component: HospitalsPage,
});

function HospitalsPage() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => setSession(loadSession()), []);

  const severity = session?.result?.severity;
  const list = severity === "Critical" || severity === "Urgent" ? HOSPITALS.filter((h) => h.open24) : HOSPITALS;
  const ranked = [...list].sort((a, b) => a.etaMin - b.etaMin);

  return (
    <div className="container-flow py-10 md:py-14">
      <div className="rise">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" /> Block C · Main corridor
        </span>
        <h1 className="mt-5 text-3xl font-semibold md:text-4xl">Where to go</h1>
        <p className="mt-2 text-muted-foreground">
          {severity
            ? `Filtered for a ${severity.toLowerCase()} ${session?.result?.emergency.label.toLowerCase()} and sorted by arrival time.`
            : "Sorted by arrival time from your current location."}
        </p>
      </div>

      <ul className="mt-8 space-y-3">
        {ranked.map((h, i) => (
          <li
            key={h.name}
            className={`rounded-2xl border bg-card p-5 ${i === 0 ? "border-primary/40 shadow-soft" : "border-border"}`}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                {i === 0 ? (
                  <span className="mb-2 inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Recommended
                  </span>
                ) : null}
                <p className="truncate font-medium">{h.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{h.type}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {h.capability.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                      <Stethoscope className="size-3" aria-hidden="true" /> {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="flex items-center justify-end gap-1.5 text-sm font-semibold">
                  <Clock className="size-3.5 text-primary" aria-hidden="true" /> {h.etaMin} min
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{h.distanceKm} km</p>
                <p className={`mt-1 text-xs ${h.open24 ? "text-low" : "text-muted-foreground"}`}>{h.open24 ? "Open 24/7" : "Daytime only"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`tel:${h.phone.replace(/\s/g, "")}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Phone className="size-4" aria-hidden="true" /> Call
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary"
              >
                <Navigation className="size-4" aria-hidden="true" /> Directions
              </a>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/report">Emergency report</Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
          <Link to="/guidance">Back to first aid</Link>
        </Button>
      </div>
    </div>
  );
}
