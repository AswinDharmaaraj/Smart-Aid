import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Brain } from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";
import { loadSession, type Session } from "@/lib/smartaid";

export const Route = createFileRoute("/explain")({
  head: () => ({
    meta: [
      { title: "Explainable AI Recommendation — SmartAid AI" },
      { name: "description", content: "See exactly which factors drove the severity prediction and how much each one contributed." },
      { property: "og:title", content: "Explainable AI Recommendation — SmartAid AI" },
      { property: "og:description", content: "Transparent, factor-by-factor reasoning behind every SmartAid recommendation." },
    ],
  }),
  component: ExplainPage,
});

function ExplainPage() {
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
  const max = Math.max(...result.factors.map((f) => f.weight), 1);

  return (
    <div className="container-flow py-10 md:py-14">
      <div className="rise">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Brain className="size-3.5" aria-hidden="true" /> Explainable AI
        </span>
        <h1 className="mt-5 text-3xl font-semibold md:text-4xl">Why SmartAid said this</h1>
        <p className="mt-2 text-muted-foreground">
          The model graded this as <SeverityBadge level={result.severity} className="align-middle" /> with{" "}
          {result.confidence}% confidence. These are the factors it weighed, largest first.
        </p>
      </div>

      <ul className="mt-8 space-y-3">
        {result.factors.map((f) => (
          <li key={f.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{f.label}</p>
              <p className="text-sm text-muted-foreground">{f.weight === 0 ? "no effect" : `+${f.weight} risk points`}</p>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Contribution ${f.weight} of ${max}`}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(3, (f.weight / max) * 100)}%` }} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.note}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="size-4 text-primary" aria-hidden="true" /> Guidance sources
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          First aid content follows the American Heart Association CPR &amp; ECC guidelines, WHO emergency care
          framework and IFRC international first aid guidelines. The severity model is trained on publicly available
          and synthetic triage data and never replaces clinical judgement.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <Link to="/report" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Generate emergency report <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link to="/guidance" className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium hover:bg-secondary">
          Back to first aid
        </Link>
      </div>
    </div>
  );
}
