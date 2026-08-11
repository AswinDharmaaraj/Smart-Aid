import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, FileText, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMERGENCY_TYPES } from "@/lib/smartaid";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartAid AI — QR-Based First Aid Decision Support" },
      {
        name: "description",
        content:
          "Scan a QR code and get AI-assessed emergency severity, personalised first aid steps, explainable recommendations and a shareable emergency report.",
      },
      { property: "og:title", content: "SmartAid AI — QR-Based First Aid Decision Support" },
      {
        property: "og:description",
        content: "Scan a QR code and get AI-assessed emergency severity, personalised first aid steps, explainable recommendations and a shareable emergency report.",
      },
    ],
  }),
  component: Home,
});

const HIGHLIGHTS = [
  { icon: Brain, title: "AI severity prediction", body: "Grades the emergency as Low, Moderate, Urgent or Critical." },
  { icon: Sparkles, title: "Describe it your way", body: "NLP reads plain-language descriptions, not forms." },
  { icon: ShieldCheck, title: "Explainable results", body: "Every result shows which factors drove it." },
  { icon: FileText, title: "Hospital-ready report", body: "One tap to download or share with paramedics." },
];

function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_50%,var(--color-primary-soft),transparent_70%)]"
        />
        <div className="container-page relative py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Emergency response · fast triage
            </span>
            <h1 className="mt-6 text-5xl font-semibold leading-tight text-foreground md:text-6xl">
              Calm first aid guidance in the first 60 seconds
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
              The AI predicts severity, explains why, and prepares a hospital-ready report while you keep the
              patient safe.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/assessment">
                  Start assessment <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Link
                to="/scan"
                className="inline-flex h-11 items-center gap-2 px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ScanLine className="size-4" aria-hidden="true" /> or scan a QR code
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              If this is life-threatening, call your local emergency number first.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-10" aria-labelledby="quick-start">
        <h2 id="quick-start" className="sr-only">
          Quick emergency shortcuts
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EMERGENCY_TYPES.slice(0, 4).map((e) => (
            <Link
              key={e.id}
              to="/symptoms"
              search={{ type: e.id }}
              className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <p className="font-medium">{e.label}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{e.hint}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-primary">
                Start <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface py-16" aria-labelledby="how">
        <div className="container-page">
          <h2 id="how" className="max-w-2xl text-2xl font-semibold md:text-3xl">
            Built for the worst moment of someone&rsquo;s day
          </h2>
          <ul className="mt-8 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium leading-6">{f.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
