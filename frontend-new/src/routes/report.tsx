import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Download, FileText, Home, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/step-progress";
import { SeverityBadge } from "@/components/severity-badge";
import { clearSession, loadSession, reportId, type Session } from "@/lib/smartaid";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Emergency Report — SmartAid AI" },
      { name: "description", content: "A structured emergency summary for paramedics and doctors — download it, copy it or share it in one tap." },
      { property: "og:title", content: "Emergency Report — SmartAid AI" },
      { property: "og:description", content: "Hospital-ready emergency summary generated from your assessment." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s?.result) {
      navigate({ to: "/assessment" });
      return;
    }
    setSession(s);
  }, [navigate]);

  if (!session?.result) return null;
  const { result, input, startedAt } = session;
  const id = reportId(startedAt);

  const text = [
    `SMARTAID AI — EMERGENCY REPORT`,
    `Report ID: ${id}`,
    `Generated: ${new Date(startedAt).toLocaleString()}`,
    `Location: Block C, Main corridor (QR SA-BLK-12)`,
    ``,
    `Emergency type: ${result.emergency.label}`,
    `Predicted severity: ${result.severity} (confidence ${result.confidence}%)`,
    `Age: ${input.age || "not provided"}`,
    `Responsive: ${input.conscious} | Breathing: ${input.breathing} | Bleeding: ${input.bleeding}`,
    `Duration: ${input.duration}`,
    `Existing conditions: ${input.conditions.join(", ") || "none reported"}`,
    ``,
    `Reported description: ${input.symptoms || "category selected without free text"}`,
    `Extracted symptoms: ${result.extractedSymptoms.join(", ") || "none"}`,
    ``,
    `Key severity factors:`,
    ...result.factors.map((f) => `  - ${f.label} (+${f.weight}) — ${f.note}`),
    ``,
    `First aid administered (recommended):`,
    ...result.emergency.steps.map((s, i) => `  ${i + 1}. ${s.title} — ${s.detail}`),
    ``,
    `Decision support only. Not a clinical diagnosis.`,
  ].join("\n");

  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-smartaid-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: `SmartAid emergency report ${id}`, text }).catch(() => undefined);
    } else {
      await copy();
    }
  };

  return (
    <div className="container-flow py-10 md:py-14">
      <StepProgress current={4} />

      <div className="mt-8 rise">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <FileText className="size-3.5" aria-hidden="true" /> Report {id}
        </span>
        <h1 className="mt-5 text-3xl font-semibold md:text-4xl">Emergency report ready</h1>
        <p className="mt-2 text-muted-foreground">Hand this to the paramedic or the receiving doctor.</p>
      </div>

      <article className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-5">
          <div>
            <p className="font-display font-semibold">SmartAid AI summary</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(startedAt).toLocaleString()} · Block C, Main corridor</p>
          </div>
          <SeverityBadge level={result.severity} />
        </header>
        <dl className="grid gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2">
          <Field label="Emergency type" value={result.emergency.label} />
          <Field label="Model confidence" value={`${result.confidence}%`} />
          <Field label="Age" value={input.age || "Not provided"} />
          <Field label="Responsive" value={input.conscious} />
          <Field label="Breathing" value={input.breathing} />
          <Field label="Bleeding" value={input.bleeding} />
          <Field label="Existing conditions" value={input.conditions.join(", ") || "None reported"} />
          <Field label="Duration" value={input.duration.replace("-", " ")} />
        </dl>
        <div className="border-t border-border px-6 py-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reported description</p>
          <p className="mt-2 text-sm leading-relaxed">{input.symptoms || "Category selected without free-text description."}</p>
        </div>
        <div className="border-t border-border px-6 py-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">First aid recommended</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-foreground/85">
            {result.emergency.steps.map((s) => (
              <li key={s.title}>{s.title}</li>
            ))}
          </ol>
        </div>
      </article>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Button size="lg" onClick={download} className="w-full justify-center">
          <Download className="size-4" aria-hidden="true" /> Download
        </Button>
        <Button variant="secondary" size="lg" onClick={share} className="w-full justify-center">
          <Share2 className="size-4" aria-hidden="true" /> Share
        </Button>
        <Button variant="secondary" size="lg" onClick={copy} className="w-full justify-center">
          {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy text"}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? "Report copied to clipboard." : ""}
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/hospitals">Nearby hospitals</Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
          <Link
            to="/"
            onClick={() => clearSession()}
            className="inline-flex items-center gap-2"
          >
            <Home className="size-4" aria-hidden="true" /> Finish and clear session
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium capitalize">{value}</dd>
    </div>
  );
}
