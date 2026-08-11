import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, WifiOff } from "lucide-react";
import { EMERGENCY_TYPES } from "@/lib/smartaid";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "Offline Emergency Guide — SmartAid AI" },
      { name: "description", content: "Essential first aid procedures cached on your device so they stay available during network failures and disasters." },
      { property: "og:title", content: "Offline Emergency Guide — SmartAid AI" },
      { property: "og:description", content: "First aid that still works without a connection." },
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  const [online, setOnline] = useState(true);
  const [open, setOpen] = useState<string | null>(EMERGENCY_TYPES[0]!.id);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className="container-flow py-10 md:py-14">
      <div className="rise">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            online ? "border-low/30 bg-low-soft text-low" : "border-moderate/30 bg-moderate-soft text-moderate"
          }`}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {online ? "Online · guide cached for later" : "Offline · showing cached guide"}
        </span>
        <h1 className="mt-5 text-3xl font-semibold md:text-4xl">Offline emergency guide</h1>
        <p className="mt-2 text-muted-foreground">
          These procedures are stored on this device. They work with no signal — useful during disasters, in basements
          or on rural roads.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary"
        >
          <Download className="size-4" aria-hidden="true" /> Save or print this guide
        </button>
        <Link to="/assessment" className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Use the AI assessment
        </Link>
      </div>

      <div className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {EMERGENCY_TYPES.map((e) => {
          const expanded = open === e.id;
          return (
            <div key={e.id}>
              <h2>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : e.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{e.label}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">{e.hint}</span>
                  </span>
                  <span className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-45" : ""}`} aria-hidden="true">
                    +
                  </span>
                </button>
              </h2>
              {expanded ? (
                <div className="border-t border-border bg-surface/60 px-5 py-5">
                  <ol className="space-y-3">
                    {e.steps.map((s, i) => (
                      <li key={s.title} className="flex gap-3 text-sm">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{i + 1}</span>
                        <span>
                          <span className="block font-medium">{s.title}</span>
                          <span className="mt-0.5 block leading-relaxed text-muted-foreground">{s.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    {e.avoid.map((a) => (
                      <p key={a} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
                        {a}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
        <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>Severity prediction, hospital recommendations and report sharing need a connection. Everything above does not.</p>
      </div>
    </div>
  );
}
