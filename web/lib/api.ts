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
export interface Channel {
  id: number
  name: string
  description?: string
  ntfy_topic: string
  timezone: string
  enabled: boolean
  created_at: string
}

export interface Reminder {
  id: number
  title: string
  body?: string
  cron: string
  timezone: string
  enabled: boolean
  created_at?: string
  channels: Channel[]
}

// Legacy types (deprecated - for backward compatibility during migration)
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

// Channels API (replaces both Users and AlertChannels)
export const channelsApi = {
  list: (): Promise<Channel[]> => fetchApi('/api/channels'),
  
  get: (id: number): Promise<Channel> => fetchApi(`/api/channels/${id}`),
  
  create: (data: Omit<Channel, 'id' | 'enabled' | 'created_at'>): Promise<Channel> =>
    fetchApi('/api/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: Partial<Omit<Channel, 'id' | 'created_at'>>): Promise<Channel> =>
    fetchApi(`/api/channels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number): Promise<{ detail: string }> =>
    fetchApi(`/api/channels/${id}`, { method: 'DELETE' }),
}

// Legacy Users API (deprecated - use channelsApi instead)
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
  list: (): Promise<Reminder[]> => fetchApi('/api/reminders'),
  
  get: (id: number): Promise<Reminder> => fetchApi(`/api/reminders/${id}`),
  
  create: (data: {
    title: string
    body?: string
    cron: string
    timezone: string
    channel_ids: number[]
  }): Promise<Reminder> =>
    fetchApi('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: Partial<{
    title: string
    body?: string
    cron: string
    timezone: string
    channel_ids: number[]
    enabled: boolean
  }>): Promise<Reminder> =>
    fetchApi(`/api/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number): Promise<{ detail: string }> =>
    fetchApi(`/api/reminders/${id}`, { method: 'DELETE' }),
}

// Legacy Alert Channels API (deprecated - use channelsApi instead)
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
export const testNotification = (channelId: number, title: string, body?: string): Promise<{ ok: boolean }> =>
  fetchApi('/api/notifications/test', {
    method: 'POST',
    body: JSON.stringify({ channel_id: channelId, title, body }),
  })

// AI-powered reminder types
export interface AIReminderInput {
  channel_ids: number[]
  timezone: string
  natural_language: string
}

export interface AIReminderParsed {
  title: string
  body?: string
  cron: string
  schedule_description: string
  confidence: 'high' | 'medium' | 'low'
  next_execution?: string
}

// AI-powered reminder API
export const aiRemindersApi = {
  parse: (data: AIReminderInput): Promise<AIReminderParsed> =>
    fetchApi('/api/reminders/ai/parse', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  create: (data: AIReminderInput): Promise<Reminder> =>
    fetchApi('/api/reminders/ai/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
