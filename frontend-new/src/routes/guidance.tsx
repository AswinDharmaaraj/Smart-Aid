import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
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
  Loader2,
  Phone,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/step-progress";
import { SeverityBadge } from "@/components/severity-badge";
import { loadSession, type Session } from "@/lib/smartaid";
import { getBackendSessionId } from "@/lib/backendSession";
import { fetchGuidance, type FirstAidGuideResponse } from "@/lib/guidanceService";

export const Route = createFileRoute("/guidance")({
  head: () => ({
    meta: [
      { title: "First-Aid Action Plan — SmartAid AI" },
      {
        name: "description",
        content:
          "Step-by-step verified first-aid instructions personalised to emergency category, severity, age, and conditions.",
      },
      { property: "og:title", content: "Your First-Aid Action Plan — SmartAid AI" },
      {
        property: "og:description",
        content: "Guided medical action plan you can follow calmly one step at a time.",
      },
    ],
  }),
  component: GuidancePage,
});

function GuidancePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechMode, setSpeechMode] = useState<"step" | "all" | null>(null);

  // Backend guidance state
  const [backendGuide, setBackendGuide] = useState<FirstAidGuideResponse | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(true);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);

  // Active step container ref for keyboard focus & scrolling
  const stepContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s?.result) {
      navigate({ to: "/assessment" });
      return;
    }
    setSession(s);
    setSpeechAvailable(typeof window !== "undefined" && "speechSynthesis" in window);

    // Fetch backend guidance, fall back to static if unavailable
    const sessionId = getBackendSessionId();
    if (sessionId) {
      fetchGuidance(sessionId)
        .then((guide) => {
          setBackendGuide(guide);
          setGuidanceLoading(false);
        })
        .catch((err) => {
          console.warn("Backend guidance unavailable, using static fallback:", err);
          setGuidanceError("offline");
          setGuidanceLoading(false);
        });
    } else {
      setGuidanceError("no-session");
      setGuidanceLoading(false);
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [navigate]);

  if (!session?.result) return null;
  const { result, input } = session;
  const { emergency } = result;

  // ── Resolve steps: prefer verified backend guide, fall back to offline static ─────
  const steps = backendGuide ? backendGuide.steps : emergency.steps;
  const precautions = backendGuide ? backendGuide.precautions : emergency.precautions;
  const avoid = backendGuide ? backendGuide.avoid : emergency.avoid;

  const isUsingFallback = !backendGuide;
  const showCallEmergency =
    backendGuide?.call_emergency ??
    (result.severity === "Critical" || result.severity === "Urgent");

  const fallbackStep = {
    title: "Follow First-Aid Protocol",
    detail: "Apply standard emergency precautions.",
  };
  const currentStepData = steps[currentStep] ?? steps[0] ?? fallbackStep;
  const totalSteps = steps.length;
  const isCurrentCompleted = done.includes(currentStep);
  const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);
  const completedPercent = Math.round((done.length / totalSteps) * 100);

  // ── Voice / SpeechSynthesis Handlers ──────────────────────────────────────────
  const stopSpeaking = () => {
    if (!speechAvailable) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeechMode(null);
  };

  const speakCurrentStep = () => {
    if (!speechAvailable || !currentStepData) return;
    if (isSpeaking && speechMode === "step") {
      stopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();
    const text = `Step ${currentStep + 1} of ${totalSteps}. ${currentStepData.title}. ${currentStepData.detail}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Calm, clear pacing for emergencies

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeechMode(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeechMode(null);
    };

    setIsSpeaking(true);
    setSpeechMode("step");
    window.speechSynthesis.speak(utterance);
  };

  const speakAllSteps = () => {
    if (!speechAvailable || !steps.length) return;
    if (isSpeaking && speechMode === "all") {
      stopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();
    const fullScript = steps
      .map((s, i) => `Step ${i + 1}. ${s.title}. ${s.detail}`)
      .join(". Next step: ");
    const utterance = new SpeechSynthesisUtterance(
      `First aid action plan for ${backendGuide?.emergency_category ?? emergency.label}. ` +
        fullScript,
    );
    utterance.rate = 0.95;

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeechMode(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeechMode(null);
    };

    setIsSpeaking(true);
    setSpeechMode("all");
    window.speechSynthesis.speak(utterance);
  };

  // ── Step Navigation Handlers ──────────────────────────────────────────────────
  const toggleComplete = (stepIndex: number = currentStep) => {
    setDone((prev) =>
      prev.includes(stepIndex) ? prev.filter((idx) => idx !== stepIndex) : [...prev, stepIndex],
    );
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < totalSteps) {
      if (isSpeaking && speechMode === "step") {
        stopSpeaking();
      }
      setCurrentStep(index);
      stepContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      goToStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  return (
    <div className="container-page px-4 sm:px-6 lg:px-8 py-8 md:py-10">
      {/* ── Progress in Flow ──────────────────────────────────────────────── */}
      <div className="w-full">
        <StepProgress current={3} />
      </div>

      {/* ── Top Emergency Immediate Call Banner ────────────────────────────── */}
      {showCallEmergency && (
        <div
          className="mt-6 rounded-2xl border border-critical/40 bg-critical-soft p-5 sm:p-6 shadow-xs transition-all animate-in fade-in duration-300"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-critical text-critical-foreground">
                <Phone className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-critical">
                  Immediate Emergency Dispatch Recommended
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground/85">
                  {backendGuide?.severity_note ??
                    "This is an urgent or critical emergency. Have a bystander dial 112 immediately while you begin first aid."}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
              <a
                href="tel:112"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-critical px-5 text-sm font-semibold text-critical-foreground shadow-xs hover:bg-critical/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical focus-visible:ring-offset-2 transition-colors w-full sm:w-auto"
                aria-label="Call 112 national emergency services immediately"
              >
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                <span>Call 112 Now</span>
              </a>
              <Link
                to="/hospitals"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-critical/30 bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors w-full sm:w-auto"
              >
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>Find Hospitals</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Offline Fallback Notice (if applicable) ────────────────────────── */}
      {isUsingFallback && !guidanceLoading && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-moderate/30 bg-moderate-soft px-4 py-3 text-xs text-foreground/80">
          <Info className="size-4 shrink-0 text-moderate" aria-hidden="true" />
          <span className="leading-relaxed">
            <strong>Standard First-Aid Protocol:</strong>{" "}
            {guidanceError === "offline"
              ? "Backend service could not be reached. Displaying verified offline first-aid procedures."
              : "Showing verified first-aid guidance for this emergency category."}
          </span>
        </div>
      )}

      {/* ── Main Clinical Guidance Header ──────────────────────────────────── */}
      <header className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs rise">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                <HeartHandshake className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                Action Plan · First 60 Seconds
              </span>
              <SeverityBadge level={result.severity} />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Your First-Aid Action Plan
            </h1>

            <p className="text-base sm:text-lg font-semibold text-primary">
              Emergency: {backendGuide?.emergency_category ?? emergency.label}
            </p>

            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Follow these verified steps calmly, one at a time, while arranging professional
              medical help. Stay with the person and keep them reassured.
            </p>
          </div>

          {/* Voice Assistance Card / Controls */}
          {speechAvailable ? (
            <div className="w-full lg:w-72 shrink-0 rounded-2xl border border-border/80 bg-surface/60 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Volume2 className="size-4 text-primary shrink-0" aria-hidden="true" />
                  Audio Guidance
                </span>
                {isSpeaking && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary animate-pulse">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Speaking
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row lg:flex-col gap-2">
                <Button
                  variant={isSpeaking && speechMode === "step" ? "default" : "secondary"}
                  size="sm"
                  onClick={speakCurrentStep}
                  disabled={guidanceLoading}
                  className="w-full justify-center gap-2 text-xs h-10 font-medium"
                  aria-label={
                    isSpeaking && speechMode === "step"
                      ? "Stop reading step aloud"
                      : `Read step ${currentStep + 1} aloud`
                  }
                >
                  {isSpeaking && speechMode === "step" ? (
                    <>
                      <VolumeX
                        className="size-4 shrink-0 text-primary-foreground"
                        aria-hidden="true"
                      />
                      <span>Stop Reading</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>Read Step Aloud</span>
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={isSpeaking && speechMode === "all" ? stopSpeaking : speakAllSteps}
                  disabled={guidanceLoading}
                  className="w-full justify-center gap-2 text-xs h-10 font-medium bg-card"
                  aria-label="Read all first-aid steps sequentially aloud"
                >
                  {isSpeaking && speechMode === "all" ? (
                    <>
                      <VolumeX className="size-4 shrink-0 text-critical" aria-hidden="true" />
                      <span>Stop Full Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>Read Full Plan</span>
                    </>
                  )}
                </Button>
              </div>

              {isSpeaking && (
                <p
                  className="mt-2 text-center text-[11px] text-muted-foreground"
                  aria-live="polite"
                >
                  {speechMode === "all" ? "Playing all steps" : `Reading step ${currentStep + 1}`}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Clinical Disclaimer & Patient Context Pill */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="leading-relaxed">
              Decision-support recommendation based on reported symptoms.{" "}
              <strong>Not a confirmed clinical diagnosis.</strong>
            </span>
          </div>

          {(input.age !== "" || input.conditions.length > 0) && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-medium shrink-0">
              <Stethoscope className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>
                Personalised for{input.age !== "" ? ` age ${input.age}` : ""}
                {input.conditions.length
                  ? `${input.age !== "" ? " · " : " "}${input.conditions.join(", ")}`
                  : ""}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Guidance Content Grid (2 Columns on Desktop, 1 on Mobile/Tablet) ── */}
      {guidanceLoading ? (
        <div className="mt-8 rounded-3xl border border-border bg-card p-12 text-center shadow-xs">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-base font-semibold text-foreground">
            Preparing your personalised action plan…
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Formatting medical steps and contraindications for this emergency.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column: Active Step Focused Card (7 / 12 on Desktop) ──────── */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
            {/* Step Progress Pill Indicator Bar */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold gap-2">
                <span className="text-foreground">
                  Step {currentStep + 1} of {totalSteps}
                </span>
                <span className="text-muted-foreground">
                  {done.length} of {totalSteps} completed ({completedPercent}%)
                </span>
              </div>

              {/* Graphical Step Progress Bar */}
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={currentStep + 1}
                  aria-valuemin={1}
                  aria-valuemax={totalSteps}
                  aria-label={`Step ${currentStep + 1} of ${totalSteps}`}
                />
              </div>

              {/* Clickable Step Pills */}
              <div
                className="mt-3.5 flex flex-wrap gap-1.5"
                role="tablist"
                aria-label="Step selector"
              >
                {steps.map((s, idx) => {
                  const isDone = done.includes(idx);
                  const isActive = idx === currentStep;

                  return (
                    <button
                      key={idx}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Step ${idx + 1}: ${s.title}`}
                      onClick={() => goToStep(idx)}
                      className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 ${
                        isActive
                          ? "border-2 border-primary bg-primary text-primary-foreground shadow-xs"
                          : isDone
                            ? "border border-success/40 bg-success-soft text-success hover:bg-success/20"
                            : "border border-border bg-surface text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {isDone ? (
                        <Check className="size-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                      <span className="hidden sm:inline truncate max-w-[120px] text-[11px] font-normal">
                        {s.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Step Card */}
            <article
              ref={stepContainerRef}
              className={`rounded-3xl border bg-card p-6 sm:p-8 shadow-xs transition-all ${
                isCurrentCompleted ? "border-success/40" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary">
                    {currentStep + 1}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Action {currentStep + 1} of {totalSteps}
                  </span>
                </div>

                {isCurrentCompleted ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-3 py-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                    Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                    <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                    In Progress
                  </span>
                )}
              </div>

              {/* Step Title */}
              <h2 className="mt-4 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground break-words">
                {currentStepData.title}
              </h2>

              {/* Step Detail Box */}
              <div className="mt-5 rounded-2xl border border-border/80 bg-surface/60 p-5 sm:p-6">
                <p className="text-base sm:text-lg font-normal leading-relaxed text-foreground break-words">
                  {currentStepData.detail}
                </p>
              </div>

              {/* Step Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border/70 pt-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    onClick={() => toggleComplete(currentStep)}
                    className={`h-11 px-4 text-xs sm:text-sm font-semibold rounded-xl gap-2 transition-all ${
                      isCurrentCompleted
                        ? "border border-success/40 bg-success-soft text-success hover:bg-success-soft/80"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                    variant={isCurrentCompleted ? "outline" : "default"}
                    aria-label={
                      isCurrentCompleted
                        ? "Mark current step as incomplete"
                        : "Mark current step as completed"
                    }
                  >
                    {isCurrentCompleted ? (
                      <>
                        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                        <span>Completed (Undo)</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                        <span>Mark Step Done</span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={goBack}
                    disabled={currentStep === 0}
                    className="h-11 px-4 text-xs sm:text-sm font-semibold rounded-xl gap-2 bg-card"
                    aria-label="Navigate to previous first-aid step"
                  >
                    <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                    <span>Previous</span>
                  </Button>
                </div>

                <Button
                  onClick={goNext}
                  disabled={currentStep === totalSteps - 1}
                  className="h-11 px-5 text-xs sm:text-sm font-semibold rounded-xl gap-2"
                  variant={currentStep === totalSteps - 1 ? "secondary" : "default"}
                  aria-label="Navigate to next first-aid step"
                >
                  <span>Next Step</span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Button>
              </div>
            </article>

            {/* Quick Overview of All Action Steps */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground flex items-center justify-between gap-2">
                <span>All Protocol Steps</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Click any step to inspect
                </span>
              </h3>

              <ol className="mt-4 space-y-2.5" aria-label="First aid sequence steps">
                {steps.map((s, idx) => {
                  const isDone = done.includes(idx);
                  const isCurrent = idx === currentStep;

                  return (
                    <li
                      key={idx}
                      onClick={() => goToStep(idx)}
                      className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-all min-w-0 ${
                        isCurrent
                          ? "border-primary bg-primary-soft/40 shadow-xs"
                          : isDone
                            ? "border-success/30 bg-success-soft/20 text-muted-foreground"
                            : "border-border/70 bg-surface/50 hover:bg-surface"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComplete(idx);
                        }}
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border transition-colors ${
                          isDone
                            ? "border-success bg-success text-success-foreground"
                            : "border-border bg-card text-transparent hover:border-primary"
                        }`}
                        aria-label={
                          isDone
                            ? `Mark step ${idx + 1} incomplete`
                            : `Mark step ${idx + 1} complete`
                        }
                      >
                        <Check className="size-3.5 text-white" aria-hidden="true" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-medium ${
                            isCurrent
                              ? "text-primary font-semibold"
                              : isDone
                                ? "line-through text-muted-foreground"
                                : "text-foreground"
                          }`}
                        >
                          Step {idx + 1}: {s.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 break-words">
                          {s.detail}
                        </p>
                      </div>

                      {isCurrent && (
                        <span className="shrink-0 text-[11px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary-soft">
                          Active
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* ── Right Column: Medical Safety, Precautions & Emergency Hub (5 / 12 on Desktop) ─ */}
          <aside className="lg:col-span-5 xl:col-span-4 space-y-6 min-w-0">
            {/* Precautions Card */}
            {precautions && precautions.length > 0 && (
              <div className="rounded-3xl border border-moderate/30 bg-moderate-soft/50 p-6 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-moderate/20 text-moderate">
                    <ShieldAlert className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-moderate">Critical Precautions</h3>
                </div>

                <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground/90">
                  {precautions.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 min-w-0">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-moderate" />
                      <span className="min-w-0 flex-1 break-words">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contraindications ("What to Avoid") Card */}
            {avoid && avoid.length > 0 && (
              <div className="rounded-3xl border border-critical/30 bg-critical-soft/50 p-6 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-critical/20 text-critical">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-critical">
                    What to Avoid (Contraindications)
                  </h3>
                </div>

                <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground/90">
                  {avoid.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 min-w-0">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-critical" />
                      <span className="min-w-0 flex-1 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Emergency Hospital Locator Quick Link */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Building2 className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Need Hospital Transport?
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Find nearest verified emergency wards.
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Search emergency rooms and medical facilities within driving distance with Google
                Maps directions.
              </p>

              <Button
                asChild
                size="default"
                className="mt-4 w-full h-11 rounded-xl text-sm font-semibold gap-2"
              >
                <Link to="/hospitals">
                  <Building2 className="size-4 shrink-0" aria-hidden="true" />
                  <span>Find Nearby Hospitals</span>
                </Link>
              </Button>
            </div>

            {/* Medical Reference Disclaimer */}
            <div className="rounded-2xl border border-border/80 bg-surface/70 p-5 text-xs leading-relaxed text-muted-foreground shadow-2xs">
              <p className="font-semibold text-foreground/90">Medical Advisory</p>
              <p className="mt-1 leading-relaxed">
                {backendGuide?.disclaimer ||
                  "These first-aid instructions provide immediate supportive stabilization. They do not substitute for emergency medical care by certified paramedics or physicians. Dial 112 / 108 / 911 in life-threatening situations."}
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* ── Footer Navigation Hub ─────────────────────────────────────────── */}
      <footer className="mt-12 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="h-11 rounded-xl px-5 text-sm gap-2 w-full sm:w-auto">
            <Link to="/report">
              <FileText className="size-4 shrink-0" aria-hidden="true" />
              <span>Emergency Incident Report</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-11 rounded-xl px-5 text-sm gap-2 w-full sm:w-auto bg-card"
          >
            <Link to="/explain">
              <HelpCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>Why this advice?</span>
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-muted-foreground">
          <Link
            to="/symptoms"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Edit input answers
          </Link>
          <span>·</span>
          <Link
            to="/history"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            View history
          </Link>
        </div>
      </footer>
    </div>
  );
}
