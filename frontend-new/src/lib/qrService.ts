import { apiRequest } from "./api"

export interface SessionResponse {
  session_id: number
  qr_code_id: number
  network_mode: string
  started_at: string
}

export function startSession(qrCodeId: number): Promise<SessionResponse> {
  return apiRequest<SessionResponse>(`/qr/${qrCodeId}/session`)
}

export function updateNetworkMode(sessionId: number, mode: "online" | "offline"): Promise<SessionResponse> {
  return apiRequest<SessionResponse>(`/qr/sessions/${sessionId}/network-mode?mode=${mode}`, {
    method: "PATCH",
  })
}