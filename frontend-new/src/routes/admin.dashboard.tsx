import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getAdminToken, clearAdminToken } from "@/lib/adminAuth";
import { getMe, type UserResponse } from "@/lib/authService";
import { apiRequest } from "@/lib/api";

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Main Component ────────────────────────────────────────────────────────────
function AdminDashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "qr" | "users">("overview");
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [viewingQr, setViewingQr] = useState<{ location_name: string, image_base64: string } | null>(null);
  const [loadingQrImgId, setLoadingQrImgId] = useState<number | null>(null);

  // Create QR form state (admin only)
  const [showCreate, setShowCreate] = useState(false);
  const [newLocation, setNewLocation] = useState("");
  const [newSite, setNewSite] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const token = getAdminToken();

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

  useEffect(() => {
    if (!token) {
      navigate({ to: "/admin/login" });
      return;
    }
    getMe(token)
      .then((me) => {
        setUser(me);
        fetchQrCodes();
        fetchUsers();
      })
      .catch(() => navigate({ to: "/admin/login" }));
  }, [navigate, token, fetchQrCodes, fetchUsers]);

  const promoteUser = async (id: number) => {
    if (!token) return;
    setPromotingId(id);
    try {
      const updated = await apiRequest<AdminUser>(`/admin/users/${id}/promote`, {
        method: "PATCH",
        token,
      });
      setUsers((prev) => prev.map((u) => (u.user_id === id ? updated : u)));
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

  if (!user) return null;

  const activeQr = qrCodes.filter((q) => q.status === "active").length;
  const inactiveQr = qrCodes.filter((q) => q.status === "inactive").length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const userCount = users.filter((u) => u.role === "user").length;

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
          {/* Icon */}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>Admin Panel</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>{user.full_name}</span>
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
            Dashboard
          </h1>
          <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem", fontSize: "0.9rem" }}>
            {user.role === "admin"
              ? "View QR codes and manage users — promote users to admin to grant full access."
              : "You have view-only access. An admin must promote you to enable management features."}
          </p>
        </div>

        {/* ── Stats Cards ──────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <StatCard label="Total QR Codes" value={qrCodes.length} icon="🔳" color="#22c55e" />
          <StatCard label="Active QR Codes" value={activeQr} icon="✅" color="#3b82f6" />
          <StatCard label="Inactive QR Codes" value={inactiveQr} icon="🚫" color="#f59e0b" />
          <StatCard label="Total Users" value={users.length} icon="👥" color="#8b5cf6" />
          <StatCard label="Admin Users" value={adminCount} icon="🛡️" color="#ef4444" />
          <StatCard label="Regular Users" value={userCount} icon="👤" color="#06b6d4" />
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
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
          {(["overview", "qr", "users"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.45rem 1.25rem",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                transition: "all 0.15s",
                background: activeTab === tab ? "var(--card)" : "transparent",
                color: activeTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
              }}
            >
              {tab === "overview" ? "Overview" : tab === "qr" ? "QR Codes" : "Users"}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
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
        )}

        {/* ── QR Codes Tab ─────────────────────────────────────────────── */}
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
                            {/* View QR — available to everyone */}
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
                            {/* Activate/Deactivate — admin only */}
                            {user.role === "admin" && (
                              <button
                                onClick={() => toggleStatus(q.qr_code_id)}
                                disabled={togglingId === q.qr_code_id}
                                style={{
                                  fontSize: "0.78rem",
                                  padding: "0.3rem 0.75rem",
                                  borderRadius: 8,
                                  border: "1px solid var(--border)",
                                  background: "var(--card)",
                                  cursor: "pointer",
                                  color: "var(--foreground)",
                                  transition: "opacity 0.15s",
                                  opacity: togglingId === q.qr_code_id ? 0.5 : 1,
                                }}
                              >
                                {togglingId === q.qr_code_id
                                  ? "…"
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

        {/* ── Users Tab ────────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div style={cardStyle}>
            <div style={{ marginBottom: "1rem" }}>
              <SectionTitle>All Users ({users.length})</SectionTitle>
              <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", margin: "0.35rem 0 0" }}>
                Promote regular users to admin to grant them full QR code management access.
              </p>
            </div>
            {loadingUsers ? (
              <LoadingRow />
            ) : users.length === 0 ? (
              <EmptyState text="No registered users." />
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
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)"
        }} onClick={() => setViewingQr(null)}>
          <div style={{
            background: "var(--card)", padding: "2.5rem", borderRadius: 24, textAlign: "center",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)", maxWidth: "90vw", border: "1px solid var(--border)"
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: "1.5rem", color: "var(--foreground)", fontSize: "1.25rem" }}>
              QR Code: {viewingQr.location_name}
            </h3>

            <div style={{ padding: "1rem", background: "white", borderRadius: 16, display: "inline-block", marginBottom: "2rem" }}>
              <img src={`data:image/png;base64,${viewingQr.image_base64}`} alt="QR Code" style={{ width: 200, height: 200, display: "block" }} />
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Button variant="outline" onClick={() => setViewingQr(null)}>Close</Button>
              <Button onClick={() => {
                const link = document.createElement("a");
                link.href = `data:image/png;base64,${viewingQr.image_base64}`;
                link.download = `QR_${viewingQr.location_name.replace(/\s+/g, "_")}.png`;
                link.click();
              }}>
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
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
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
          fontSize: "1.5rem",
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
        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--foreground)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: "0.2rem" }}>{label}</div>
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