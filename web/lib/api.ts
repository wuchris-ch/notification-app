const rawBase = process.env.NEXT_PUBLIC_API_BASE?.trim()

function fallbackBase(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin.replace(/\/$/, "")}/api`
  }
  return "http://localhost:8000"
}

function normalizeAbsolute(base: string): string | null {
  try {
    const url = new URL(base)
    if (typeof window !== "undefined" && url.hostname === "proxy") {
      return null
    }
    const normalizedPath = url.pathname.replace(/\/$/, "")
    return `${url.origin}${normalizedPath}`
  } catch (_) {
    return null
  }
}

function normalizeRelative(base: string): string {
  const trimmed = base.replace(/\/$/, "")
  if (typeof window !== "undefined") {
    return `${window.location.origin.replace(/\/$/, "")}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`
  }
  const prefix = "http://localhost:8000"
  return `${prefix}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`
}

export function getApiBase(): string {
  if (rawBase) {
    const trimmed = rawBase.replace(/\s+/g, "").replace(/\/$/, "")
    if (trimmed) {
      if (/^https?:\/\//i.test(trimmed)) {
        const normalized = normalizeAbsolute(trimmed)
        if (normalized) {
          return normalized
        }
        // fall through to fallback if normalization failed (e.g. proxy hostname)
      } else {
        return normalizeRelative(trimmed)
      }
    }
  }
  return fallbackBase()
}

export function apiUrl(path: string): string {
  const base = getApiBase()
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${base}${suffix}`
}

// Types
export interface User {
  id: number
  name: string
  ntfy_topic: string
  timezone: string
}

export interface AlertChannel {
  id: number
  name: string
  description?: string
  ntfy_topic: string
  enabled: boolean
  created_at: string
}

export interface Reminder {
  id: number
  user_id: number
  alert_channel_id?: number
  title: string
  body?: string
  cron: string
  enabled: boolean
  created_at?: string
}

export interface DeliveryLog {
  id: number
  reminder_id: number
  sent_at: string
  status: string
  detail: string
}

// API Functions
async function fetchApi(endpoint: string, options?: RequestInit) {
  const response = await fetch(apiUrl(endpoint), {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

// Users API
export const usersApi = {
  list: (): Promise<User[]> => fetchApi('/users'),
  
  get: (id: number): Promise<User> => fetchApi(`/users/${id}`),
  
  create: (data: Omit<User, 'id'>): Promise<User> => 
    fetchApi('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: Partial<Omit<User, 'id'>>): Promise<User> => 
    fetchApi(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number): Promise<{ detail: string }> => 
    fetchApi(`/users/${id}`, { method: 'DELETE' }),
}

// Reminders API
export const remindersApi = {
  list: (userId?: number): Promise<Reminder[]> => {
    const params = userId ? `?user_id=${userId}` : ''
    return fetchApi(`/reminders${params}`)
  },
  
  get: (id: number): Promise<Reminder> => fetchApi(`/reminders/${id}`),
  
  create: (data: Omit<Reminder, 'id' | 'enabled' | 'created_at'>): Promise<Reminder> => 
    fetchApi('/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: Partial<Omit<Reminder, 'id' | 'created_at'>>): Promise<Reminder> => 
    fetchApi(`/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number): Promise<{ detail: string }> => 
    fetchApi(`/reminders/${id}`, { method: 'DELETE' }),
}

// Alert Channels API
export const alertChannelsApi = {
  list: (): Promise<AlertChannel[]> => fetchApi('/alert-channels'),
  
  get: (id: number): Promise<AlertChannel> => fetchApi(`/alert-channels/${id}`),
  
  create: (data: Omit<AlertChannel, 'id' | 'enabled' | 'created_at'>): Promise<AlertChannel> => 
    fetchApi('/alert-channels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: Partial<Omit<AlertChannel, 'id' | 'created_at'>>): Promise<AlertChannel> => 
    fetchApi(`/alert-channels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number): Promise<{ detail: string }> => 
    fetchApi(`/alert-channels/${id}`, { method: 'DELETE' }),
}

// Delivery Logs API
export const logsApi = {
  list: (reminderId?: number, limit = 50): Promise<DeliveryLog[]> => {
    const params = new URLSearchParams()
    if (reminderId) params.append('reminder_id', reminderId.toString())
    if (limit) params.append('limit', limit.toString())
    const queryString = params.toString()
    return fetchApi(`/logs${queryString ? `?${queryString}` : ''}`)
  }
}

// Test notification
export const testNotification = (userId: number, title: string, body?: string): Promise<{ ok: boolean }> =>
  fetchApi('/notifications/test', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, title, body }),
  })
