"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { channelsApi, remindersApi, Channel, Reminder } from "../../lib/api"

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

interface EditChannelFormProps {
  channel: Channel
  onSave: (channel: Channel) => void
  onCancel: () => void
  submitting: boolean
  setChannel: (channel: Channel) => void
}

function EditChannelForm({ channel, onSave, onCancel, submitting, setChannel }: EditChannelFormProps) {
  const updateField = (field: keyof Channel, value: string | boolean) => {
    setChannel({ ...channel, [field]: value })
  }

  return (
    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={channel.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={channel.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">NTFY Topic</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm font-mono"
          value={channel.ntfy_topic}
          onChange={(e) => updateField('ntfy_topic', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Timezone</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={channel.timezone}
          onChange={(e) => updateField('timezone', e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`enabled-${channel.id}`}
          checked={channel.enabled}
          onChange={(e) => updateField('enabled', e.target.checked)}
          className="rounded"
        />
        <label htmlFor={`enabled-${channel.id}`} className="text-xs font-medium text-slate-700">
          Enabled
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(channel)}
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

export default function Channels() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [topic, setTopic] = useState("")
  const [topicTouched, setTopicTouched] = useState(false)
  const [timezoneChoice, setTimezoneChoice] = useState("America/Vancouver")
  const [customTimezone, setCustomTimezone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const effectiveTimezone = useMemo(
    () => (timezoneChoice === "custom" ? customTimezone.trim() : timezoneChoice),
    [timezoneChoice, customTimezone],
  )

  useEffect(() => {
    void loadData("initial")
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

  const loadData = async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    try {
      setError(null)
      const [channelsData, remindersData] = await Promise.all([
        channelsApi.list(),
        remindersApi.list()
      ])
      setChannels(channelsData)
      setReminders(remindersData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load data")
    } finally {
      if (mode === "initial") {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }

  const createChannel = async (event: FormEvent<HTMLFormElement>) => {
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
      const created = await channelsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        ntfy_topic: topic.trim(),
        timezone,
      })
      setFeedback(`Channel "${created.name}" created successfully.`)
      setName("")
      setDescription("")
      setTopic("")
      setTopicTouched(false)
      setTimezoneChoice("America/Vancouver")
      setCustomTimezone("")
      void loadData("refresh")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to create channel")
    } finally {
      setSubmitting(false)
    }
  }

  const updateChannel = async (channel: Channel) => {
    setSubmitting(true)
    setError(null)

    try {
      await channelsApi.update(channel.id, {
        name: channel.name,
        description: channel.description,
        ntfy_topic: channel.ntfy_topic,
        timezone: channel.timezone,
        enabled: channel.enabled,
      })
      setFeedback(`Channel "${channel.name}" updated successfully.`)
      setEditingChannel(null)
      void loadData("refresh")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to update channel")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteChannel = async (channelId: number) => {
    setDeleting(channelId)
    setError(null)

    try {
      await channelsApi.delete(channelId)
      setFeedback("Channel deleted successfully.")
      void loadData("refresh")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to delete channel")
    } finally {
      setDeleting(null)
    }
  }

  const getChannelReminders = (channelId: number) => {
    return reminders.filter(r => r.channels.some(c => c.id === channelId))
  }

  const timezoneHelperText =
    timezoneChoice === "custom"
      ? "Use the exact tz database name, e.g. Europe/Berlin or Asia/Tokyo."
      : "Notifications will be sent in this timezone."

  return (
    <main className="mx-auto max-w-6xl space-y-10 p-6 sm:p-10">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Channels</h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage all notification channels. Each channel represents a destination for reminders.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              💡 <strong>Tip:</strong> Create channels for individuals (e.g., "Chris", "Mom") or groups (e.g., "Family Group"). Each person subscribes to their relevant channels on the ntfy app.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            onClick={() => void loadData("refresh")}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        <form onSubmit={createChannel} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Channel name</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                placeholder="Mom"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">NTFY topic</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                placeholder="family-mom"
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value)
                  setTopicTouched(true)
                }}
                required
              />
              <p className="text-xs text-slate-500">
                Subscribe to this topic on the ntfy app to receive notifications.
              </p>
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Description (optional)</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
              placeholder="Personal notifications for this person"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

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
            <p className="text-xs text-slate-500">Channels can be used by multiple reminders to send notifications.</p>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create channel"}
            </button>
          </div>
        </form>

        {feedback ? <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{feedback}</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">All channels</h2>
          {loading ? null : <span className="text-sm text-slate-500">{channels.length} total</span>}
        </div>

        {loading ? (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">Loading channels...</p>
        ) : channels.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            No channels yet. Create your first channel above to start sending notifications.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {channels.map((channel) => {
              const channelReminders = getChannelReminders(channel.id)
              return (
                <li key={channel.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  {editingChannel?.id === channel.id ? (
                    <EditChannelForm 
                      channel={editingChannel}
                      onSave={updateChannel}
                      onCancel={() => setEditingChannel(null)}
                      submitting={submitting}
                      setChannel={setEditingChannel}
                    />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-base font-medium text-slate-900">{channel.name}</p>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              channel.enabled 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {channel.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          {channel.description && (
                            <p className="text-sm text-slate-600 mb-2">{channel.description}</p>
                          )}
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Timezone</p>
                          <p className="text-sm text-slate-700">{channel.timezone}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">ID #{channel.id}</span>
                      </div>
                      <div className="mt-3 text-sm text-slate-600">
                        NTFY topic:
                        <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">{channel.ntfy_topic}</code>
                        <p className="text-xs text-slate-500 mt-1">Subscribe to this on the ntfy app</p>
                      </div>
                      
                      {channelReminders.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-xs font-medium text-slate-700 mb-1">
                            Used by {channelReminders.length} reminder{channelReminders.length !== 1 ? 's' : ''}:
                          </p>
                          <ul className="text-xs text-slate-600 space-y-1">
                            {channelReminders.slice(0, 3).map(r => (
                              <li key={r.id}>• {r.title}</li>
                            ))}
                            {channelReminders.length > 3 && (
                              <li className="text-slate-500">... and {channelReminders.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingChannel(channel)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteChannel(channel.id)}
                          disabled={deleting === channel.id}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deleting === channel.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}