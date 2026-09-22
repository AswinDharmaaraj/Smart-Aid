import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { startSession } from "@/lib/qrService";
import { setBackendSessionId } from "@/lib/backendSession";

export const Route = createFileRoute("/session/$qrCodeId")({
  head: () => ({
    meta: [{ title: "Opening SmartAid — SmartAid AI" }],
  }),
  component: SessionLandingPage,
});

function SessionLandingPage() {
  const { qrCodeId } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Track the qrCodeId that was already submitted this mount so that
  // React Strict Mode's double-invoke doesn't create two sessions.
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    // Guard: if this exact qrCodeId was already kicked off during this mount
    // cycle (e.g. Strict Mode double-invoke), skip the duplicate call.
    if (firedForRef.current === qrCodeId) return;
    firedForRef.current = qrCodeId;

    const controller = new AbortController();
    const id = parseInt(qrCodeId, 10);

    startSession(id)
      .then((session) => {
        if (controller.signal.aborted) return; // navigated away before response
        setBackendSessionId(session.session_id);
        navigate({ to: "/assessment" });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "This QR code is invalid or inactive.");
      });

    // Reset the ref on cleanup so a real re-navigation to a different (or
    // the same) qrCodeId on a fresh mount will always fire a new request.
    return () => {
      controller.abort();
      firedForRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrCodeId]); // navigate is stable; omitting it avoids spurious re-runs

  if (error) {
    return (
      <div className="container-flow flex min-h-[60vh] flex-col items-center justify-center py-14 text-center">
        <h1 className="text-2xl font-semibold text-critical">QR code not recognized</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="container-flow flex min-h-[60vh] flex-col items-center justify-center py-14 text-center">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-4 text-muted-foreground">Connecting you to the emergency portal...</p>
    </div>
  );
}