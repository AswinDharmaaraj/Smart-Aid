import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowRight, Phone, PencilLine } from "lucide-react";
import { EMERGENCY_TYPES } from "@/lib/smartaid";
import { StepProgress } from "@/components/step-progress";
import { Button } from "@/components/ui/button";
import { startSession, DIRECT_START_QR_CODE_ID } from "@/lib/qrService";
import { getBackendSessionId, setBackendSessionId } from "@/lib/backendSession";
import { getAdminToken } from "@/lib/adminAuth";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: "Emergency Assessment — SmartAid AI" },
      { name: "description", content: "Choose the emergency category or describe symptoms to begin the SmartAid AI severity assessment." },
      { property: "og:title", content: "Emergency Assessment — SmartAid AI" },
      { property: "og:description", content: "Pick an emergency type and start guided first aid in seconds." },
    ],
  }),
  component: AssessmentPage,
});

function AssessmentPage() {
  const navigate = useNavigate();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (!getBackendSessionId()) {
      const token = getAdminToken();
      startSession(DIRECT_START_QR_CODE_ID, token)
        .then((session) => {
          setBackendSessionId(session.session_id);
        })
        .catch((err) => {
          console.warn("Direct assessment auto-session initialization deferred:", err);
        });
    }
  }, []);

  return (
    <div className="container-flow py-10 md:py-14">
      <StepProgress current={0} />

      <div className="mt-8 rise">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">What is happening?</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Pick the closest emergency type, or continue without a category and describe the situation in your own words.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <article className="rounded-2xl border border-critical/30 bg-critical-soft p-5 text-critical">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">If the person is unresponsive or not breathing</p>
              <p className="mt-1 text-sm text-current/80">Call emergency services before continuing with the assessment.</p>
            </div>
            <Button asChild size="lg" className="bg-critical text-critical-foreground hover:bg-critical/90">
              <a href="tel:112">Call emergency services</a>
            </Button>
          </div>
        </article>

        <div className="grid gap-3 sm:grid-cols-2">
          {EMERGENCY_TYPES.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => navigate({ to: "/symptoms", search: { type: e.id } })}
              className="group flex h-28 flex-col justify-between rounded-2xl border border-border bg-card p-5 text-left transition-shadow hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-semibold text-foreground">{e.label}</p>
              <p className="text-sm leading-6 text-muted-foreground">{e.hint}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="font-semibold text-foreground">None of these options match</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Describe the emergency in the next step. The AI will use your free text to find the right guidance.
          </p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => navigate({ to: "/symptoms", search: {} })} variant="secondary" size="lg">
              Describe symptoms
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
