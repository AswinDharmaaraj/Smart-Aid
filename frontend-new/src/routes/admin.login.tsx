import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { login, register } from "@/lib/authService";
import { setAdminToken } from "@/lib/adminAuth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Sign In — SmartAid AI" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
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
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        await register({ full_name: fullName, email, password, role: "user" });
      }
      const tokenData = await login({ email, password });
      setAdminToken(tokenData.access_token);
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-flow flex min-h-[70vh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex rounded-2xl border border-border bg-secondary p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${mode === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Register
          </button>
        </div>

        <h1 className="text-2xl font-semibold text-foreground">Admin portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in or register to view the dashboard. Admins can manage QR codes and promote users.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="text-sm font-medium text-foreground">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}