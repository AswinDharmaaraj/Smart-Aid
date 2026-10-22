import { apiRequest } from "./api";

export type FeedbackCategory =
  | "guidance_clarity"
  | "hospital_locator"
  | "triage_accuracy"
  | "system_usability"
  | "general";

export interface FeedbackCreate {
  session_id?: number | null;
  rating: number;
  category: FeedbackCategory;
  comments?: string | null;
  contact_email?: string | null;
}

export interface FeedbackResponse {
  feedback_id: number;
  session_id: number | null;
  user_id: number | null;
  rating: number;
  category: FeedbackCategory;
  comments: string | null;
  contact_email: string | null;
  is_reviewed: boolean;
  admin_notes: string | null;
  created_at: string;
}

export interface AdminStatsResponse {
  total_users: number;
  total_qr_codes: number;
  active_qr_codes: number;
  inactive_qr_codes: number;
  total_sessions: number;
  sessions_by_severity: Record<string, number>;
  sessions_by_category: Record<string, number>;
  total_feedback: number;
  average_rating: number;
  feedback_by_category: Record<string, number>;
  reviewed_feedback: number;
  unreviewed_feedback: number;
}

export interface FeedbackAdminUpdate {
  is_reviewed?: boolean;
  admin_notes?: string | null;
}

export interface FeedbackFilterParams {
  is_reviewed?: boolean;
  category?: FeedbackCategory;
  rating?: number;
  limit?: number;
  offset?: number;
}

/**
 * Submit user or guest feedback on first-aid guidance and system usability.
 * Supports anonymous submission or authenticated user context.
 */
export async function submitFeedback(
  data: FeedbackCreate,
  token?: string | null,
): Promise<FeedbackResponse> {
  const payload: Record<string, unknown> = {
    rating: data.rating,
    category: data.category,
  };
  if (data.session_id !== undefined && data.session_id !== null) {
    payload.session_id = data.session_id;
  }
  if (data.comments && data.comments.trim()) {
    payload.comments = data.comments.trim();
  }
  if (data.contact_email && data.contact_email.trim()) {
    payload.contact_email = data.contact_email.trim();
  }

  return apiRequest<FeedbackResponse>("/feedback", {
    method: "POST",
    body: payload,
    token,
  });
}

/**
 * Fetch high-level administrative statistics across users, QR codes, sessions, and feedback.
 */
export async function getAdminStats(token: string): Promise<AdminStatsResponse> {
  return apiRequest<AdminStatsResponse>("/admin/stats", { token });
}

/**
 * List submitted feedback items with optional filtering and bounded pagination.
 */
export async function getAdminFeedbacks(
  params: FeedbackFilterParams = {},
  token: string,
): Promise<FeedbackResponse[]> {
  const searchParams = new URLSearchParams();
  if (params.is_reviewed !== undefined) {
    searchParams.set("is_reviewed", String(params.is_reviewed));
  }
  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.rating) {
    searchParams.set("rating", String(params.rating));
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  const qs = searchParams.toString();
  const endpoint = qs ? `/admin/feedback?${qs}` : "/admin/feedback";
  return apiRequest<FeedbackResponse[]>(endpoint, { token });
}

/**
 * Update administrative review status and internal resolution notes for a feedback entry.
 */
export async function updateFeedbackReview(
  feedbackId: number,
  data: FeedbackAdminUpdate,
  token: string,
): Promise<FeedbackResponse> {
  return apiRequest<FeedbackResponse>(`/admin/feedback/${feedbackId}`, {
    method: "PATCH",
    body: data,
    token,
  });
}
