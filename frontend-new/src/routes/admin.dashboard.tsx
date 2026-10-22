import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Star,
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  X,
  Shield,
  QrCode as QrIcon,
  Users,
  Activity,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminToken, clearAdminToken } from "@/lib/adminAuth";
import { getMe, type UserResponse } from "@/lib/authService";
import { apiRequest } from "@/lib/api";
import {
  getAdminStats,
  getAdminFeedbacks,
  updateFeedbackReview,
  type AdminStatsResponse,
  type FeedbackResponse,
  type FeedbackCategory,
} from "@/lib/feedbackService";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin Dashboard — SmartAid AI" }] }),
  component: AdminDashboardPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface QRCode {
  qr_code_id: number;
  location_name: string;
  install_site: string | null;
  installed_at: string;
  status: "active" | "inactive";
}

interface AdminUser {
  user_id: number;
  full_name: string;
  email: string;
  role: "user" | "admin";
  phone: string | null;
  created_at: string;
}

type TabType = "overview" | "qr" | "users" | "feedback";

const CATEGORY_LABELS: Record<string, string> = {
  guidance_clarity: "Guidance Clarity",
  hospital_locator: "Hospital Locator",
  triage_accuracy: "Triage Assessment",
  system_usability: "System Usability",
  general: "General Feedback",
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  low: { bg: "#22c55e18", text: "#16a34a", bar: "#22c55e" },
  moderate: { bg: "#3b82f618", text: "#2563eb", bar: "#3b82f6" },
  urgent: { bg: "#f59e0b18", text: "#d97706", bar: "#f59e0b" },
  critical: { bg: "#ef444418", text: "#dc2626", bar: "#ef4444" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main Component ────────────────────────────────────────────────────────────
function AdminDashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Core records
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Statistics
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Feedback Management
  const [feedbacks, setFeedbacks] = useState<FeedbackResponse[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [filterReviewed, setFilterReviewed] = useState<"all" | "true" | "false">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRating, setFilterRating] = useState<string>("all");
  const [feedbackPage, setFeedbackPage] = useState<number>(0);
  const PAGE_SIZE = 10;

  // Feedback note editing state
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [savingNotesId, setSavingNotesId] = useState<number | null>(null);
  const [togglingReviewId, setTogglingReviewId] = useState<number | null>(null);

  // QR management
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [viewingQr, setViewingQr] = useState<{ location_name: string; image_base64: string } | null>(null);
  const [loadingQrImgId, setLoadingQrImgId] = useState<number | null>(null);

  // Create QR form state (admin only)
  const [showCreate, setShowCreate] = useState(false);
  const [newLocation, setNewLocation] = useState("");
  const [newSite, setNewSite] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const token = getAdminToken();

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoadingStats(true);
    setStatsError(null);
    try {
      const data = await getAdminStats(token);
      setStats(data);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Failed to load system statistics.");
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  const fetchQrCodes = useCallback(async () => {
    if (!token) return;
    setLoadingQr(true);
    try {
      const data = await apiRequest<QRCode[]>("/admin/qr-codes", { token });
      setQrCodes(data);
    } catch {
      /* silent */
    } finally {
      setLoadingQr(false);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const data = await apiRequest<AdminUser[]>("/admin/users", { token });
      setUsers(data);
    } catch {
      /* silent */
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  const fetchFeedbacks = useCallback(async () => {
    if (!token) return;
    setLoadingFeedbacks(true);
    setFeedbackError(null);
    try {
      const params: Parameters<typeof getAdminFeedbacks>[0] = {
        limit: PAGE_SIZE,
        offset: feedbackPage * PAGE_SIZE,
      };
      if (filterReviewed === "true") params.is_reviewed = true;
      if (filterReviewed === "false") params.is_reviewed = false;
      if (filterCategory !== "all") params.category = filterCategory as FeedbackCategory;
      if (filterRating !== "all") params.rating = Number(filterRating);

      const data = await getAdminFeedbacks(params, token);
      setFeedbacks(data);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Failed to load feedback records.");
    } finally {
      setLoadingFeedbacks(false);
    }
  }, [token, feedbackPage, filterReviewed, filterCategory, filterRating]);

  useEffect(() => {
    if (!token) {
      navigate({ to: "/admin/login" });
      return;
    }
    getMe(token)
      .then((me) => {
        setUser(me);
        if (me.role === "admin") {
          fetchStats();
          fetchQrCodes();
          fetchUsers();
        }
      })
      .catch(() => navigate({ to: "/admin/login" }));
  }, [navigate, token, fetchStats, fetchQrCodes, fetchUsers]);

  // Refetch feedback whenever active tab or filters change
  useEffect(() => {
    if (activeTab === "feedback" && user?.role === "admin") {
      fetchFeedbacks();
    }
  }, [activeTab, user?.role, fetchFeedbacks]);

  const promoteUser = async (id: number) => {
    if (!token) return;
    setPromotingId(id);
    try {
      const updated = await apiRequest<AdminUser>(`/admin/users/${id}/promote`, {
        method: "PATCH",
        token,
      });
      setUsers((prev) => prev.map((u) => (u.user_id === id ? updated : u)));
      fetchStats();
    } catch {
      /* silent */
    } finally {
      setPromotingId(null);
    }
  };

  const toggleStatus = async (id: number) => {
    if (!token) return;
    setTogglingId(id);
    try {
      const updated = await apiRequest<QRCode>(`/admin/qr-codes/${id}/toggle`, {
        method: "PATCH",
        token,
      });
      setQrCodes((prev) => prev.map((q) => (q.qr_code_id === id ? updated : q)));
      fetchStats();
    } catch {
      /* silent */
    } finally {
      setTogglingId(null);
    }
  };

  const createQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newLocation.trim()) {
      setCreateError("Location name is required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const created = await apiRequest<QRCode>("/qr", {
        method: "POST",
        body: { location_name: newLocation.trim(), install_site: newSite.trim() || null },
        token,
      });
      setQrCodes((prev) => [created, ...prev]);
      setNewLocation("");
      setNewSite("");
      setShowCreate(false);
      fetchStats();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create QR code.");
    } finally {
      setCreating(false);
    }
  };

  const viewQr = async (id: number, location: string) => {
    setLoadingQrImgId(id);
    try {
      const response = await apiRequest<{ image_base64: string }>(`/qr/${id}/image`);
      setViewingQr({ location_name: location, image_base64: response.image_base64 });
    } catch {
      /* silent */
    } finally {
      setLoadingQrImgId(null);
    }
  };

  // Feedback action: toggle reviewed status
  const handleToggleReviewed = async (fb: FeedbackResponse) => {
    if (!token) return;
    setTogglingReviewId(fb.feedback_id);
    try {
      const updated = await updateFeedbackReview(
        fb.feedback_id,
        { is_reviewed: !fb.is_reviewed },
        token,
      );
      setFeedbacks((prev) =>
        prev.map((item) => (item.feedback_id === fb.feedback_id ? updated : item)),
      );
      fetchStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update review status.");
    } finally {
      setTogglingReviewId(null);
    }
  };

  // Feedback action: save administrator resolution notes
  const handleSaveNotes = async (feedbackId: number) => {
    if (!token) return;
    setSavingNotesId(feedbackId);
    try {
      const updated = await updateFeedbackReview(
        feedbackId,
        { admin_notes: notesDraft.trim() || null },
        token,
      );
      setFeedbacks((prev) =>
        prev.map((item) => (item.feedback_id === feedbackId ? updated : item)),
      );
      setEditingNotesId(null);
      setNotesDraft("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save administrator notes.");
    } finally {
      setSavingNotesId(null);
    }
  };

  if (!user) return null;

  // Calculated or fallback metrics
  const totalUsersCount = stats ? stats.total_users : users.length;
  const totalQrCount = stats ? stats.total_qr_codes : qrCodes.length;
  const activeQrCount = stats ? stats.active_qr_codes : qrCodes.filter((q) => q.status === "active").length;
  const inactiveQrCount = stats ? stats.inactive_qr_codes : qrCodes.filter((q) => q.status === "inactive").length;
  const totalSessionsCount = stats ? stats.total_sessions : 0;
  const totalFeedbackCount = stats ? stats.total_feedback : 0;
  const averageRatingValue = stats ? stats.average_rating : 0.0;
  const unreviewedCount = stats ? stats.unreviewed_feedback : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--card)",
          padding: "0 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield className="size-5 text-white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>
            SmartAid Admin
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
                {user.full_name}
              </span>
              <RoleBadge role={user.role} />
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{user.email}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearAdminToken();
              navigate({ to: "/admin/login" });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* ── Page Title ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--foreground)", margin: 0 }}>
            System Administration
          </h1>
          <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem", fontSize: "0.9rem" }}>
            {user.role === "admin"
              ? "Live system operations, aggregate emergency triage statistics, and quality review management."
              : "Access restricted: Administrator privileges are required to view system records and manage users."}
          </p>
        </div>

        {/* ── Real-Time Aggregate Stats Cards ──────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <StatCard
            label="Total Sessions"
            value={totalSessionsCount}
            subvalue="Triage initiated"
            icon={<Activity className="size-5 text-pink-500" />}
            color="#ec4899"
          />
          <StatCard
            label="User Feedback"
            value={totalFeedbackCount}
            subvalue={`${averageRatingValue.toFixed(1)} ★ average`}
            icon={<Star className="size-5 text-amber-500 fill-amber-400" />}
            color="#f59e0b"
          />
          <StatCard
            label="Pending Review"
            value={unreviewedCount}
            subvalue={unreviewedCount > 0 ? "Requires triage" : "All reviewed"}
            icon={<Clock className="size-5 text-rose-500" />}
            color={unreviewedCount > 0 ? "#ef4444" : "#10b981"}
          />
          <StatCard
            label="Active QR Codes"
            value={`${activeQrCount}/${totalQrCount}`}
            subvalue={`${inactiveQrCount} inactive`}
            icon={<QrIcon className="size-5 text-emerald-500" />}
            color="#22c55e"
          />
          <StatCard
            label="Registered Users"
            value={totalUsersCount}
            subvalue={`${users.filter((u) => u.role === "admin").length} admins`}
            icon={<Users className="size-5 text-indigo-500" />}
            color="#8b5cf6"
          />
        </div>

        {/* ── Tabs Navigation ──────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: "0.25rem",
            background: "var(--secondary)",
            borderRadius: 14,
            padding: "4px",
            marginBottom: "1.5rem",
            width: "fit-content",
          }}
        >
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "feedback", label: "Feedback", badge: unreviewedCount },
              { id: "qr", label: "QR Codes" },
              { id: "users", label: "Users" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.45rem 1.25rem",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                transition: "all 0.15s",
                background: activeTab === tab.id ? "var(--card)" : "transparent",
                color: activeTab === tab.id ? "var(--foreground)" : "var(--muted-foreground)",
                boxShadow: activeTab === tab.id ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
              }}
            >
              <span>{tab.label}</span>
              {"badge" in tab && tab.badge > 0 && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.1rem 0.45rem",
                    borderRadius: 999,
                    background: "#ef4444",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            1. Overview Tab
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Real Stats Breakdown Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
              {/* Severity Breakdown */}
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <SectionTitle>Triage Severity Distribution</SectionTitle>
                  <Activity className="size-4 text-muted-foreground" />
                </div>
                {loadingStats ? (
                  <LoadingRow />
                ) : !stats || Object.keys(stats.sessions_by_severity).length === 0 ? (
                  <EmptyState text="No triage assessments recorded yet." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {(["critical", "urgent", "moderate", "low"] as const).map((sev) => {
                      const count = stats.sessions_by_severity[sev] || 0;
                      const total = stats.total_sessions || 1;
                      const pct = Math.round((count / total) * 100);
                      const style = SEVERITY_COLORS[sev];
                      return (
                        <div key={sev}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.25rem" }}>
                            <span style={{ fontWeight: 600, textTransform: "capitalize", color: style.text }}>
                              {sev}
                            </span>
                            <span style={{ color: "var(--muted-foreground)" }}>
                              {count} sessions ({pct}%)
                            </span>
                          </div>
                          <div style={{ height: "6px", width: "100%", background: "var(--secondary)", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: style.bar, borderRadius: "999px" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Emergency Category Distribution */}
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <SectionTitle>Emergency Categories</SectionTitle>
                  <Layers className="size-4 text-muted-foreground" />
                </div>
                {loadingStats ? (
                  <LoadingRow />
                ) : !stats || Object.keys(stats.sessions_by_category).length === 0 ? (
                  <EmptyState text="No categorized emergencies logged yet." />
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {Object.entries(stats.sessions_by_category).map(([cat, count]) => (
                      <div
                        key={cat}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.4rem 0.8rem",
                          borderRadius: 10,
                          background: "var(--secondary)",
                          fontSize: "0.82rem",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{cat}</span>
                        <span
                          style={{
                            background: "var(--card)",
                            padding: "0.1rem 0.45rem",
                            borderRadius: 6,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "var(--primary)",
                          }}
                        >
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feedback by Category */}
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <SectionTitle>Feedback Submissions by Area</SectionTitle>
                  <MessageSquare className="size-4 text-muted-foreground" />
                </div>
                {loadingStats ? (
                  <LoadingRow />
                ) : !stats || Object.keys(stats.feedback_by_category).length === 0 ? (
                  <EmptyState text="No user feedback received yet." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {Object.entries(stats.feedback_by_category).map(([catKey, count]) => (
                      <div key={catKey} style={rowStyle}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                          {CATEGORY_LABELS[catKey] || catKey}
                        </span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)" }}>
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent QR & Users side-by-side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              {/* Recent QR codes */}
              <div style={cardStyle}>
                <SectionTitle>Recent QR Codes</SectionTitle>
                {loadingQr ? (
                  <LoadingRow />
                ) : qrCodes.length === 0 ? (
                  <EmptyState text="No QR codes yet." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
                    {qrCodes.slice(0, 5).map((q) => (
                      <div key={q.qr_code_id} style={rowStyle}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{q.location_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                            #{q.qr_code_id} · {fmtDate(q.installed_at)}
                          </div>
                        </div>
                        <StatusBadge status={q.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent users */}
              <div style={cardStyle}>
                <SectionTitle>Recent Users</SectionTitle>
                {loadingUsers ? (
                  <LoadingRow />
                ) : users.length === 0 ? (
                  <EmptyState text="No users yet." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
                    {users.slice(0, 5).map((u) => (
                      <div key={u.user_id} style={rowStyle}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{u.full_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{u.email}</div>
                        </div>
                        <RoleBadge role={u.role} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            2. Feedback Management Tab
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "feedback" && (
          <div style={cardStyle}>
            {/* Header & Controls */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
              <div>
                <SectionTitle>User Feedback & Triage Quality</SectionTitle>
                <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", margin: "0.25rem 0 0" }}>
                  Review real user experience reports, first-aid instruction clarity, and record administrator triage notes.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchFeedbacks()}
                disabled={loadingFeedbacks}
                className="gap-2"
              >
                <RefreshCw className={`size-3.5 ${loadingFeedbacks ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
            </div>

            {/* Filter Controls Bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                background: "var(--secondary)",
                borderRadius: 12,
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted-foreground)" }}>Status:</span>
                <select
                  value={filterReviewed}
                  onChange={(e) => {
                    setFilterReviewed(e.target.value as "all" | "true" | "false");
                    setFeedbackPage(0);
                  }}
                  style={selectStyle}
                >
                  <option value="all">All Feedback</option>
                  <option value="false">Pending Review ({unreviewedCount})</option>
                  <option value="true">Reviewed</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted-foreground)" }}>Category:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setFeedbackPage(0);
                  }}
                  style={selectStyle}
                >
                  <option value="all">All Categories</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted-foreground)" }}>Rating:</span>
                <select
                  value={filterRating}
                  onChange={(e) => {
                    setFilterRating(e.target.value);
                    setFeedbackPage(0);
                  }}
                  style={selectStyle}
                >
                  <option value="all">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {feedbackError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1rem",
                  background: "#ef444415",
                  border: "1px solid #ef444430",
                  borderRadius: 10,
                  color: "#dc2626",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{feedbackError}</span>
              </div>
            )}

            {/* Feedback Records List */}
            {loadingFeedbacks ? (
              <LoadingRow />
            ) : feedbacks.length === 0 ? (
              <EmptyState text="No feedback records match the selected filters." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {feedbacks.map((fb) => (
                  <div
                    key={fb.feedback_id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: "1.25rem",
                      background: "var(--card)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* Top Row: Stars, Category, Review Badge, Date */}
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {/* Rating Stars */}
                        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`size-4 ${
                                s <= fb.rating ? "text-amber-500 fill-amber-400" : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                        {/* Category Badge */}
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.6rem",
                            borderRadius: 6,
                            background: "var(--secondary)",
                            color: "var(--foreground)",
                          }}
                        >
                          {CATEGORY_LABELS[fb.category] || fb.category}
                        </span>
                        {/* Review Status Badge */}
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: 999,
                            background: fb.is_reviewed ? "#22c55e18" : "#f59e0b18",
                            color: fb.is_reviewed ? "#16a34a" : "#d97706",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          {fb.is_reviewed ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                          {fb.is_reviewed ? "Reviewed" : "Needs Review"}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                        {fmtDateTime(fb.created_at)}
                      </div>
                    </div>

                    {/* Meta chips: Session, User, Email */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <span style={chipStyle}>
                        Session: {fb.session_id ? `#${fb.session_id}` : "Walk-in (Direct)"}
                      </span>
                      <span style={chipStyle}>
                        User: {fb.user_id ? `User #${fb.user_id}` : "Anonymous"}
                      </span>
                      {fb.contact_email && (
                        <span style={chipStyle}>
                          Email: {fb.contact_email}
                        </span>
                      )}
                    </div>

                    {/* Comments Quote Box */}
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: 10,
                        background: "var(--secondary)",
                        fontSize: "0.85rem",
                        color: fb.comments ? "var(--foreground)" : "var(--muted-foreground)",
                        fontStyle: fb.comments ? "normal" : "italic",
                        marginBottom: "0.75rem",
                        lineHeight: 1.5,
                      }}
                    >
                      {fb.comments || "No written comments submitted."}
                    </div>

                    {/* Admin Notes & Action Bar */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                      {/* Admin Notes Display / Editor */}
                      <div style={{ flex: 1, minWidth: "250px" }}>
                        {editingNotesId === fb.feedback_id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <textarea
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              placeholder="Write administrative resolution or follow-up note..."
                              maxLength={2000}
                              style={{
                                width: "100%",
                                borderRadius: 8,
                                border: "1px solid var(--input)",
                                background: "var(--background)",
                                padding: "0.4rem 0.6rem",
                                fontSize: "0.8rem",
                                outline: "none",
                                resize: "vertical",
                                minHeight: "60px",
                              }}
                            />
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <Button
                                size="sm"
                                onClick={() => handleSaveNotes(fb.feedback_id)}
                                disabled={savingNotesId === fb.feedback_id}
                                className="h-7 text-xs gap-1"
                              >
                                <Check className="size-3" />
                                <span>{savingNotesId === fb.feedback_id ? "Saving…" : "Save Notes"}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNotesId(null);
                                  setNotesDraft("");
                                }}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                              Admin Notes:
                            </span>
                            <span style={{ fontSize: "0.8rem", color: fb.admin_notes ? "var(--foreground)" : "var(--muted-foreground)", fontStyle: fb.admin_notes ? "normal" : "italic" }}>
                              {fb.admin_notes || "None"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNotesId(fb.feedback_id);
                                setNotesDraft(fb.admin_notes || "");
                              }}
                              style={{
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                color: "var(--primary)",
                                padding: "2px",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                              title="Edit administrator notes"
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Review Status Toggle Button */}
                      <div>
                        <Button
                          size="sm"
                          variant={fb.is_reviewed ? "outline" : "default"}
                          onClick={() => handleToggleReviewed(fb)}
                          disabled={togglingReviewId === fb.feedback_id}
                          className="h-8 text-xs gap-1.5"
                        >
                          {fb.is_reviewed ? (
                            <>
                              <X className="size-3.5" />
                              <span>Mark Unreviewed</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="size-3.5" />
                              <span>Mark as Reviewed</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination Controls */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem" }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFeedbackPage((p) => Math.max(0, p - 1))}
                    disabled={feedbackPage === 0 || loadingFeedbacks}
                    className="gap-1 text-xs"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Previous</span>
                  </Button>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                    Page {feedbackPage + 1}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFeedbackPage((p) => p + 1)}
                    disabled={feedbacks.length < PAGE_SIZE || loadingFeedbacks}
                    className="gap-1 text-xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            3. QR Codes Tab
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "qr" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <SectionTitle>All QR Codes ({qrCodes.length})</SectionTitle>
                <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", margin: "0.25rem 0 0" }}>
                  {user.role === "admin"
                    ? "Create and manage QR codes for SmartAid locations."
                    : "View-only. An admin must promote you to create or manage QR codes."}
                </p>
              </div>
              {user.role === "admin" && (
                <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
                  {showCreate ? "Cancel" : "+ New QR Code"}
                </Button>
              )}
            </div>

            {/* Create form — admin only */}
            {user.role === "admin" && showCreate && (
              <form
                onSubmit={createQr}
                style={{
                  background: "var(--secondary)",
                  borderRadius: 12,
                  padding: "1rem",
                  marginBottom: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={labelStyle}>Location Name *</label>
                    <input
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="e.g. Emergency Ward A"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Install Site</label>
                    <input
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      placeholder="e.g. Room 101 wall"
                      style={inputStyle}
                    />
                  </div>
                </div>
                {createError && <p style={{ color: "var(--destructive)", fontSize: "0.8rem", margin: 0 }}>{createError}</p>}
                <Button type="submit" size="sm" style={{ width: "fit-content" }} disabled={creating}>
                  {creating ? "Creating…" : "Create QR Code"}
                </Button>
              </form>
            )}

            {loadingQr ? (
              <LoadingRow />
            ) : qrCodes.length === 0 ? (
              <EmptyState text={user.role === "admin" ? "No QR codes yet. Create one above." : "No QR codes yet."} />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["ID", "Location", "Install Site", "Created", "Status", "Action"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {qrCodes.map((q) => (
                      <tr key={q.qr_code_id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={tdStyle}>#{q.qr_code_id}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{q.location_name}</td>
                        <td style={{ ...tdStyle, color: "var(--muted-foreground)" }}>{q.install_site ?? "—"}</td>
                        <td style={{ ...tdStyle, color: "var(--muted-foreground)" }}>{fmtDate(q.installed_at)}</td>
                        <td style={tdStyle}><StatusBadge status={q.status} /></td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              onClick={() => viewQr(q.qr_code_id, q.location_name)}
                              disabled={loadingQrImgId === q.qr_code_id}
                              style={{
                                fontSize: "0.78rem",
                                padding: "0.3rem 0.75rem",
                                borderRadius: 8,
                                border: "1px solid var(--border)",
                                background: "var(--card)",
                                cursor: "pointer",
                                color: "var(--foreground)",
                                transition: "opacity 0.15s",
                                opacity: loadingQrImgId === q.qr_code_id ? 0.5 : 1,
                              }}
                            >
                              {loadingQrImgId === q.qr_code_id ? "…" : "View QR"}
                            </button>
                            {user.role === "admin" && (
                              <button
                                onClick={() => toggleStatus(q.qr_code_id)}
                                disabled={togglingId === q.qr_code_id}
                                style={{
                                  fontSize: "0.78rem",
                                  padding: "0.3rem 0.75rem",
                                  borderRadius: 8,
                                  border: "1px solid var(--border)",
                                  background: q.status === "active" ? "#f59e0b18" : "#22c55e18",
                                  color: q.status === "active" ? "#d97706" : "#16a34a",
                                  cursor: togglingId === q.qr_code_id ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                  transition: "opacity 0.15s",
                                  opacity: togglingId === q.qr_code_id ? 0.5 : 1,
                                }}
                              >
                                {togglingId === q.qr_code_id
                                  ? "Updating…"
                                  : q.status === "active"
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            4. Users Tab
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "users" && (
          <div style={cardStyle}>
            <SectionTitle>Registered Users ({users.length})</SectionTitle>
            <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", margin: "0.25rem 0 1rem" }}>
              {user.role === "admin"
                ? "Promote users to admin to grant system configuration privileges."
                : "View-only. Administrator privileges are required to promote users."}
            </p>

            {loadingUsers ? (
              <LoadingRow />
            ) : users.length === 0 ? (
              <EmptyState text="No users yet." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["ID", "Full Name", "Email", "Phone", "Role", "Joined", ...(user.role === "admin" ? ["Action"] : [])].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ ...tdStyle, color: "var(--muted-foreground)" }}>#{u.user_id}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{u.full_name}</td>
                        <td style={{ ...tdStyle, color: "var(--muted-foreground)" }}>{u.email}</td>
                        <td style={{ ...tdStyle, color: "var(--muted-foreground)" }}>{u.phone ?? "—"}</td>
                        <td style={tdStyle}><RoleBadge role={u.role} /></td>
                        <td style={{ ...tdStyle, color: "var(--muted-foreground)" }}>{fmtDate(u.created_at)}</td>
                        {user.role === "admin" && (
                          <td style={tdStyle}>
                            {u.role === "user" ? (
                              <button
                                onClick={() => promoteUser(u.user_id)}
                                disabled={promotingId === u.user_id}
                                style={{
                                  fontSize: "0.78rem",
                                  padding: "0.3rem 0.85rem",
                                  borderRadius: 8,
                                  border: "1px solid #22c55e",
                                  background: "#22c55e18",
                                  cursor: promotingId === u.user_id ? "not-allowed" : "pointer",
                                  color: "#16a34a",
                                  fontWeight: 600,
                                  transition: "opacity 0.15s",
                                  opacity: promotingId === u.user_id ? 0.5 : 1,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {promotingId === u.user_id ? "Promoting…" : "Promote to Admin"}
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {viewingQr && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setViewingQr(null)}
        >
          <div
            style={{
              background: "var(--card)",
              padding: "2.5rem",
              borderRadius: 24,
              textAlign: "center",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              maxWidth: "90vw",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: "1.5rem", color: "var(--foreground)", fontSize: "1.25rem" }}>
              QR Code: {viewingQr.location_name}
            </h3>

            <div style={{ padding: "1rem", background: "white", borderRadius: 16, display: "inline-block", marginBottom: "2rem" }}>
              <img
                src={`data:image/png;base64,${viewingQr.image_base64}`}
                alt="QR Code"
                style={{ width: 200, height: 200, display: "block" }}
              />
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Button variant="outline" onClick={() => setViewingQr(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = `data:image/png;base64,${viewingQr.image_base64}`;
                  link.download = `QR_${viewingQr.location_name.replace(/\s+/g, "_")}.png`;
                  link.click();
                }}
              >
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  subvalue,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  subvalue?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.25rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--foreground)", lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
          {label}
        </div>
        {subvalue && (
          <div style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", opacity: 0.8, marginTop: "0.15rem" }}>
            {subvalue}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)", margin: 0, ...style }}>
      {children}
    </h2>
  );
}

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        padding: "0.2rem 0.6rem",
        borderRadius: 999,
        background: status === "active" ? "#22c55e22" : "#f59e0b22",
        color: status === "active" ? "#16a34a" : "#d97706",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: "user" | "admin" }) {
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        padding: "0.2rem 0.6rem",
        borderRadius: 999,
        background: role === "admin" ? "#ef444422" : "#8b5cf622",
        color: role === "admin" ? "#dc2626" : "#7c3aed",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {role}
    </span>
  );
}

function LoadingRow() {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
      Loading…
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
      {text}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: "1.5rem",
  boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.6rem 0.75rem",
  borderRadius: 10,
  background: "var(--secondary)",
};

const chipStyle: React.CSSProperties = {
  fontSize: "0.74rem",
  fontWeight: 500,
  padding: "0.2rem 0.55rem",
  borderRadius: 6,
  background: "var(--secondary)",
  color: "var(--muted-foreground)",
};

const selectStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  padding: "0.3rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  outline: "none",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.875rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem 0.75rem",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "var(--muted-foreground)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "2px solid var(--border)",
};

const tdStyle: React.CSSProperties = {
  padding: "0.75rem",
  verticalAlign: "middle",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--foreground)",
  display: "block",
  marginBottom: "0.35rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--input)",
  background: "var(--background)",
  padding: "0.55rem 0.875rem",
  fontSize: "0.875rem",
  outline: "none",
  color: "var(--foreground)",
  boxSizing: "border-box",
};