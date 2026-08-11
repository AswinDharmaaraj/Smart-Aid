const API_BASE_URL = "http://localhost:8000/api/v1"

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string | null
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("smartaid:unauthorized"))
    }
    const errorData = await response.json().catch(() => ({ detail: "Something went wrong" }))
    throw new Error(errorData.detail || `Request failed with status ${response.status}`)
  }

  return response.json()
}