import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Info, Phone, RotateCcw } from "lucide-react";
import { StepProgress } from "@/components/step-progress";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/severity-badge";
import { SEVERITY_META, SEVERITY_ORDER, loadSession, type Session } from "@/lib/smartaid";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "Emergency Severity Result — SmartAid AI" },
      { name: "description", content: "Your AI-predicted emergency severity band with the recommended next action and confidence score." },
      { property: "og:title", content: "Emergency Severity Result — SmartAid AI" },
      { property: "og:description", content: "AI severity prediction: Low, Moderate, Urgent or Critical." },
    ],
  }),
  component: ResultPage,
});

function ResultPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s?.result) {
      navigate({ to: "/assessment" });
      return;
    }
    setSession(s);
  }, [navigate]);

  if (!session?.result) return null;
  const { result } = session;
  const meta = SEVERITY_META[result.severity];
  const critical = result.severity === "Critical" || result.severity === "Urgent";

  return (
    <div className="container-flow py-10 md:py-14">
      <StepProgress current={2} />

      <section className="mt-8 rounded-2xl border border-border bg-card px-6 py-7 shadow-sm rise">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <SeverityBadge level={result.severity} className="self-start" />
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{result.emergency.label}</h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">{meta.action}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold text-muted-foreground">Model confidence</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{result.confidence}%</p>
            </div>
            {critical ? (
              <Button asChild size="lg" className="bg-critical text-critical-foreground hover:bg-critical/90">
                <a href="tel:112">
                  <Phone className="size-4" aria-hidden="true" /> Call emergency services now
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Severity scale</p>
            <p className="text-sm text-muted-foreground">Use this to compare status across emergency types.</p>
          </div>
          <ol className="mt-4 grid grid-cols-4 gap-3">
            {SEVERITY_ORDER.map((level) => {
              const active = level === result.severity;
              const token = SEVERITY_META[level].token;
              return (
                <li key={level} className="text-center">
                  <span
                    className="block h-3 rounded-full"
                    style={{ backgroundColor: active ? `var(--${token})` : "var(--border)" }}
                  />
                  <span className={`mt-3 block text-sm ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{level}</span>
                </li>
              );
            })}
          </ol>
          {result.extractedSymptoms.length ? (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-medium text-muted-foreground">Symptoms extracted</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.extractedSymptoms.map((s) => (
                  <span key={s} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold text-foreground">Decision support only</p>
              <p className="mt-2 leading-7">
                This tool helps you respond quickly, but it is not a medical diagnosis. If the situation worsens, call for professional help.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr]">
        <Button asChild size="lg">
          <Link to="/guidance">Show first aid steps</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to="/explain">Why this result?</Link>
        </Button>
      </section>

      <div className="mt-3 text-sm text-muted-foreground">
        <Link to="/symptoms" className="font-medium text-primary underline-offset-4 hover:underline">
          Edit answers
        </Link>
      </div>
    </div>
  );
}
