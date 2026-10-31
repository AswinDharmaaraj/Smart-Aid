import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  ClipboardList,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/severity-badge";
import { getAdminToken, setAdminToken, clearAdminToken } from "@/lib/adminAuth";
import { login, register, getMe, type UserResponse } from "@/lib/authService";
import { getMyHistory, type HistoryEntry } from "@/lib/historyService";
import { claimSession } from "@/lib/qrService";
import { getBackendSessionId } from "@/lib/backendSession";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Emergency History — SmartAid AI" },
      {
        name: "description",
        content:
          "Review your past emergency assessments, severity predictions, and first-aid guidance sessions.",
      },
      { property: "og:title", content: "Emergency History — SmartAid AI" },
    ],
  }),
  component: HistoryPage,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryLabel(entry: HistoryEntry): string {
  if (entry.category) return entry.category;
  if (entry.raw_text) {
    const trimmed = entry.raw_text.trim();
    return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
  }
  return "Unknown emergency";
}

function severityBadgeLevel(
  level: HistoryEntry["severity_level"]
): "Low" | "Moderate" | "Urgent" | "Critical" {
  const map: Record<string, "Low" | "Moderate" | "Urgent" | "Critical"> = {
    low: "Low",
    moderate: "Moderate",
    urgent: "Urgent",
    critical: "Critical",
  };
  return (level && map[level]) || "Low";
}

// ── Auth gate (inline sign-in / sign-up) ───────────────────────────────────────

function AuthGate({ onAuth }: { onAuth: (token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in your email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        if (!fullName.trim()) {
          setError("Please enter your full name.");
          setLoading(false);
          return;
        }
        await register({ full_name: fullName, email, password });
      }
      const tokenData = await login({ email, password });
      setAdminToken(tokenData.access_token);
      onAuth(tokenData.access_token);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign-in failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 flex justify-center rise">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display font-semibold">Sign in to view history</p>
            <p className="text-xs text-muted-foreground">
              Account-synced assessments only
            </p>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="mt-6 flex rounded-2xl border border-border bg-secondary p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "register" && (
            <div>
              <label
                htmlFor="history-fullname"
                className="text-sm font-medium text-foreground"
              >
                Full name
              </label>
              <input
                id="history-fullname"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
          <div>
            <label
              htmlFor="history-email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="history-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="history-password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="history-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <Button
            id="history-signin-btn"
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Please wait…
              </>
            ) : (
              <>
                <LogIn className="size-4" aria-hidden="true" />
                {mode === "login" ? "Sign in" : "Create account & sign in"}
              </>
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Guest walk-ins are not synced to an account and will not appear here.
        </p>
      </div>
    </div>
  );
}

// ── History list ───────────────────────────────────────────────────────────────

function HistoryList({
  entries,
  user,
  onSignOut,
}: {
  entries: HistoryEntry[];
  user: UserResponse;
  onSignOut: () => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center gap-4 text-center rise">
        <span className="grid size-16 place-items-center rounded-2xl bg-secondary text-muted-foreground">
          <ClipboardList className="size-7" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-foreground">No history yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete an emergency assessment while signed in to see it here.
          </p>
        </div>
        <Button asChild size="lg" className="mt-2">
          <Link to="/scan">Start an assessment</Link>
        </Button>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Sign out ({user.email})
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 rise">
      {/* Account banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {user.full_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <button
          id="history-signout-btn"
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>

      <ul className="space-y-3" aria-label="Your emergency history">
        {entries.map((entry) => (
          <li
            key={entry.session_id}
            className="group overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-soft"
          >
            <div className="flex items-start gap-4 px-5 py-4">
              {/* Date icon */}
              <span
                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"
                aria-hidden="true"
              >
                <Calendar className="size-4" />
              </span>

              {/* Main info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {categoryLabel(entry)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmtDate(entry.started_at)} · Session #{entry.session_id}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {entry.severity_level && (
                    <SeverityBadge level={severityBadgeLevel(entry.severity_level)} />
                  )}
                  {entry.confidence_score != null && (
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {Math.round(entry.confidence_score * 100)}% confidence
                    </span>
                  )}
                  {!entry.severity_level && (
                    <span className="text-xs text-muted-foreground">
                      Assessment incomplete
                    </span>
                  )}
                </div>
              </div>

              {/* View report: links to the client-side report page with session ID.
                  The report page fetches the incident report securely using the
                  stored token and existing API client without exposing tokens in the URL. */}
              {entry.severity_level && (
                <Link
                  id={`history-report-${entry.session_id}`}
                  to="/report"
                  search={{ sessionId: entry.session_id }}
                  aria-label={`View emergency report for session ${entry.session_id}`}
                  className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Only assessments completed while signed in to your account are shown.
        Guest walk-ins are not linked to any account.
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type PageState =
  | { phase: "loading" }
  | { phase: "unauthenticated" }
  | { phase: "error"; message: string }
  | { phase: "ready"; entries: HistoryEntry[]; user: UserResponse };

function HistoryPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" });

  const loadHistory = async (token: string) => {
    setState({ phase: "loading" });
    try {
      const activeSessionId = getBackendSessionId();
      if (activeSessionId) {
        try {
          await claimSession(activeSessionId, token);
        } catch {
          // If session is already claimed or network failed, proceed to load history
        }
      }

      const [user, entries] = await Promise.all([
        getMe(token),
        getMyHistory(token),
      ]);
      setState({ phase: "ready", entries, user });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not load history.";
      // 401 / credentials error → treat as unauthenticated
      if (msg.toLowerCase().includes("401") || msg.toLowerCase().includes("credential")) {
        clearAdminToken();
        setState({ phase: "unauthenticated" });
      } else {
        setState({ phase: "error", message: msg });
      }
    }
  };

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setState({ phase: "unauthenticated" });
      return;
    }
    loadHistory(token);
  }, []);

  const handleAuth = (token: string) => loadHistory(token);

  const handleSignOut = () => {
    clearAdminToken();
    setState({ phase: "unauthenticated" });
  };

  return (
    <div className="container-flow py-10 md:py-14">
      {/* Page heading */}
      <div className="rise">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <ClipboardList className="size-3.5" aria-hidden="true" />
          Account history
        </span>
        <h1 className="mt-5 text-3xl font-semibold md:text-4xl">
          Emergency history
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your past emergency assessments, severity predictions, and guidance
          sessions — synced to your account.
        </p>
      </div>

      {/* State renderers */}
      {state.phase === "loading" && (
        <div className="mt-20 flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" aria-hidden="true" />
          <p className="text-sm">Loading your history…</p>
        </div>
      )}

      {state.phase === "unauthenticated" && (
        <AuthGate onAuth={handleAuth} />
      )}

      {state.phase === "error" && (
        <div className="mt-12 flex flex-col items-center gap-4 text-center rise">
          <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-foreground">Could not load history</p>
            <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Button
            id="history-retry-btn"
            variant="secondary"
            onClick={() => {
              const token = getAdminToken();
              if (token) loadHistory(token);
              else setState({ phase: "unauthenticated" });
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {state.phase === "ready" && (
        <HistoryList
          entries={state.entries}
          user={state.user}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
