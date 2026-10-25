import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  HeartHandshake,
  HelpCircle,
  Info,
  Phone,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/severity-badge";
import {
  EMERGENCY_TYPES,
  SEVERITY_META,
  SEVERITY_ORDER,
  clearSession,
  loadSession,
  type EmergencyType,
  type Session,
  type SeverityLevel,
} from "@/lib/smartaid";
import { clearBackendSessionId, getBackendSessionId } from "@/lib/backendSession";
import { fetchGuidance, type FirstAidGuideResponse } from "@/lib/guidanceService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "Emergency Severity Assessment — SmartAid AI" },
      {
        name: "description",
        content:
          "AI-powered emergency triage severity result with XGBoost risk classification, priority action steps, and hospital-ready guidance.",
      },
      { property: "og:title", content: "Emergency Severity Assessment — SmartAid AI" },
      {
        property: "og:description",
        content:
          "Emergency severity classification: Low, Moderate, Urgent or Critical with verified immediate first-aid protocols.",
      },
    ],
  }),
  component: ResultPage,
});

/* ── Severity Theme Configuration ────────────────────────────────────────── */
interface SeverityThemeConfig {
  label: string;
  badgeLabel: string;
  tagline: string;
  cardBg: string;
  cardBorder: string;
  glowColor: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  barColor: string;
  icon: React.ComponentType<{ className?: string }>;
  actionHeading: string;
  actionGuidance: string;
  escalationWarning: string | null;
}

const SEVERITY_THEMES: Record<SeverityLevel, SeverityThemeConfig> = {
  Critical: {
    label: "Critical Priority",
    badgeLabel: "Critical Triage Level",
    tagline: "Life-threatening emergency. Immediate professional intervention is required.",
    cardBg: "from-rose-500/12 via-red-500/6 to-card",
    cardBorder: "border-critical/40",
    glowColor: "rgba(217, 4, 41, 0.2)",
    textColor: "text-critical",
    badgeBg: "bg-critical-soft text-critical border-critical/30",
    badgeBorder: "border-critical/40",
    badgeText: "text-critical",
    barColor: "bg-critical",
    icon: ShieldAlert,
    actionHeading: "Call Emergency Services (112) Immediately",
    actionGuidance: "Do not move the patient unnecessarily. Begin life-support first aid while help is dispatched.",
    escalationWarning:
      "CRITICAL SAFETY WARNING: High risk of rapid collapse or clinical deterioration. Keep the line open with emergency dispatchers.",
  },
  Urgent: {
    label: "Urgent Priority",
    badgeLabel: "Urgent Triage Level",
    tagline: "High-risk clinical condition. Prompt emergency or hospital care is necessary.",
    cardBg: "from-amber-500/12 via-orange-500/6 to-card",
    cardBorder: "border-urgent/40",
    glowColor: "rgba(247, 127, 0, 0.18)",
    textColor: "text-urgent",
    badgeBg: "bg-urgent-soft text-urgent border-urgent/30",
    badgeBorder: "border-urgent/40",
    badgeText: "text-urgent",
    barColor: "bg-urgent",
    icon: AlertTriangle,
    actionHeading: "Seek Immediate Hospital or Emergency Facility Care",
    actionGuidance: "Administer prompt first-aid stabilization and transport the patient to the nearest emergency department.",
    escalationWarning:
      "URGENT CLINICAL WARNING: Symptoms may worsen quickly. Have someone stay with the person and monitor vitals closely.",
  },
  Moderate: {
    label: "Moderate Severity",
    badgeLabel: "Moderate Triage Level",
    tagline: "Noticeable medical risk. Clinical evaluation is recommended today.",
    cardBg: "from-amber-400/12 via-yellow-400/5 to-card",
    cardBorder: "border-moderate/40",
    glowColor: "rgba(249, 199, 79, 0.16)",
    textColor: "text-moderate",
    badgeBg: "bg-moderate-soft text-moderate border-moderate/30",
    badgeBorder: "border-moderate/40",
    badgeText: "text-moderate",
    barColor: "bg-moderate",
    icon: AlertCircle,
    actionHeading: "Apply First Aid & Arrange Clinical Review",
    actionGuidance: "Follow structured first-aid guidance. If pain intensifies or red-flag signs emerge, seek urgent medical care.",
    escalationWarning: null,
  },
  Low: {
    label: "Low Severity",
    badgeLabel: "Low Triage Level",
    tagline: "Self-limiting condition or minor injury. Self-care first aid is appropriate.",
    cardBg: "from-emerald-500/12 via-teal-500/5 to-card",
    cardBorder: "border-low/40",
    glowColor: "rgba(42, 157, 112, 0.15)",
    textColor: "text-low",
    badgeBg: "bg-low-soft text-low border-low/30",
    badgeBorder: "border-low/40",
    badgeText: "text-low",
    barColor: "bg-low",
    icon: CheckCircle2,
    actionHeading: "Follow Standard First-Aid Self Care",
    actionGuidance: "Manage symptoms with local first-aid measures. Observe closely over the next 24 hours.",
    escalationWarning: null,
  },
};

const SEVERITY_DESCRIPTIONS: Record<SeverityLevel, { definition: string; criteria: string }> = {
  Low: {
    definition: "Minor injury or superficial symptoms with stable vitals.",
    criteria: "Self-care first aid, dressing, rest, and home monitoring.",
  },
  Moderate: {
    definition: "Non-critical condition requiring medical evaluation.",
    criteria: "Outpatient clinic or doctor review recommended today.",
  },
  Urgent: {
    definition: "Acute symptoms with potential for rapid deterioration.",
    criteria: "Prompt emergency room or urgent care center evaluation.",
  },
  Critical: {
    definition: "Life-threatening condition with airway, breathing, or shock risk.",
    criteria: "Immediate 112 emergency services dispatch and bystander CPR/life support.",
  },
};

const ASSESSMENT_STEPS = [
  { label: "Emergency", path: "/assessment", stepNum: 1 },
  { label: "Symptoms", path: "/symptoms", stepNum: 2 },
  { label: "Severity", path: "/result", stepNum: 3 },
  { label: "First Aid", path: "/guidance", stepNum: 4 },
  { label: "Report", path: "/report", stepNum: 5 },
] as const;

function ResultPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [backendGuide, setBackendGuide] = useState<FirstAidGuideResponse | null>(null);
  const [loadingGuide, setLoadingGuide] = useState<boolean>(true);

  useEffect(() => {
    const s = loadSession();
    if (!s?.result) {
      navigate({ to: "/assessment" });
      return;
    }
    setSession(s);

    // Fetch personalized backend guidance if a backend session exists
    const backendSessionId = getBackendSessionId();
    if (backendSessionId) {
      fetchGuidance(backendSessionId)
        .then((guide) => {
          setBackendGuide(guide);
          setLoadingGuide(false);
        })
        .catch(() => {
          setLoadingGuide(false);
        });
    } else {
      setLoadingGuide(false);
    }
  }, [navigate]);

  if (!session?.result) return null;

  const { result, input } = session;
  const theme = SEVERITY_THEMES[result.severity] || SEVERITY_THEMES.Moderate;
  const SeverityIcon = theme.icon;

  const isCriticalOrUrgent = result.severity === "Critical" || result.severity === "Urgent";
  const reasoningText = result.reasoning || result.factors?.[0]?.note || "";

  // Detect whether safety net override was triggered
  const isSafetyOverride = Boolean(
    result.isOverride ||
      reasoningText.toUpperCase().includes("OVERRIDE") ||
      input.conscious === "no" ||
      input.breathing === "none" ||
      input.bleeding === "severe"
  );
  const requiresEmergencyEscalation = isCriticalOrUrgent || isSafetyOverride;

  // Combine actions from backend guide or fallback emergency type
  const guidanceSteps =
    backendGuide?.steps && backendGuide.steps.length > 0
      ? backendGuide.steps.slice(0, 4)
      : result.emergency.steps.slice(0, 4);

  const precautions =
    backendGuide?.precautions && backendGuide.precautions.length > 0
      ? backendGuide.precautions.slice(0, 2)
      : result.emergency.precautions.slice(0, 2);

  const avoidItems =
    backendGuide?.avoid && backendGuide.avoid.length > 0
      ? backendGuide.avoid.slice(0, 2)
      : result.emergency.avoid.slice(0, 2);

  return (
    <div
      className="container-page py-6 md:py-10"
      data-severity={result.severity.toLowerCase()}
    >
      {/* ── 1. Breadcrumb & Assessment Progress Flow ──────────────────────── */}
      <nav aria-label="Emergency Assessment Progress" className="w-full">
        <div className="rounded-2xl border border-border/80 bg-card/80 p-3.5 shadow-sm backdrop-blur md:p-4">
          <ol className="flex items-center justify-between gap-1 md:gap-2">
            {ASSESSMENT_STEPS.map((step, idx) => {
              const isCompleted = idx < 2; // Steps 1 and 2 completed
              const isCurrent = idx === 2; // Step 3 is current (Severity Result)

              return (
                <li
                  key={step.label}
                  className="flex flex-1 items-center gap-1.5 md:gap-3"
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-all md:size-6 md:text-xs",
                          isCompleted
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : isCurrent
                              ? cn(theme.barColor, "text-white shadow-xs ring-2 ring-primary/30 ring-offset-1")
                              : "bg-secondary text-muted-foreground"
                        )}
                        aria-hidden="true"
                      >
                        {isCompleted ? (
                          <Check className="size-3 md:size-3.5" />
                        ) : (
                          step.stepNum
                        )}
                      </span>
                      <span
                        className={cn(
                          "truncate text-xs md:text-sm",
                          isCurrent
                            ? "font-semibold text-foreground"
                            : isCompleted
                              ? "font-medium text-foreground hover:text-primary"
                              : "text-muted-foreground"
                        )}
                      >
                        {isCompleted ? (
                          <Link to={step.path} className="hover:underline">
                            {step.label}
                          </Link>
                        ) : (
                          step.label
                        )}
                      </span>
                    </div>
                    {/* Visual Progress Bar Segment */}
                    <div
                      className={cn(
                        "h-1.5 w-full rounded-full transition-colors",
                        isCompleted
                          ? "bg-primary"
                          : isCurrent
                            ? cn(theme.barColor)
                            : "bg-border/60"
                      )}
                    />
                  </div>
                  {idx < ASSESSMENT_STEPS.length - 1 && (
                    <span
                      className="hidden text-muted-foreground/40 sm:inline-block"
                      aria-hidden="true"
                    >
                      /
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      {/* ── 2. Safety Net Rule Override Banner (When Triggered) ──────────── */}
      {isSafetyOverride && (
        <section
          aria-label="Clinical Safety Override Notice"
          className="mt-6 rounded-2xl border-2 border-critical/50 bg-critical-soft/80 p-4 shadow-sm md:p-5"
        >
          <div className="flex items-start gap-3.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-critical text-critical-foreground shadow-xs">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-critical px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-critical-foreground">
                  Clinical Safety Override
                </span>
                <span className="text-xs font-medium text-critical">
                  Protocol: Immediate Life-Threat Risk Escalation
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                Automatic Emergency Safety Protection Triggered
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground md:text-sm">
                Severe red-flag signals (e.g. absent breathing, unconsciousness, or severe bleeding)
                were detected. To protect patient life, the safety net automatically escalated the
                triage status to ensure immediate life support and ambulance dispatch.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Main Dashboard Layout (Two Columns on Desktop) ─────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* ── Left Column (Main Emergency Result & Evidence) ─────────────── */}
        <div className="space-y-6 lg:col-span-7">
          {/* Main Hero Result Card */}
          <section
            aria-label="Emergency Severity Outcome"
            className={cn(
              "relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br p-6 shadow-sm transition-all md:p-8",
              theme.cardBorder,
              theme.cardBg
            )}
            style={{
              boxShadow: `0 12px 36px -10px ${theme.glowColor}, var(--shadow-soft)`,
            }}
          >
            <div className="flex flex-col gap-4">
              {/* Header Badges & Level */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-bold uppercase tracking-wider shadow-xs",
                      theme.badgeBg
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        theme.barColor,
                        isCriticalOrUrgent && "animate-ping"
                      )}
                      aria-hidden="true"
                    />
                    {theme.badgeLabel}
                  </span>
                  {result.vitalsEstimated && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      <Activity className="size-3 text-primary" aria-hidden="true" />
                      Vitals Estimated
                    </span>
                  )}
                </div>

                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  SmartAid AI Triage Engine
                </span>
              </div>

              {/* Condition Title & Summary */}
              <div className="space-y-2">
                <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                  {result.emergency.label}
                </h1>
                {result.emergency.id === "general" && input.symptoms && (
                  <p className="rounded-xl border border-border/70 bg-surface/80 p-3 text-sm font-medium text-foreground">
                    <span className="font-semibold text-muted-foreground">Reported symptoms: </span>
                    &ldquo;{input.symptoms}&rdquo;
                  </p>
                )}
                <p className="text-base font-medium leading-relaxed text-foreground/90 md:text-lg">
                  {theme.tagline}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                  {theme.actionGuidance}
                </p>
              </div>

              {/* Primary Call to Action Button inside Critical/Urgent Cards */}
              {isCriticalOrUrgent && (
                <div className="pt-2">
                  <a
                    href="tel:112"
                    className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-critical px-6 py-4 text-base font-bold text-critical-foreground shadow-md transition-all hover:bg-critical/90 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-critical/40"
                  >
                    <Phone className="size-5 shrink-0 animate-bounce" aria-hidden="true" />
                    <span>Call Emergency Services Now (Dial 112)</span>
                  </a>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Universal Emergency Dispatch (Ambulance / Fire / Police) · Free 24/7 call
                  </p>
                </div>
              )}

              {/* Safety Escalation Note */}
              {theme.escalationWarning && (
                <div className="mt-1 flex items-start gap-2.5 rounded-xl border border-critical/30 bg-card/70 p-3.5 text-xs font-medium text-critical md:text-sm">
                  <AlertOctagon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{theme.escalationWarning}</span>
                </div>
              )}
            </div>
          </section>

          {/* Model Prediction & Risk Analysis Card */}
          <section
            aria-label="Model Prediction Metrics"
            className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm md:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-foreground md:text-lg">
                    Model Prediction &amp; Probability Analysis
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    XGBoost Multi-Class Severity Classification Pipeline
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                Assessed Class: {result.severity}
              </span>
            </div>

            {/* Confidence Score Gauge */}
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-foreground">
                    Classification Confidence Score
                  </span>
                  <span className={cn("text-2xl font-extrabold tracking-tight", theme.textColor)}>
                    {result.confidence}%
                  </span>
                </div>
                {/* Visual Progress Meter */}
                <div
                  className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuenow={result.confidence}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Model classification confidence ${result.confidence}%`}
                >
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", theme.barColor)}
                    style={{ width: `${Math.max(8, result.confidence)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                  <span>Statistical baseline</span>
                  <span>Predicted band: {result.severity} ({result.confidence}%)</span>
                  <span>Maximum certainty (100%)</span>
                </div>
              </div>

              {/* Metric Highlights Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-surface/70 p-3.5">
                  <p className="text-xs font-medium text-muted-foreground">Algorithm</p>
                  <p className="mt-1 text-sm font-bold text-foreground">XGBoost 2.1</p>
                  <p className="text-[10px] text-muted-foreground">Gradient Boosted Trees</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-surface/70 p-3.5">
                  <p className="text-xs font-medium text-muted-foreground">Triage Category</p>
                  <p className="mt-1 truncate text-sm font-bold text-foreground">
                    {result.emergency.label.split("/")[0]?.trim()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Mapped from NLP</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-border/70 bg-surface/70 p-3.5 sm:col-span-1">
                  <p className="text-xs font-medium text-muted-foreground">Vitals Status</p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {result.vitalsEstimated ? "Estimated" : "Measured"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Baseline physiological range</p>
                </div>
              </div>

              {/* Probability Notice */}
              <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  The model outputs the normalized probability for the primary predicted category.
                  Machine learning probabilities represent algorithmic risk scoring and are
                  governed by strict clinical safety nets to prevent under-triage.
                </span>
              </div>
            </div>
          </section>

          {/* Severity Scale Card (4-Level Comparison Gauge) */}
          <section
            aria-label="Severity Scale Reference"
            className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm md:p-7"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
              <h2 className="text-base font-bold text-foreground md:text-lg">
                Emergency Severity Scale Reference
              </h2>
              <span className="text-xs text-muted-foreground">
                Current Level: <strong className={theme.textColor}>{result.severity}</strong>
              </span>
            </div>

            <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SEVERITY_ORDER.map((lvl) => {
                const isActive = lvl === result.severity;
                const lvlTheme = SEVERITY_THEMES[lvl];
                const desc = SEVERITY_DESCRIPTIONS[lvl];
                const LvlIcon = lvlTheme.icon;

                return (
                  <li
                    key={lvl}
                    className={cn(
                      "relative flex flex-col justify-between rounded-2xl border p-4 transition-all",
                      isActive
                        ? cn("border-2 shadow-sm ring-1 ring-offset-1", lvlTheme.cardBorder, lvlTheme.badgeBg)
                        : "border-border/70 bg-surface/40 hover:bg-surface/80"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1.5 font-display text-sm font-bold">
                          <LvlIcon className="size-4 shrink-0" aria-hidden="true" />
                          {lvl}
                        </span>
                        {isActive && (
                          <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase text-background">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="my-2.5 h-1.5 w-full rounded-full bg-border/50">
                        <div
                          className={cn("h-full rounded-full", lvlTheme.barColor)}
                          style={{ width: "100%" }}
                        />
                      </div>
                      <p className="text-[11px] font-medium leading-relaxed text-foreground/80">
                        {desc.definition}
                      </p>
                    </div>
                    <p className="mt-3 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
                      {desc.criteria}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Why This Result? Assessment Evidence Card */}
          <section
            aria-label="Assessment Evidence & Explanations"
            className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm md:p-7"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Stethoscope className="size-4" aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold text-foreground md:text-lg">
                  Why This Result? Assessment Evidence
                </h2>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/explain">
                  Full Feature Weights <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Clinical Reasoning Summary */}
              {reasoningText && (
                <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Algorithmic Reasoning Summary
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-foreground">
                    {reasoningText}
                  </p>
                </div>
              )}

              {/* Reported Symptoms Tags */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Extracted Symptoms &amp; Clinical Signals:
                </p>
                {result.extractedSymptoms.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.extractedSymptoms.map((sym) => (
                      <span
                        key={sym}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/60 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        <Check className="size-3" aria-hidden="true" />
                        {sym}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    General emergency indicators evaluated from description.
                  </p>
                )}
              </div>

              {/* Rapid Assessment Profile Overview */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-surface/40 p-2.5 text-center">
                  <p className="text-[11px] text-muted-foreground">Conscious</p>
                  <p className="mt-0.5 text-xs font-bold capitalize text-foreground">
                    {input.conscious}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface/40 p-2.5 text-center">
                  <p className="text-[11px] text-muted-foreground">Breathing</p>
                  <p className="mt-0.5 text-xs font-bold capitalize text-foreground">
                    {input.breathing}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface/40 p-2.5 text-center">
                  <p className="text-[11px] text-muted-foreground">Bleeding</p>
                  <p className="mt-0.5 text-xs font-bold capitalize text-foreground">
                    {input.bleeding}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface/40 p-2.5 text-center">
                  <p className="text-[11px] text-muted-foreground">Duration</p>
                  <p className="mt-0.5 text-xs font-bold capitalize text-foreground">
                    {input.duration}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Right Column ("What to Do Now" & Action Panel) ─────────────── */}
        <div className="space-y-6 lg:col-span-5">
          {/* Immediate Action Panel */}
          <section
            aria-label="Immediate Action Guidance"
            className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm md:p-7"
          >
            <div className="flex items-center gap-2.5 border-b border-border/60 pb-4">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <HeartHandshake className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  What to Do Now
                </h2>
                <p className="text-xs text-muted-foreground">
                  Priority First-Aid Guidance for {result.emergency.label.split("/")[0]?.trim()}
                </p>
              </div>
            </div>

            {/* Emergency Service Escalation / Clinical Advisory Action */}
            <div className="mt-5 space-y-4">
              {requiresEmergencyEscalation ? (
                <div className="rounded-2xl border-2 border-critical/40 bg-critical-soft/60 p-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-critical text-critical-foreground shadow-xs">
                      <Phone className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-critical">
                        Emergency Ambulance Escalation
                      </p>
                      <p className="text-base font-extrabold text-foreground">
                        Universal Number: 112
                      </p>
                    </div>
                    <a
                      href="tel:112"
                      className="inline-flex items-center justify-center rounded-xl bg-critical px-4 py-2 text-xs font-bold text-critical-foreground shadow-xs transition-colors hover:bg-critical/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-critical/40"
                    >
                      Call Now
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/80 bg-surface/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <Info className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        First-Aid &amp; Clinical Advisory
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground md:text-sm">
                        Follow the prioritized self-care first-aid steps below. If symptoms worsen, do not improve, or red-flag signs emerge, consult a healthcare professional.
                      </p>
                      <p className="pt-1 text-xs text-muted-foreground">
                        Emergency dispatch accessible 24/7 if needed:{" "}
                        <a href="tel:112" className="font-semibold text-foreground hover:underline">
                          112 (Universal)
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Numbered Step-by-Step Action Items */}
              <div className="space-y-3 pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Immediate Actions (In Priority Order):
                </p>
                <ol className="space-y-2.5">
                  {guidanceSteps.map((step, idx) => (
                    <li
                      key={step.title}
                      className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs transition-colors hover:border-primary/40"
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-extrabold text-primary">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground">
                          {step.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {step.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Key Precautions & Avoid Box */}
              {avoidItems.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                    <span>Important Precautions &amp; What to Avoid:</span>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    {avoidItems.map((av) => (
                      <li key={av} className="flex items-start gap-2">
                        <XCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>{av}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Full Interactive Guidance Link */}
              <Button asChild size="lg" className="w-full">
                <Link to="/guidance">
                  <Stethoscope className="mr-2 size-4" /> Start Full Guided Action Plan
                </Link>
              </Button>
            </div>
          </section>

          {/* Quick Hospital Routing Card */}
          <section
            aria-label="Hospital & Facility Locator"
            className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm md:p-7"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Nearby Emergency Facilities
                </h2>
                <p className="text-xs text-muted-foreground">
                  Verified emergency rooms, trauma centers, and clinics
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              SmartAid geolocates verified OpenStreetMap medical centers with 24/7 trauma
              capabilities, emergency phone lines, and turn-by-turn driving directions.
            </p>

            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/hospitals">
                <Building2 className="mr-2 size-4 text-primary" /> View Nearby Hospital Map
              </Link>
            </Button>
          </section>

          {/* Safety Disclaimer Card */}
          <section
            aria-label="Clinical Decision Support Disclaimer"
            className="rounded-3xl border border-border/80 bg-surface/60 p-5 text-xs text-muted-foreground shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden="true" />
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-bold text-foreground">Clinical Decision Support Only</p>
                <p>
                  SmartAid AI provides structured triage decision support and does not replace
                  formal clinical assessment by licensed physicians or paramedics. If a life-threatening
                  emergency is suspected, contact emergency medical dispatch (112) without delay.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── 4. Bottom Action Bar ─────────────────────────────────────────── */}
      <section
        aria-label="Next Actions"
        className="mt-8 rounded-3xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Ready for the next step?</h3>
            <p className="text-xs text-muted-foreground">
              Continue to step-by-step guidance, export the official emergency report, or review input answers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="flex-1 sm:flex-initial">
              <Link to="/guidance">
                Show First Aid Steps <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="flex-1 sm:flex-initial">
              <Link to="/report">
                <FileText className="mr-1.5 size-4" /> Emergency Report
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-initial"
            >
              <Link
                to="/assessment"
                onClick={() => {
                  clearSession();
                  clearBackendSessionId();
                }}
              >
                <RotateCcw className="mr-1.5 size-4" /> New Assessment
              </Link>
            </Button>

            <Button asChild variant="ghost" size="sm">
              <Link to="/symptoms" className="text-xs font-semibold text-primary hover:underline">
                <RotateCcw className="mr-1 size-3.5" /> Edit Answers
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
