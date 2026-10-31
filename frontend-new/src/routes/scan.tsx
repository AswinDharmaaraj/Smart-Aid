import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, QrCode, ScanLine, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIRECT_START_QR_CODE_ID } from "@/lib/qrService";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "QR Scan Entry — SmartAid AI" },
      { name: "description", content: "Scan the SmartAid QR code placed in your building to open the emergency portal instantly — no app install required." },
      { property: "og:title", content: "QR Scan Entry — SmartAid AI" },
      { property: "og:description", content: "Open the SmartAid emergency portal by scanning a QR code." },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  return (
    <div className="container-flow py-14 md:py-20">
      <div className="text-center rise">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <QrCode className="size-3.5" aria-hidden="true" /> Entry point
        </span>
        <h1 className="mt-5 text-3xl font-semibold md:text-4xl">Scan to open the emergency portal</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Point any phone camera at the SmartAid code on the wall, first-aid box or vehicle. The portal opens in the
          browser — nothing to install, no account needed.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8">
          <div className="relative grid size-44 place-items-center rounded-2xl bg-surface">
            <QrCodeArt />
            <span className="pointer-events-none absolute inset-4 rounded-xl border-2 border-primary/40" aria-hidden="true" />
          </div>
          <p className="mt-5 text-center text-sm text-muted-foreground">Demo code · Location ID SA-BLK-12</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="flex items-center gap-2 font-medium">
              <MapPin className="size-4 text-primary" aria-hidden="true" /> Detected location
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Block C · Main corridor, ground floor. Shared with responders in your emergency report.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to={`/session/${DIRECT_START_QR_CODE_ID}`} className="flex w-full items-center justify-between gap-4 rounded-2xl px-6 text-primary-foreground">
              <span>
                <span className="flex items-center gap-2 font-semibold">
                  <ScanLine className="size-4" aria-hidden="true" /> Continue without scanning
                </span>
                <span className="mt-1 block text-sm opacity-90">Skip straight to the emergency assessment.</span>
              </span>
              <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <WifiOff className="size-4" aria-hidden="true" /> No network at this location?
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The essential procedures are cached on this device and stay readable without a connection.
        </p>
        <Link to="/offline" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
          Open the offline guide <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function QrCodeArt() {
  const cells = Array.from({ length: 121 }, (_, i) => {
    const r = Math.floor(i / 11);
    const c = i % 11;
    const corner = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
    const on = corner || (r * 7 + c * 5) % 3 === 0;
    return { i, on };
  });
  return (
    <div className="grid grid-cols-11 gap-[3px]" role="img" aria-label="SmartAid demo QR code">
      {cells.map(({ i, on }) => (
        <span key={i} className={`size-2.5 rounded-[2px] ${on ? "bg-foreground" : "bg-transparent"}`} />
      ))}
    </div>
  );
}
