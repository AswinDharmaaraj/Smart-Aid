import { apiRequest } from "./api"

export interface SymptomInputPayload {
  raw_text: string
  category?: string
}

export interface SymptomInputResponse {
  input_id: number
  session_id: number
  raw_text: string
  category: string | null
  submitted_at: string
}

export function saveSymptomInput(sessionId: number, payload: SymptomInputPayload): Promise<SymptomInputResponse> {
  return apiRequest<SymptomInputResponse>(`/sessions/${sessionId}/symptoms`, {
    method: "POST",
    body: payload,
  })
}