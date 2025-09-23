"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { alertChannelsApi, AlertChannel } from "../../lib/api"

interface EditChannelFormProps {
  channel: AlertChannel
  onSave: (channel: AlertChannel) => void
  onCancel: () => void
  submitting: boolean
  setChannel: (channel: AlertChannel) => void
}

function EditChannelForm({ channel, onSave, onCancel, submitting, setChannel }: EditChannelFormProps) {
  const updateField = (field: keyof AlertChannel, value: string | boolean) => {
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
          placeholder="Family Group"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={channel.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Family notifications for all members"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">NTFY Topic</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm font-mono"
          value={channel.ntfy_topic}
          onChange={(e) => updateField('ntfy_topic', e.target.value)}
          placeholder="family-group"
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

export default function AlertChannels() {
  const [channels, setChannels] = useState<AlertChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editingChannel, setEditingChannel] = useState<AlertChannel | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDescription, setNewChannelDescription] = useState("")
  const [newChannelTopic, setNewChannelTopic] = useState("")

  useEffect(() => {
    loadChannels()
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  const loadChannels = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await alertChannelsApi.list()
      setChannels(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alert channels")
    } finally {
      setLoading(false)
    }
  }

  const createChannel = async () => {
    if (!newChannelName.trim() || !newChannelTopic.trim()) {
      setError("Name and NTFY topic are required")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await alertChannelsApi.create({
        name: newChannelName.trim(),
        description: newChannelDescription.trim() || undefined,
        ntfy_topic: newChannelTopic.trim(),
      })
      setFeedback("Alert channel created successfully.")
      setNewChannelName("")
      setNewChannelDescription("")
      setNewChannelTopic("")
      setShowCreateForm(false)
      await loadChannels()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create alert channel")
    } finally {
      setSubmitting(false)
    }
  }

  const updateChannel = async (channel: AlertChannel) => {
    setSubmitting(true)
    setError(null)

    try {
      await alertChannelsApi.update(channel.id, {
        name: channel.name,
        description: channel.description,
        ntfy_topic: channel.ntfy_topic,
        enabled: channel.enabled,
      })
      setFeedback("Alert channel updated successfully.")
      setEditingChannel(null)
      await loadChannels()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update alert channel")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteChannel = async (channelId: number) => {
    setDeleting(channelId)
    setError(null)

    try {
      await alertChannelsApi.delete(channelId)
      setFeedback("Alert channel deleted successfully.")
      await loadChannels()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete alert channel")
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6 sm:p-10">
        <div className="text-center">Loading alert channels...</div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 sm:p-10">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Alert Channels</h1>
            <p className="text-sm text-slate-600">
              Create notification channels that reminders can be assigned to. Channels allow multiple reminders to share the same notification destination.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadChannels}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:border-slate-300"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              {showCreateForm ? "Cancel" : "New Channel"}
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-900 mb-4">Create New Alert Channel</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Channel Name</label>
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="Family Group"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NTFY Topic</label>
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono"
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  placeholder="family-group"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <input
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
                placeholder="Notifications for all family members"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={createChannel}
                disabled={submitting || !newChannelName.trim() || !newChannelTopic.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Channel"}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded hover:border-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {feedback}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      {/* Channels List */}
      <section className="space-y-4">
        {channels.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-600 mb-2">No alert channels created yet.</p>
            <p className="text-sm text-slate-500">Create your first alert channel to group notifications.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-3 inline-block px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              Create Channel
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {channels.map((channel) => (
              <div key={channel.id} className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
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
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">{channel.name}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            channel.enabled 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {channel.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        
                        {channel.description && (
                          <p className="text-slate-600 mb-3">{channel.description}</p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">NTFY Topic:</span>
                            <p className="font-mono text-xs bg-slate-100 px-2 py-1 rounded mt-1">
                              {channel.ntfy_topic}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Created:</span>
                            <p>{new Date(channel.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500">
                        ID #{channel.id}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setEditingChannel(channel)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteChannel(channel.id)}
                        disabled={deleting === channel.id}
                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deleting === channel.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}