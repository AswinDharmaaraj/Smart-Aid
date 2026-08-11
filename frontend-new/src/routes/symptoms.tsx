import { saveSymptomInput } from "@/lib/symptomService";
import { getBackendSessionId } from "@/lib/backendSession";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/step-progress";
import {
  DEFAULT_INPUT,
  EMERGENCY_TYPES,
  loadSession,
  saveSession,
  type AssessmentInput,
} from "@/lib/smartaid";

type Search = { type?: string | undefined };

export const Route = createFileRoute("/symptoms")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    type: typeof search["type"] === "string" ? (search["type"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Symptom Input — SmartAid AI" },
      { name: "description", content: "Describe symptoms in natural language and add the details SmartAid AI needs to predict emergency severity." },
      { property: "og:title", content: "Symptom Input — SmartAid AI" },
      { property: "og:description", content: "Natural language symptom entry for AI emergency triage." },
    ],
  }),
  component: SymptomsPage,
});

const CONDITIONS = ["Diabetes", "Heart condition", "Asthma", "Pregnancy", "Blood thinners", "Allergies"];

function SymptomsPage() {
  const { type } = Route.useSearch();
  const navigate = useNavigate();
  const existing = typeof window !== "undefined" ? loadSession() : null;
  const [input, setInput] = useState<AssessmentInput>(
    {
      ...DEFAULT_INPUT,
      ...(existing?.input ?? {}),
      emergencyId: type ?? existing?.input.emergencyId ?? null,
    },
  );
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selected = EMERGENCY_TYPES.find((e) => e.id === input.emergencyId);

  const set = <K extends keyof AssessmentInput>(key: K, value: AssessmentInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const stepLabels = ["Describe symptoms", "Rapid checks", "Patient details"];

  const validateStep = () => {
    const nextErrors: Record<string, string> = {};
    if (step === 0 && !selected && !input.symptoms.trim()) {
      nextErrors.symptoms = "Please describe the situation or choose an emergency category.";
    }
    if (step === 2 && input.age !== "") {
      const age = Number(input.age);
      if (Number.isNaN(age) || age < 0 || age > 120) {
        nextErrors.age = "Please enter a valid age between 0 and 120.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      if (validateStep()) {
        setStep(step + 1);
      }
      return;
    }
    if (!validateStep()) return;

    saveSession({ input, result: null, startedAt: new Date().toISOString() });

    const backendSessionId = getBackendSessionId();
    if (!backendSessionId) {
      console.warn("No backend session ID found — symptom data will NOT be saved to the database. Did you start from /session/{id}?");
    }
    if (backendSessionId) {
      const composedText = [
        input.symptoms,
        `Responsive: ${input.conscious}`,
        `Breathing: ${input.breathing}`,
        `Bleeding: ${input.bleeding}`,
        `Duration: ${input.duration}`,
        input.age ? `Age: ${input.age}` : null,
        input.conditions.length ? `Existing conditions: ${input.conditions.join(", ")}` : null,
      ].filter(Boolean).join(". ");

      saveSymptomInput(backendSessionId, {
        raw_text: composedText,
        category: selected?.label,
      }).catch((err) => {
        console.error("Failed to save symptom input:", err);
      });
    }

    navigate({ to: "/processing" });
  };

  return (
    <div className="container-flow py-10 md:py-14">
      <StepProgress current={1} />

      <form onSubmit={submit} className="mt-8 space-y-6 rise">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Tell SmartAid what you see</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            {selected ? (
              <>
                Selected emergency: <span className="font-medium text-foreground">{selected.label}</span> ·{' '}
                <Link to="/assessment" className="text-primary underline-offset-4 hover:underline">
                  change
                </Link>
              </>
            ) : (
              "Only the description is required — everything else helps the AI assess the emergency more accurately."
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Step {step + 1} of 3</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">{stepLabels[step]}</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              {step === 0
                ? "Describe the emergency in plain language. You can be brief and direct."
                : step === 1
                  ? "Quick checks help the AI understand the risk immediately."
                  : "Optional patient details improve the recommendation and report."}
            </p>
          </div>

          {step === 0 ? (
            <div className="mt-6 space-y-5">
              <label htmlFor="symptoms" className="block text-sm font-medium text-foreground">
                Describe the symptoms
              </label>
              <textarea
                id="symptoms"
                value={input.symptoms}
                onChange={(e) => set("symptoms", e.target.value)}
                rows={5}
                placeholder="e.g. The person fell from a ladder, is bleeding from the leg and cannot move the limb"
                className="w-full resize-none rounded-2xl border border-input bg-background p-4 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => {
                  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                  if (!SpeechRecognition) {
                    alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
                    return;
                  }
                  const recognition = new SpeechRecognition();
                  recognition.lang = "en-US";
                  recognition.continuous = false;
                  recognition.interimResults = false;

                  recognition.onstart = () => console.log("Mic listening started...");
                  recognition.onerror = (event: any) => console.error("Speech recognition error:", event.error);
                  recognition.onend = () => console.log("Mic listening ended.");
                  recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    console.log("Heard:", transcript);
                    set("symptoms", input.symptoms ? `${input.symptoms} ${transcript}` : transcript);
                  };

                  recognition.start();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
              >
                <Mic className="size-4" aria-hidden="true" />
                Speak instead
              </button>
              {errors.symptoms ? <p className="text-sm text-destructive">{errors.symptoms}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Voice input supported</p>
                  <p className="mt-1 leading-6">Use your device keyboard microphone to speak the emergency.</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Plain language is fine</p>
                  <p className="mt-1 leading-6">The AI extracts clinically relevant signs from what you type.</p>
                </div>
              </div>
            </div>
          ) : step === 1 ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <ChoiceGroup
                label="Is the person responsive?"
                name="conscious"
                value={input.conscious}
                onChange={(v) => set("conscious", v as AssessmentInput["conscious"])}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "unsure", label: "Unsure" },
                  { value: "no", label: "No" },
                ]}
              />
              <ChoiceGroup
                label="Breathing"
                name="breathing"
                value={input.breathing}
                onChange={(v) => set("breathing", v as AssessmentInput["breathing"])}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "difficult", label: "Difficult" },
                  { value: "none", label: "None" },
                ]}
              />
              <ChoiceGroup
                label="Bleeding"
                name="bleeding"
                value={input.bleeding}
                onChange={(v) => set("bleeding", v as AssessmentInput["bleeding"])}
                options={[
                  { value: "none", label: "None" },
                  { value: "minor", label: "Minor" },
                  { value: "severe", label: "Severe" },
                ]}
              />
              <ChoiceGroup
                label="How long has this been going on?"
                name="duration"
                value={input.duration}
                onChange={(v) => set("duration", v as AssessmentInput["duration"])}
                options={[
                  { value: "just-now", label: "Just now" },
                  { value: "under-30", label: "< 30 min" },
                  { value: "over-30", label: "> 30 min" },
                ]}
              />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                <label htmlFor="age" className="text-sm font-medium text-foreground">
                  Age
                </label>
                <input
                  id="age"
                  type="number"
                  min={0}
                  max={120}
                  inputMode="numeric"
                  value={input.age}
                  onChange={(e) => set("age", e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.age ? <p className="text-sm text-destructive">{errors.age}</p> : <p className="text-sm text-muted-foreground">Optional: age helps personalise the report and risk assessment.</p>}
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-foreground">Existing conditions</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Select any conditions that apply. These are optional but useful.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => {
                    const active = input.conditions.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          set("conditions", active ? input.conditions.filter((x) => x !== c) : [...input.conditions, c])
                        }
                        className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground hover:bg-secondary"
                          }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" size="lg">
            {step < 2 ? "Continue" : "Analyse with AI"}
          </Button>
          {step > 0 ? (
            <Button type="button" variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Button asChild variant="outline" size="lg">
              <Link to="/assessment">Change emergency type</Link>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function ChoiceGroup({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <fieldset className="rounded-2xl border border-border bg-surface p-4">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="mt-3 space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors ${value === o.value
              ? "border-primary bg-primary-soft text-primary"
              : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:bg-secondary"
              }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}