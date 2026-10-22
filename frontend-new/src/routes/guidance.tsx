import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Phone, ShieldAlert, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/step-progress";
import { SeverityBadge } from "@/components/severity-badge";
import { loadSession, type Session } from "@/lib/smartaid";
import { getBackendSessionId } from "@/lib/backendSession";
import { fetchGuidance, type FirstAidGuideResponse } from "@/lib/guidanceService";

export const Route = createFileRoute("/guidance")({
  head: () => ({
    meta: [
      { title: "Personalised First Aid Guidance — SmartAid AI" },
      { name: "description", content: "Step-by-step first aid personalised to the emergency type, severity, age and existing conditions." },
      { property: "og:title", content: "Personalised First Aid Guidance — SmartAid AI" },
      { property: "og:description", content: "Guided first aid steps you can follow one at a time." },
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

  // Backend guidance state
  const [backendGuide, setBackendGuide] = useState<FirstAidGuideResponse | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(true);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);

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
  }, [navigate]);

  if (!session?.result) return null;
  const { result, input } = session;
  const { emergency } = result;

  // ── Resolve steps: prefer backend guide, fall back to hardcoded static ─────
  const steps = backendGuide
    ? backendGuide.steps
    : emergency.steps;

  const precautions = backendGuide
    ? backendGuide.precautions
    : emergency.precautions;

  const avoid = backendGuide
    ? backendGuide.avoid
    : emergency.avoid;

  const isUsingFallback = !backendGuide;
  const showCallEmergency = backendGuide?.call_emergency ?? (
    result.severity === "Critical" || result.severity === "Urgent"
  );

  const step = steps[currentStep];

  const speak = () => {
    if (!speechAvailable || !step) return;
    const text = steps.map((s, i) => `Step ${i + 1}. ${s.title}. ${s.detail}`).join(" ");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const toggleComplete = () => {
    setDone((previous) =>
      previous.includes(currentStep)
        ? previous.filter((stepIndex) => stepIndex !== currentStep)
        : [...previous, currentStep],
    );
  };

  const goNext = () => {
    setCurrentStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const goBack = () => {
    setCurrentStep((value) => Math.max(value - 1, 0));
  };

  const completed = done.includes(currentStep);

  return (
    <div className="container-flow py-10 md:py-14">
      <StepProgress current={3} />

      {/* ── Critical call-to-action banner ────────────────────────────────── */}
      {showCallEmergency && (
        <div
          className="mt-6 flex items-center gap-4 rounded-2xl border border-critical/40 bg-critical-soft px-5 py-4 shadow-sm"
          role="alert"
          aria-live="assertive"
        >
          <Phone className="size-5 shrink-0 text-critical" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-critical">Call emergency services now</p>
            <p className="mt-0.5 text-sm text-foreground/80">
              {backendGuide?.severity_note ?? "This is a critical or urgent emergency. Dial 112 immediately."}
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0 bg-critical text-critical-foreground hover:bg-critical/90">
            <a href="tel:112" aria-label="Call 112 emergency services">
              <Phone className="size-3.5" aria-hidden="true" /> 112
            </a>
          </Button>
        </div>
      )}

      {/* ── Fallback notice ───────────────────────────────────────────────── */}
      {isUsingFallback && !guidanceLoading && (
        <div className="mt-4 rounded-xl border border-moderate/30 bg-moderate-soft px-4 py-3 text-sm text-foreground/70">
          <span className="font-medium text-moderate">Showing general guidance</span>
          {guidanceError === "offline"
            ? " — personalised instructions could not be loaded. Displaying standard first-aid steps."
            : " — no active session found. Displaying standard first-aid steps."}
        </div>
      )}

      <header className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm rise">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <SeverityBadge level={result.severity} className="mb-3" />
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              First aid: {backendGuide?.emergency_category ?? emergency.label}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              One step at a time. Mark progress as you complete each action so you can focus on the patient.
            </p>
          </div>
          <Button variant="secondary" size="lg" onClick={speak} disabled={!speechAvailable || guidanceLoading}>
            <Volume2 className="size-4" aria-hidden="true" /> Read aloud
          </Button>
        </div>
        {(input.age !== "" || input.conditions.length) ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Personalised for{input.age !== "" ? ` age ${input.age}` : ""}
            {input.conditions.length ? `${input.age !== "" ? " · " : " "}${input.conditions.join(", ")}` : ""}.
          </p>
        ) : null}
      </header>

      {/* ── Loading skeleton ──────────────────────────────────────────────── */}
      {guidanceLoading ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground animate-pulse">
          Loading personalised guidance…
        </div>
      ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          {/* Step card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                  Step {currentStep + 1} of {steps.length}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">{step?.title}</h2>
              </div>
              <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
                {completed ? "Completed" : "In progress"}
              </span>
            </div>
            <p className="mt-5 text-base leading-8 text-muted-foreground">{step?.detail}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant={completed ? "secondary" : "default"} size="lg" onClick={toggleComplete}>
                  {completed ? "Mark incomplete" : "Mark complete"}
                </Button>
                <Button variant="secondary" size="lg" onClick={goBack} disabled={currentStep === 0}>
                  Previous step
                </Button>
              </div>
              <Button size="lg" onClick={goNext} disabled={currentStep === steps.length - 1}>
                Next step
              </Button>
            </div>
          </div>

          {/* Aside: completed steps + precautions + avoid */}
          <aside className="space-y-4">
            {/* Completed steps */}
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground shadow-sm">
              <p className="font-semibold text-foreground">Completed steps</p>
              {done.length ? (
                <ul className="mt-4 space-y-2">
                  {done.map((stepIndex) => (
                    <li key={stepIndex} className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                        {stepIndex + 1}
                      </span>
                      <span>{steps[stepIndex]?.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 leading-7">
                  Mark each step complete to keep track of the sequence and avoid skipping anything.
                </p>
              )}
            </div>

            {/* Precautions */}
            <div className="rounded-2xl border border-moderate/30 bg-moderate-soft p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-moderate">
                <ShieldAlert className="size-4" aria-hidden="true" /> Precautions
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                {precautions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>

            {/* Avoid */}
            <div className="rounded-2xl border border-critical/30 bg-critical-soft p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-critical">
                <AlertTriangle className="size-4" aria-hidden="true" /> Never do this
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                {avoid.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>

            {/* Disclaimer */}
            {backendGuide?.disclaimer && (
              <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-muted-foreground shadow-sm">
                {backendGuide.disclaimer}
              </div>
            )}
          </aside>
        </section>
      )}

      <footer className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr]">
        <Button asChild size="lg">
          <Link to="/hospitals">Nearby hospitals</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to="/explain">Why this advice?</Link>
        </Button>
      </footer>

      <div className="mt-4 text-sm text-muted-foreground">
        <Link to="/symptoms" className="font-medium text-primary underline-offset-4 hover:underline">
          Edit input answers
        </Link>
      </div>
    </div>
  );
}
