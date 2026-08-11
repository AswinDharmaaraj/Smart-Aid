import { createFileRoute } from "@tanstack/react-router";
import { SeverityBadge } from "@/components/severity-badge";
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/smartaid";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: "Design System — SmartAid AI" },
      { name: "description", content: "The colour tokens, severity scale, typography and component rules that keep SmartAid AI calm and legible under stress." },
      { property: "og:title", content: "Design System — SmartAid AI" },
      { property: "og:description", content: "Colour, type and severity language behind the SmartAid AI interface." },
    ],
  }),
  component: DesignSystemPage,
});

const CORE = [
  { name: "background", cls: "bg-background" },
  { name: "surface", cls: "bg-surface" },
  { name: "card", cls: "bg-card" },
  { name: "primary", cls: "bg-primary" },
  { name: "primary-soft", cls: "bg-primary-soft" },
  { name: "secondary", cls: "bg-secondary" },
  { name: "muted", cls: "bg-muted" },
  { name: "border", cls: "bg-border" },
];

const SEV = [
  { name: "low", cls: "bg-low", soft: "bg-low-soft" },
  { name: "moderate", cls: "bg-moderate", soft: "bg-moderate-soft" },
  { name: "urgent", cls: "bg-urgent", soft: "bg-urgent-soft" },
  { name: "critical", cls: "bg-critical", soft: "bg-critical-soft" },
];

function DesignSystemPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl rise">
        <h1 className="text-3xl font-semibold md:text-4xl">Design system</h1>
        <p className="mt-3 text-muted-foreground">
          Built for panicked hands and bright daylight: high contrast, one action per screen, colour reserved for
          severity so it never becomes decoration.
        </p>
      </div>

      <section className="mt-12" aria-labelledby="palette">
        <h2 id="palette" className="text-2xl font-semibold">Core palette</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CORE.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-2xl border border-border">
              <div className={`h-20 ${c.cls}`} />
              <p className="bg-card px-4 py-3 font-mono text-xs">{c.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="severity">
        <h2 id="severity" className="text-2xl font-semibold">Severity scale</h2>
        <p className="mt-2 text-muted-foreground">Four levels, each with a solid tone for badges and a soft tone for panels.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEV.map((s, i) => {
            const level = SEVERITY_ORDER[i]!;
            return (
              <div key={s.name} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex">
                  <div className={`h-20 flex-1 ${s.cls}`} />
                  <div className={`h-20 w-1/3 ${s.soft}`} />
                </div>
                <div className="px-4 py-4">
                  <SeverityBadge level={level} />
                  <p className="mt-3 text-sm text-muted-foreground">{SEVERITY_META[level].action}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="type">
        <h2 id="type" className="text-2xl font-semibold">Typography</h2>
        <div className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Display · headings</p>
            <p className="font-display text-4xl font-semibold">Stay calm. Follow the steps.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Body · instructions</p>
            <p className="max-w-xl leading-relaxed">
              Cool the burn under running water for twenty minutes. Remove rings and tight clothing near the area before
              swelling begins.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta · labels and codes</p>
            <p className="font-mono text-sm text-muted-foreground">SA-BLK-12 · confidence 87% · Urgent</p>
          </div>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="rules">
        <h2 id="rules" className="text-2xl font-semibold">Interface rules</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            "One primary action per screen — the emergency path is never ambiguous.",
            "Tap targets are at least 44px so they work with shaking hands.",
            "Colour never carries meaning alone; every severity has a label and an action line.",
            "Steps are numbered and ordered — no scanning required to find what to do next.",
            "Voice readout on guidance so hands stay free for the patient.",
            "Every AI output is paired with an explanation of why.",
          ].map((r) => (
            <li key={r} className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
