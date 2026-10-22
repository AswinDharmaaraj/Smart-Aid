import { apiRequest } from "./api";

export interface ReportQRInfo {
  qr_code_id: number;
  location_name: string;
  install_site?: string | null;
}

export interface ReportSymptomInfo {
  input_id: number;
  raw_text: string;
  category?: string | null;
  submitted_at: string;
}

export interface ReportPredictionInfo {
  prediction_id: number;
  emergency_type?: string | null;
  severity_level: "low" | "moderate" | "urgent" | "critical";
  confidence_score: number;
  reasoning: string;
  vitals_estimated: boolean;
  predicted_at: string;
}

export interface ReportFirstAidStep {
  title: string;
  detail: string;
}

export interface ReportGuidanceInfo {
  emergency_category: string;
  severity_level: string;
  call_emergency: boolean;
  severity_note: string;
  steps: ReportFirstAidStep[];
  precautions: string[];
  avoid: string[];
}

export interface IncidentReportResponse {
  report_id: string;
  session_id: number;
  started_at: string;
  network_mode: string;
  qr_info?: ReportQRInfo | null;
  symptoms?: ReportSymptomInfo | null;
  prediction?: ReportPredictionInfo | null;
  guidance?: ReportGuidanceInfo | null;
  disclaimer: string;
}

/**
 * Fetch the official incident report for an emergency session from the backend.
 * Pass token when accessing authenticated user-bound sessions.
 */
export async function getIncidentReport(
  sessionId: number,
  token?: string | null,
): Promise<IncidentReportResponse> {
  return apiRequest<IncidentReportResponse>(`/sessions/${sessionId}/report`, { token });
}
