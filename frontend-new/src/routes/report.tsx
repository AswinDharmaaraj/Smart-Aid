import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileText,
  Home,
  Loader2,
  Printer,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/step-progress";
import { SeverityBadge } from "@/components/severity-badge";
import { clearSession, loadSession, reportId, type Session } from "@/lib/smartaid";
import { getBackendSessionId } from "@/lib/backendSession";
import { getAdminToken } from "@/lib/adminAuth";
import { getIncidentReport, type IncidentReportResponse } from "@/lib/reportService";
import { FeedbackForm } from "@/components/feedback-form";

type ReportSearch = { sessionId?: number | undefined };

export const Route = createFileRoute("/report")({
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    sessionId:
      typeof search["sessionId"] === "number"
        ? (search["sessionId"] as number)
        : typeof search["sessionId"] === "string" && !isNaN(Number(search["sessionId"]))
          ? Number(search["sessionId"])
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Emergency Report — SmartAid AI" },
      {
        name: "description",
        content:
          "A structured emergency summary for paramedics and doctors — download it, copy it or share it in one tap.",
      },
      { property: "og:title", content: "Emergency Report — SmartAid AI" },
      {
        property: "og:description",
        content: "Hospital-ready emergency summary generated from your assessment.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [backendReport, setBackendReport] = useState<IncidentReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = getAdminToken();

    // 1. Dedicated session review by sessionId (e.g. navigated from /history)
    if (sessionId) {
      setLoading(true);
      setError(null);
      getIncidentReport(sessionId, token)
        .then((rep) => {
          setBackendReport(rep);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load the emergency report.");
          setLoading(false);
        });
      return;
    }

    // 2. Active walk-in session from localStorage
    const s = loadSession();
    if (!s?.result) {
      navigate({ to: "/assessment" });
      return;
    }
    setSession(s);

    // Opportunistically enrich from the backend report endpoint using stored session ID & token.
    const sid = getBackendSessionId();
    if (sid) {
      getIncidentReport(sid, token)
        .then(setBackendReport)
        .catch(() => {
          /* backend enrichment is best-effort for live session */
        });
    }
  }, [navigate, sessionId]);

  // Loading state (used when fetching a historical session report)
  if (loading) {
    return (
      <div className="container-flow py-14">
        <div className="mt-20 flex flex-col items-center gap-4 text-muted-foreground rise">
          <Loader2 className="size-8 animate-spin" aria-hidden="true" />
          <p className="text-sm">Loading emergency report #{sessionId}…</p>
        </div>
      </div>
    );
  }

  // Error state (e.g. 401 Unauthorized, 403 Forbidden, or 404 Not Found)
  if (error) {
    return (
      <div className="container-flow py-14">
        <div className="mt-12 flex flex-col items-center gap-4 text-center rise">
          <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-foreground">Could not load report</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <div className="mt-4 flex gap-3">
            <Button asChild variant="secondary">
              <Link to="/history">
                <ArrowLeft className="mr-2 size-4" /> Back to history
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!session?.result && !backendReport) return null;

  // Resolve values prioritizing official backend data when available.
  const id =
    backendReport?.report_id ?? (session ? reportId(session.startedAt) : `SA-SESSION-${sessionId}`);
  const startedAt = backendReport?.started_at ?? session?.startedAt ?? new Date().toISOString();
  const locationLabel = backendReport?.qr_info?.location_name ?? "Walk-in assessment";

  const localResult = session?.result ?? null;

  const rawSeverity =
    backendReport?.prediction?.severity_level ?? localResult?.severity ?? "moderate";
  const severityLevel: "Low" | "Moderate" | "Urgent" | "Critical" =
    rawSeverity.toLowerCase() === "critical"
      ? "Critical"
      : rawSeverity.toLowerCase() === "urgent"
        ? "Urgent"
        : rawSeverity.toLowerCase() === "low"
          ? "Low"
          : "Moderate";

  const emergencyLabel =
    backendReport?.prediction?.emergency_type ??
    backendReport?.guidance?.emergency_category ??
    backendReport?.symptoms?.category ??
    localResult?.emergency.label ??
    "Emergency Assessment";

  const confidenceDisplay =
    backendReport?.prediction?.confidence_score != null
      ? `${Math.round(backendReport.prediction.confidence_score * 100)}%`
      : localResult?.confidence != null
        ? `${localResult.confidence}%`
        : "N/A";

  // Build the plain-text version for copy / share / download.
  const text = [
    `SMARTAID AI — EMERGENCY REPORT`,
    `Report ID: ${id}`,
    `Generated: ${new Date(startedAt).toLocaleString()}`,
    `Location: ${locationLabel}`,
    ``,
    `Emergency type: ${emergencyLabel}`,
    `Predicted severity: ${severityLevel} (confidence ${confidenceDisplay})`,
    ...(session
      ? [
          `Age: ${session.input.age || "not provided"}`,
          `Responsive: ${session.input.conscious} | Breathing: ${session.input.breathing} | Bleeding: ${session.input.bleeding}`,
          `Duration: ${session.input.duration}`,
          `Existing conditions: ${session.input.conditions.join(", ") || "none reported"}`,
        ]
      : []),
    ``,
    `Reported description: ${
      backendReport?.symptoms?.raw_text ||
      session?.input.symptoms ||
      "Category selected without free text"
    }`,
    ...(localResult?.extractedSymptoms?.length
      ? [`Extracted symptoms: ${localResult.extractedSymptoms.join(", ")}`]
      : []),
    ...(localResult?.factors?.length
      ? [
          ``,
          `Key severity factors:`,
          ...localResult.factors.map((f) => `  - ${f.label} (+${f.weight}) — ${f.note}`),
        ]
      : []),
    ...(backendReport?.prediction?.reasoning
      ? [``, `Triage reasoning: ${backendReport.prediction.reasoning}`]
      : []),
    ``,
    `First aid administered (recommended):`,
    ...(backendReport?.guidance?.steps ?? localResult?.emergency.steps ?? []).map(
      (s, i) => `  ${i + 1}. ${s.title} — ${s.detail}`,
    ),
    ...(backendReport?.guidance?.precautions?.length
      ? [``, `Precautions:`, ...backendReport.guidance.precautions.map((p) => `  - ${p}`)]
      : []),
    ...(backendReport?.guidance?.avoid?.length
      ? [``, `Do not:`, ...backendReport.guidance.avoid.map((a) => `  - ${a}`)]
      : []),
    ``,
    backendReport?.disclaimer || `Decision support only. Not a clinical diagnosis.`,
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

  const print = () => window.print();

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator
        .share({ title: `SmartAid emergency report ${id}`, text })
        .catch(() => undefined);
    } else {
      await copy();
    }
  };

  return (
    <div className="container-flow py-10 md:py-14">
      {!sessionId ? (
        <StepProgress current={4} />
      ) : (
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to emergency history
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-8 rise">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <FileText className="size-3.5" aria-hidden="true" /> Report {id}
        </span>
        <h1 className="mt-5 text-3xl font-semibold md:text-4xl">
          {sessionId ? "Emergency incident report" : "Emergency report ready"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Hand this to the paramedic or the receiving doctor.
        </p>
      </div>

      {/* ── printable report card ───────────────────────────────────────── */}
      <article
        id="incident-report"
        className="mt-8 overflow-hidden rounded-2xl border border-border bg-card"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-5">
          <div>
            <p className="font-display font-semibold">SmartAid AI summary</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(startedAt).toLocaleString()} · {locationLabel}
            </p>
          </div>
          <SeverityBadge level={severityLevel} />
        </header>

        <dl className="grid gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2">
          <Field label="Emergency type" value={emergencyLabel} />
          <Field label="Model confidence" value={confidenceDisplay} />
          {session ? (
            <>
              <Field label="Age" value={session.input.age || "Not provided"} />
              <Field label="Responsive" value={session.input.conscious} />
              <Field label="Breathing" value={session.input.breathing} />
              <Field label="Bleeding" value={session.input.bleeding} />
              <Field
                label="Existing conditions"
                value={session.input.conditions.join(", ") || "None reported"}
              />
              <Field label="Duration" value={session.input.duration.replace("-", " ")} />
            </>
          ) : (
            <>
              <Field label="Session ID" value={`#${backendReport?.session_id ?? sessionId}`} />
              <Field label="Network mode" value={backendReport?.network_mode ?? "online"} />
              {backendReport?.qr_info?.install_site && (
                <Field label="Install site" value={backendReport.qr_info.install_site} />
              )}
              {backendReport?.symptoms?.category && (
                <Field label="Category" value={backendReport.symptoms.category} />
              )}
            </>
          )}
        </dl>

        <div className="border-t border-border px-6 py-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Reported description
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {backendReport?.symptoms?.raw_text ||
              session?.input.symptoms ||
              "Category selected without free-text description."}
          </p>
          {backendReport?.prediction?.reasoning && (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">Triage reasoning:</span>{" "}
              {backendReport.prediction.reasoning}
            </p>
          )}
        </div>

        {/* Backend-enriched guidance steps take priority; otherwise use local steps */}
        <div className="border-t border-border px-6 py-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            First aid recommended
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-foreground/85">
            {(backendReport?.guidance?.steps ?? localResult?.emergency.steps ?? []).map((s) => (
              <li key={s.title}>{s.title}</li>
            ))}
          </ol>

          {/* Precautions — shown when backend guidance is present */}
          {backendReport?.guidance?.precautions &&
            backendReport.guidance.precautions.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Precautions</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/75">
                  {backendReport.guidance.precautions.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

          {/* Avoid — shown when backend guidance is present */}
          {backendReport?.guidance?.avoid && backendReport.guidance.avoid.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Do not</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive/80">
                {backendReport.guidance.avoid.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-3 text-center text-[10px] text-muted-foreground">
          {backendReport?.disclaimer || "Decision support only — not a clinical diagnosis."}
        </div>
      </article>

      {/* ── action buttons ──────────────────────────────────────────────── */}
      <div className="no-print mt-6 grid gap-3 sm:grid-cols-4">
        <Button
          id="report-print-btn"
          size="lg"
          onClick={print}
          className="w-full justify-center"
          aria-label="Print or save report as PDF"
        >
          <Printer className="size-4" aria-hidden="true" /> Print / PDF
        </Button>
        <Button
          id="report-download-btn"
          variant="secondary"
          size="lg"
          onClick={download}
          className="w-full justify-center"
          aria-label="Download report as text file"
        >
          <Download className="size-4" aria-hidden="true" /> Download
        </Button>
        <Button
          id="report-share-btn"
          variant="secondary"
          size="lg"
          onClick={share}
          className="w-full justify-center"
          aria-label="Share report"
        >
          <Share2 className="size-4" aria-hidden="true" /> Share
        </Button>
        <Button
          id="report-copy-btn"
          variant="secondary"
          size="lg"
          onClick={copy}
          className="w-full justify-center"
          aria-label={copied ? "Report copied" : "Copy report text to clipboard"}
        >
          {copied ? (
            <Check className="size-4 text-success" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy text"}
        </Button>
      </div>

      {/* Screen-reader live region for clipboard feedback */}
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? "Report copied to clipboard." : ""}
      </p>

      {/* ── User First Aid Experience Feedback ─────────────────────────── */}
      <div className="no-print mt-8">
        <FeedbackForm
          sessionId={sessionId || backendReport?.session_id || getBackendSessionId() || null}
        />
      </div>

      {/* ── navigation ─────────────────────────────────────────────────── */}
      <div className="no-print mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/hospitals">Nearby hospitals</Link>
        </Button>
        {sessionId ? (
          <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
            <Link to="/history" className="inline-flex items-center gap-2">
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to history
            </Link>
          </Button>
        ) : (
          <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
            <Link to="/" onClick={() => clearSession()} className="inline-flex items-center gap-2">
              <Home className="size-4" aria-hidden="true" /> Finish and clear session
            </Link>
          </Button>
        )}
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
