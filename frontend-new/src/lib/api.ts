import { getAdminToken } from "./adminAuth";

const API_BASE_URL = "/api/v1";

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null | undefined;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Use explicitly passed token, or fall back to signed-in user/admin token
  const effectiveToken = token !== undefined ? token : getAdminToken();
  if (effectiveToken) {
    headers["Authorization"] = `Bearer ${effectiveToken}`;
  }

  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("smartaid:unauthorized"));
    }
    const errorData = await response.json().catch(() => ({ detail: "Something went wrong" }));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}
