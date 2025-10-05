"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"

import { usersApi, User } from "../../lib/api"

type TimezoneOption = {
  value: string
  label: string
}

const timezoneOptions: TimezoneOption[] = [
  { value: "America/Vancouver", label: "Pacific - Vancouver" },
  { value: "America/Los_Angeles", label: "Pacific - Los Angeles" },
  { value: "America/Denver", label: "Mountain - Denver" },
  { value: "America/Chicago", label: "Central - Chicago" },
  { value: "America/New_York", label: "Eastern - New York" },
  { value: "Europe/London", label: "UK - London" },
  { value: "Europe/Paris", label: "Europe - Paris" },
  { value: "Australia/Sydney", label: "Australia - Sydney" },
  { value: "custom", label: "Enter another timezone..." },
]

function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

interface EditUserFormProps {
  user: User
  onSave: (user: User) => void
  onCancel: () => void
  submitting: boolean
  setUser: (user: User) => void
}

function EditUserForm({ user, onSave, onCancel, submitting, setUser }: EditUserFormProps) {
  const updateField = (field: keyof User, value: string) => {
    setUser({ ...user, [field]: value })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={user.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Topic</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={user.ntfy_topic}
          onChange={(e) => updateField('ntfy_topic', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Timezone</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={user.timezone}
          onChange={(e) => updateField('timezone', e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(user)}
          disabled={submitting}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs bg-slate-600 text-white px-3 py-1 rounded hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [topic, setTopic] = useState("")
  const [topicTouched, setTopicTouched] = useState(false)
  const [timezoneChoice, setTimezoneChoice] = useState("America/Vancouver")
  const [customTimezone, setCustomTimezone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const effectiveTimezone = useMemo(
    () => (timezoneChoice === "custom" ? customTimezone.trim() : timezoneChoice),
    [timezoneChoice, customTimezone],
  )

  useEffect(() => {
    void loadUsers("initial")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!name) {
      setTopicTouched(false)
      setTopic("")
      return
    }
    if (!topicTouched) {
      const suggestion = slugifyName(name)
      setTopic(suggestion ? `family-${suggestion}` : "")
    }
  }, [name, topicTouched])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 4000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const loadUsers = async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    try {
      setError(null)
      const userData = await usersApi.list()
      setUsers(userData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load users")
    } finally {
      if (mode === "initial") {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const timezone = effectiveTimezone
    if (!timezone) {
      setError("Select a timezone or enter a valid one")
      return
    }

    setSubmitting(true)
    setFeedback(null)
    setError(null)

    try {
      const created = await usersApi.create({
        name: name.trim(),
        ntfy_topic: topic.trim(),
        timezone,
      })
      setFeedback(`Added ${created.name}.`)
      setName("")
      setTopic("")
      setTopicTouched(false)
      setTimezoneChoice("America/Vancouver")
      setCustomTimezone("")
      void loadUsers("refresh")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to create user")
    } finally {
      setSubmitting(false)
    }
  }

  const updateUser = async (user: User) => {
    setSubmitting(true)
    setError(null)

    try {
      await usersApi.update(user.id, {
        name: user.name,
        ntfy_topic: user.ntfy_topic,
        timezone: user.timezone,
      })
      setFeedback(`Updated ${user.name}.`)
      setEditingUser(null)
      void loadUsers("refresh")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to update user")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteUser = async (userId: number) => {
    setDeleting(userId)
    setError(null)

    try {
      await usersApi.delete(userId)
      setFeedback("User deleted successfully.")
      void loadUsers("refresh")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to delete user")
    } finally {
      setDeleting(null)
    }
  }

  const timezoneHelperText =
    timezoneChoice === "custom"
      ? "Use the exact tz database name, e.g. Europe/Berlin or Asia/Tokyo."
      : "Reminders will go out in this timezone."

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-6 sm:p-10">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Family Members</h1>
            <p className="text-sm text-slate-600 mt-1">
              Add each person who should receive reminders. Each person gets their own personal notification topic.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              💡 <strong>Tip:</strong> Each person subscribes to their personal topic on their phone (e.g., "family-mom"). For group notifications, create an Alert Channel that multiple people can subscribe to.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            onClick={() => void loadUsers("refresh")}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        <form onSubmit={createUser} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Person&apos;s name</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                placeholder="Alex"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Personal ntfy topic</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                placeholder="family-alex"
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value)
                  setTopicTouched(true)
                }}
                required
              />
              <p className="text-xs text-slate-500">
                This person subscribes to this topic on their ntfy app to receive personal reminders. We&apos;ll suggest one from their name.
              </p>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Timezone</span>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                value={timezoneChoice}
                onChange={(event) => setTimezoneChoice(event.target.value)}
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">{timezoneHelperText}</p>
            </label>

            {timezoneChoice === "custom" ? (
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Custom timezone</span>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                  placeholder="Europe/Berlin"
                  value={customTimezone}
                  onChange={(event) => setCustomTimezone(event.target.value)}
                  required
                />
              </label>
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">Personal reminders will be sent to their topic. Their timezone is used for scheduling all their reminders.</p>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Add person"}
            </button>
          </div>
        </form>

        {feedback ? <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{feedback}</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Current users</h2>
          {loading ? null : <span className="text-sm text-slate-500">{users.length} total</span>}
        </div>

        {loading ? (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            No users yet. Add your first family member above. Each person will get their own personal notification topic for individual reminders.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {users.map((user) => (
              <li key={user.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                {editingUser?.id === user.id ? (
                  <EditUserForm 
                    user={editingUser}
                    onSave={updateUser}
                    onCancel={() => setEditingUser(null)}
                    submitting={submitting}
                    setUser={setEditingUser}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-medium text-slate-900">{user.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Timezone</p>
                        <p className="text-sm text-slate-700">{user.timezone}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">ID #{user.id}</span>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">
                      Personal topic:
                      <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">{user.ntfy_topic}</code>
                      <p className="text-xs text-slate-500 mt-1">Subscribe to this on the ntfy app</p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingUser(user)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser(user.id)}
                        disabled={deleting === user.id}
                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deleting === user.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
