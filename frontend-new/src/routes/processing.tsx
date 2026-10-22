import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { EMERGENCY_TYPES, extractSymptoms, loadSession, saveSession, type SeverityLevel } from "@/lib/smartaid";import { getBackendSessionId } from "@/lib/backendSession";
import { predictSeverity } from "@/lib/severityService";

export const Route = createFileRoute("/processing")({
  head: () => ({
    meta: [
      { title: "Analysing Symptoms — SmartAid AI" },
      { name: "description", content: "SmartAid AI is extracting symptoms and predicting emergency severity from your input." },
      { property: "og:title", content: "Analysing Symptoms — SmartAid AI" },
      { property: "og:description", content: "NLP extraction and ML severity prediction in progress." },
    ],
  }),
  component: ProcessingPage,
});

const STAGES = [
  "Extracting symptoms with NLP",
  "Matching against emergency categories",
  "Predicting severity with the ML model",
  "Building explainable recommendation",
];

function ProcessingPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      navigate({ to: "/assessment" });
      return;
    }

    const timers = STAGES.map((_, i) => window.setTimeout(() => setStage(i + 1), 480 * (i + 1)));

    const backendSessionId = getBackendSessionId();

    const BACKEND_TO_LOCAL_ID: Record<string, string> = {
      "Snake bite": "snakebite",
      "Heart attack": "cardiac",
      "Choking": "choking",
      "Burn": "burn",
      "Fracture": "fracture",
      "Electric shock": "shock-electric",
    };

    const finish = async () => {
      if (!backendSessionId) {
        console.warn("No backend session — cannot get a real prediction. Redirecting to assessment.");
        navigate({ to: "/assessment" });
        return;
      }

      try {
        const prediction = await predictSeverity(backendSessionId);

        const severityMap: Record<string, SeverityLevel> = {
          low: "Low",
          moderate: "Moderate",
          urgent: "Urgent",
          critical: "Critical",
        };
        const severity = severityMap[prediction.severity_level] ?? "Moderate";

        const localId = prediction.emergency_type ? BACKEND_TO_LOCAL_ID[prediction.emergency_type] : undefined;
const matchedType =
  (localId && EMERGENCY_TYPES.find((e) => e.id === localId)) ||
  EMERGENCY_TYPES.find((e) => e.id === session.input.emergencyId) ||
  EMERGENCY_TYPES[0]!;

        saveSession({
          ...session,
          result: {
            severity,
            confidence: Math.round(prediction.confidence_score * 100),
            emergency: matchedType,
            extractedSymptoms: extractSymptoms(session.input.symptoms),
            vitalsEstimated: prediction.vitals_estimated ?? true,
            factors: [
              {
                label: prediction.emergency_type ?? "General assessment",
                weight: Math.round(prediction.confidence_score * 100),
                note: prediction.reasoning,
              },
            ],
          },
        });
        navigate({ to: "/result" });
      } catch (err) {
        console.error("Prediction failed:", err);
        navigate({ to: "/assessment" });
      }
    };

    const done = window.setTimeout(finish, 480 * STAGES.length + 400);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(done);
    };
  }, [navigate]);

  return (
    <div className="container-flow flex min-h-[70dvh] flex-col items-center justify-center py-16 text-center">
      <div className="relative grid size-20 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
        <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
          <Loader2 className="size-7 animate-spin" />
        </span>
      </div>
      <h1 className="mt-8 text-2xl font-semibold md:text-3xl">Analysing the emergency</h1>
      <p className="mt-2 text-sm text-muted-foreground">This usually takes a few seconds. Stay with the person.</p>

      <ol className="mt-10 w-full max-w-sm space-y-3 text-left" aria-live="polite">
        {STAGES.map((s, i) => {
          const done = stage > i;
          const active = stage === i;
          return (
            <li
              key={s}
              className={`flex items-center gap-3 rounded-xl border p-3.5 text-sm transition-colors ${done ? "border-primary/30 bg-primary-soft/60 text-foreground" : active ? "border-border bg-card" : "border-border/60 bg-transparent text-muted-foreground"
                }`}
            >
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              {s}
            </li>
          );
        })}
      </ol>
    </div>
  );
}