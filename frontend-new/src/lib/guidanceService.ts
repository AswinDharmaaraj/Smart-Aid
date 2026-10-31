import { apiRequest } from "./api";

export interface FirstAidStep {
  title: string;
  detail: string;
}

export interface FirstAidGuideResponse {
  session_id: number;
  emergency_category: string;
  severity_level: "low" | "moderate" | "urgent" | "critical";
  /** When true the UI must display a prominent "Call 112" action. */
  call_emergency: boolean;
  severity_note: string;
  steps: FirstAidStep[];
  precautions: string[];
  avoid: string[];
  disclaimer: string;
}

/**
 * Fetch personalised first-aid guidance from the backend.
 *
 * Requires that POST /sessions/{id}/predict has already been called for this
 * session.  Returns the backend guide or throws on network / server error.
 *
 * Callers should catch and fall back to the hardcoded static guidance so the
 * app remains functional offline or when the backend is unavailable.
 */
export function fetchGuidance(
  sessionId: number
): Promise<FirstAidGuideResponse> {
  return apiRequest<FirstAidGuideResponse>(
    `/sessions/${sessionId}/guidance`,
    { method: "GET" }
  );
}
