const KEY = "smartaid.backend_session_id";

export function setBackendSessionId(id: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, String(id));
}

export function getBackendSessionId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  return raw ? Number(raw) : null;
}

export function clearBackendSessionId() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}