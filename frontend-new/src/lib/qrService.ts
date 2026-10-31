import { apiRequest } from "./api"

/**
 * Well-known QR code ID seeded by the Alembic migration
 * `c4e8a1f02d73_seed_direct_start_qr_code`. Used by the homepage
 * "Start assessment" and scan-page "Continue without scanning" buttons
 * so that direct-start sessions are registered in the DB exactly like
 * QR-scanned sessions.
 */
export const DIRECT_START_QR_CODE_ID = 1

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