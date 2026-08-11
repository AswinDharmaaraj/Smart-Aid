import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const id = parseInt(qrCodeId, 10);
    startSession(id)
      .then((session) => {
        setBackendSessionId(session.session_id);
        navigate({ to: "/assessment" });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "This QR code is invalid or inactive.");
      });
  }, [qrCodeId, navigate]);

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