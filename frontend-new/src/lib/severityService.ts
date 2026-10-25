import { apiRequest } from "./api";

export interface SeverityPredictionResponse {
  prediction_id: number;
  session_id: number;
  emergency_type: string | null;
  severity_level: "low" | "moderate" | "urgent" | "critical";
  confidence_score: number;
  reasoning: string;
  vitals_estimated?: boolean;
  predicted_at: string;
}

export function predictSeverity(sessionId: number): Promise<SeverityPredictionResponse> {
  return apiRequest<SeverityPredictionResponse>(`/sessions/${sessionId}/predict`, {
    method: "POST",
  });
}
