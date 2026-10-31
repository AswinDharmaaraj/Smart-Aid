import { apiRequest } from "./api";

/**
 * A single entry returned by GET /api/v1/users/me/history.
 * Fields match backend app/schemas/history.py HistoryEntry exactly.
 */
export interface HistoryEntry {
  session_id: number;
  started_at: string;            // ISO-8601 datetime string
  category: string | null;
  raw_text: string | null;
  severity_level: "low" | "moderate" | "urgent" | "critical" | null;
  confidence_score: number | null;
}

/**
 * Fetch the authenticated user's emergency session history.
 * Requires a valid Bearer token.
 *
 * Throws if the request fails (401 = expired/missing token, network error, etc.).
 * The caller is responsible for handling each case.
 */
export async function getMyHistory(token: string): Promise<HistoryEntry[]> {
  return apiRequest<HistoryEntry[]>("/users/me/history", { token });
}
