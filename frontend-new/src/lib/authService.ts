import { apiRequest } from "./api"

export interface RegisterPayload {
    full_name: string
    email: string
    password: string
    phone?: string
    role?: "user" | "admin"
}

export interface LoginPayload {
    email: string
    password: string
}

export interface TokenResponse {
    access_token: string
    token_type: string
}

export interface UserResponse {
    user_id: number
    full_name: string
    email: string
    role: "user" | "admin"
    phone: string | null
    created_at: string
}

export function register(payload: RegisterPayload): Promise<UserResponse> {
    return apiRequest<UserResponse>("/auth/register", { method: "POST", body: payload })
}

export function login(payload: LoginPayload): Promise<TokenResponse> {
    return apiRequest<TokenResponse>("/auth/login", { method: "POST", body: payload })
}

export function getMe(token: string): Promise<UserResponse> {
    return apiRequest<UserResponse>("/auth/me", { token })
}