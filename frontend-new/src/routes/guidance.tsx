import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Phone, ShieldAlert, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/step-progress";
import { SeverityBadge } from "@/components/severity-badge";
import { loadSession, type Session } from "@/lib/smartaid";

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

  useEffect(() => {
    const s = loadSession();
    if (!s?.result) {
      navigate({ to: "/assessment" });
      return;
    }
    setSession(s);
    setSpeechAvailable(typeof window !== "undefined" && "speechSynthesis" in window);
  }, [navigate]);

  if (!session?.result) return null;
  const { result, input } = session;
  const { emergency } = result;
  const step = emergency.steps[currentStep];
  const completed = done.includes(currentStep);

  const speak = () => {
    if (!speechAvailable) return;
    const text = emergency.steps.map((s, i) => `Step ${i + 1}. ${s.title}. ${s.detail}`).join(" ");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const toggleComplete = () => {
    setDone((previous) =>
      previous.includes(currentStep) ? previous.filter((stepIndex) => stepIndex !== currentStep) : [...previous, currentStep],
    );
  };

  const goNext = () => {
    setCurrentStep((value) => Math.min(value + 1, emergency.steps.length - 1));
  };

  const goBack = () => {
    setCurrentStep((value) => Math.max(value - 1, 0));
  };

  return (
    <div className="container-flow py-10 md:py-14">
      <StepProgress current={3} />

      <header className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm rise">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <SeverityBadge level={result.severity} className="mb-3" />
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">First aid: {emergency.label}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              One step at a time. Mark progress as you complete each action so you can focus on the patient.
            </p>
          </div>
          <Button variant="secondary" size="lg" onClick={speak} disabled={!speechAvailable}>
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

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Step {currentStep + 1} of {emergency.steps.length}</p>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">{step.title}</h2>
            </div>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">{completed ? "Completed" : "In progress"}</span>
          </div>
          <p className="mt-5 text-base leading-8 text-muted-foreground">{step.detail}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant={completed ? "secondary" : "default"} size="lg" onClick={toggleComplete}>
                {completed ? "Mark incomplete" : "Mark complete"}
              </Button>
              <Button variant="secondary" size="lg" onClick={goBack} disabled={currentStep === 0}>
                Previous step
              </Button>
            </div>
            <Button size="lg" onClick={goNext} disabled={currentStep === emergency.steps.length - 1}>
              Next step
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground shadow-sm">
            <p className="font-semibold text-foreground">Completed steps</p>
            {done.length ? (
              <ul className="mt-4 space-y-2">
                {done.map((stepIndex) => (
                  <li key={stepIndex} className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{stepIndex + 1}</span>
                    <span>{emergency.steps[stepIndex]!.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 leading-7">Mark each step complete to keep track of the sequence and avoid skipping anything.</p>
            )}
          </div>

          <div className="rounded-2xl border border-moderate/30 bg-moderate-soft p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-moderate">
              <ShieldAlert className="size-4" aria-hidden="true" /> Precautions
            </p>
            <ul className="mt-3 space-y-2 text-sm text-foreground/80">
              {emergency.precautions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-critical/30 bg-critical-soft p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-critical">
              <AlertTriangle className="size-4" aria-hidden="true" /> Never do this
            </p>
            <ul className="mt-3 space-y-2 text-sm text-foreground/80">
              {emergency.avoid.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

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
