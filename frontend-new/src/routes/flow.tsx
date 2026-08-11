import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/flow")({
  head: () => ({
    meta: [
      { title: "Sitemap & User Flow — SmartAid AI" },
      { name: "description", content: "Every page in SmartAid AI and the exact path a user takes from scanning a QR code to sharing an emergency report." },
      { property: "og:title", content: "Sitemap & User Flow — SmartAid AI" },
      { property: "og:description", content: "The full page map and emergency journey behind SmartAid AI." },
    ],
  }),
  component: FlowPage,
});

const SITEMAP = [
  {
    group: "Emergency journey",
    pages: [
      { to: "/scan", label: "QR scan entry", note: "Simulated scan, location detection, jump to assessment" },
      { to: "/assessment", label: "Emergency type", note: "Choose burn, choking, bleeding, fracture, snake bite, cardiac, shock" },
      { to: "/symptoms", label: "Symptom input", note: "Natural language description plus rapid checks" },
      { to: "/processing", label: "AI processing", note: "NLP extraction and ML severity classification" },
      { to: "/result", label: "Severity result", note: "Level, confidence and extracted symptoms" },
      { to: "/guidance", label: "First aid guidance", note: "Step-by-step actions with voice readout" },
      { to: "/explain", label: "Explainable AI", note: "Factor weights behind the prediction" },
      { to: "/hospitals", label: "Hospital recommendation", note: "Ranked by capability and ETA" },
      { to: "/report", label: "Emergency report", note: "Download, copy or share the summary" },
    ],
  },
  {
    group: "Support & documentation",
    pages: [
      { to: "/", label: "Home", note: "Overview, features and entry points" },
      { to: "/offline", label: "Offline guide", note: "Cached first aid, works without a network" },
      { to: "/about", label: "About the project", note: "Objectives, architecture, technology stack" },
      { to: "/faq", label: "Help & FAQ", note: "Common questions and safety guidance" },
      { to: "/design-system", label: "Design system", note: "Colour tokens, severity scale, typography" },
    ],
  },
] as const;

const FLOW = [
  { title: "Scan", detail: "User scans the SmartAid QR code on a wall, bus or machine. The portal opens in the browser — no install, no login." },
  { title: "Select emergency", detail: "The user picks the emergency category, or describes it and lets the system match one." },
  { title: "Describe symptoms", detail: "Free-text description plus rapid checks: responsive, breathing, bleeding, age, duration, existing conditions." },
  { title: "AI processing", detail: "NLP extracts symptom entities; the ML classifier scores risk and outputs a severity level with confidence." },
  { title: "Severity result", detail: "Low, Moderate, Urgent or Critical, with the symptoms the model actually saw." },
  { title: "First aid guidance", detail: "Personalised ordered steps, precautions and what to avoid, readable aloud hands-free." },
  { title: "Explanation", detail: "Explainable AI lists each factor and how much it pushed the risk score up." },
  { title: "Hospital & report", detail: "Nearest capable hospital by ETA, and a structured report to hand to paramedics." },
] as const;

function FlowPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl rise">
        <h1 className="text-3xl font-semibold md:text-4xl">Sitemap &amp; user flow</h1>
        <p className="mt-3 text-muted-foreground">
          The complete page map, and the eight-stage journey from a QR scan to a hospital-ready report.
        </p>
      </div>

      <section className="mt-12" aria-labelledby="flow">
        <h2 id="flow" className="text-2xl font-semibold">User flow</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-border bg-card p-5">
              <span className="font-display text-xs font-semibold text-primary">STEP {String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 font-medium">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="sitemap">
        <h2 id="sitemap" className="text-2xl font-semibold">Sitemap</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {SITEMAP.map((g) => (
            <div key={g.group} className="overflow-hidden rounded-2xl border border-border bg-card">
              <p className="border-b border-border bg-surface px-5 py-3 text-sm font-medium">{g.group}</p>
              <ul className="divide-y divide-border">
                {g.pages.map((p) => (
                  <li key={p.to}>
                    <Link to={p.to} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/60">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.label}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">{p.note}</span>
                        <code className="mt-1 block text-xs text-primary">{p.to}</code>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
