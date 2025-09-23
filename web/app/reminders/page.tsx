"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { remindersApi, usersApi, logsApi, alertChannelsApi, User, Reminder, DeliveryLog, AlertChannel } from "../../lib/api"

interface EditReminderFormProps {
  reminder: Reminder
  users: User[]
  alertChannels: AlertChannel[]
  onSave: (reminder: Reminder) => void
  onCancel: () => void
  submitting: boolean
  setReminder: (reminder: Reminder) => void
}

function EditReminderForm({ reminder, users, alertChannels, onSave, onCancel, submitting, setReminder }: EditReminderFormProps) {
  const updateField = (field: keyof Reminder, value: string | number | boolean | undefined) => {
    setReminder({ ...reminder, [field]: value })
  }

  return (
    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">User</label>
        <select
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={reminder.user_id}
          onChange={(e) => updateField('user_id', parseInt(e.target.value))}
        >
          {users.map(user => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Alert Channel</label>
        <select
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={reminder.alert_channel_id || ''}
          onChange={(e) => updateField('alert_channel_id', e.target.value ? parseInt(e.target.value) : undefined)}
        >
          <option value="">Use user's personal topic</option>
          {alertChannels.map(channel => (
            <option key={channel.id} value={channel.id}>{channel.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={reminder.title}
          onChange={(e) => updateField('title', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Body</label>
        <textarea
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          value={reminder.body || ''}
          onChange={(e) => updateField('body', e.target.value)}
          rows={2}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Cron Expression</label>
        <input
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm font-mono"
          value={reminder.cron}
          onChange={(e) => updateField('cron', e.target.value)}
          placeholder="0 9 * * *"
        />
        <p className="text-xs text-slate-500 mt-1">Format: minute hour day month day-of-week</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`enabled-${reminder.id}`}
          checked={reminder.enabled}
          onChange={(e) => updateField('enabled', e.target.checked)}
          className="rounded"
        />
        <label htmlFor={`enabled-${reminder.id}`} className="text-xs font-medium text-slate-700">
          Enabled
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(reminder)}
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

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [alertChannels, setAlertChannels] = useState<AlertChannel[]>([])
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all')
  const [showLogs, setShowLogs] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [remindersData, usersData, alertChannelsData] = await Promise.all([
        remindersApi.list(),
        usersApi.list(),
        alertChannelsApi.list()
      ])
      setReminders(remindersData)
      setUsers(usersData)
      setAlertChannels(alertChannelsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async (reminderId: number) => {
    try {
      const logsData = await logsApi.list(reminderId, 20)
      setLogs(logsData)
      setShowLogs(reminderId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs")
    }
  }

  const updateReminder = async (reminder: Reminder) => {
    setSubmitting(true)
    setError(null)

    try {
      await remindersApi.update(reminder.id, {
        user_id: reminder.user_id,
        alert_channel_id: reminder.alert_channel_id,
        title: reminder.title,
        body: reminder.body,
        cron: reminder.cron,
        enabled: reminder.enabled,
      })
      setFeedback("Reminder updated successfully.")
      setEditingReminder(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update reminder")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteReminder = async (reminderId: number) => {
    setDeleting(reminderId)
    setError(null)

    try {
      await remindersApi.delete(reminderId)
      setFeedback("Reminder deleted successfully.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete reminder")
    } finally {
      setDeleting(null)
    }
  }

  const toggleEnabled = async (reminder: Reminder) => {
    try {
      await remindersApi.update(reminder.id, { enabled: !reminder.enabled })
      setFeedback(`Reminder ${reminder.enabled ? 'disabled' : 'enabled'}.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update reminder")
    }
  }

  const filteredReminders = selectedUserId === 'all' 
    ? reminders 
    : reminders.filter(r => r.user_id === selectedUserId)

  const getUserName = (userId: number) => {
    return users.find(u => u.id === userId)?.name || `User ${userId}`
  }

  const getChannelName = (channelId?: number) => {
    if (!channelId) return "User's personal topic"
    return alertChannels.find(c => c.id === channelId)?.name || `Channel ${channelId}`
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6 sm:p-10">
        <div className="text-center">Loading reminders...</div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 sm:p-10">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Manage Reminders</h1>
            <p className="text-sm text-slate-600">
              View, edit, and manage all family reminders. Filter by user to see specific reminders.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:border-slate-300"
            >
              Refresh
            </button>
            <Link
              href="/new"
              className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              New Reminder
            </Link>
          </div>
        </div>

        {/* Filter */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Filter by User</label>
          <select
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          >
            <option value="all">All Users ({reminders.length} reminders)</option>
            {users.map(user => {
              const count = reminders.filter(r => r.user_id === user.id).length
              return (
                <option key={user.id} value={user.id}>
                  {user.name} ({count} reminders)
                </option>
              )
            })}
          </select>
        </div>

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

      {/* Reminders List */}
      <section className="space-y-4">
        {filteredReminders.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-600">
              {selectedUserId === 'all' 
                ? "No reminders found. Create your first reminder to get started." 
                : `No reminders found for ${getUserName(selectedUserId as number)}.`
              }
            </p>
            <Link
              href="/new"
              className="mt-3 inline-block px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              Create Reminder
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredReminders.map((reminder) => (
              <div key={reminder.id} className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
                {editingReminder?.id === reminder.id ? (
                  <EditReminderForm
                    reminder={editingReminder}
                    users={users}
                    alertChannels={alertChannels}
                    onSave={updateReminder}
                    onCancel={() => setEditingReminder(null)}
                    submitting={submitting}
                    setReminder={setEditingReminder}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">{reminder.title}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            reminder.enabled 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {reminder.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        
                        {reminder.body && (
                          <p className="text-slate-600 mb-3">{reminder.body}</p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">User:</span>
                            <p className="font-medium">{getUserName(reminder.user_id)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Alert Channel:</span>
                            <p className="font-medium">{getChannelName(reminder.alert_channel_id)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Schedule:</span>
                            <p className="font-mono text-xs bg-slate-100 px-2 py-1 rounded mt-1">
                              {reminder.cron}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Created:</span>
                            <p>{reminder.created_at ? new Date(reminder.created_at).toLocaleDateString() : 'Recently'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500">
                        ID #{reminder.id}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => setEditingReminder(reminder)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleEnabled(reminder)}
                        className="text-xs text-orange-600 hover:text-orange-800"
                      >
                        {reminder.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => loadLogs(reminder.id)}
                        className="text-xs text-purple-600 hover:text-purple-800"
                      >
                        View Logs
                      </button>
                      <button
                        onClick={() => deleteReminder(reminder.id)}
                        disabled={deleting === reminder.id}
                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deleting === reminder.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>

                    {/* Delivery Logs */}
                    {showLogs === reminder.id && (
                      <div className="mt-4 border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-slate-900">Recent Delivery Logs</h4>
                          <button
                            onClick={() => setShowLogs(null)}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            Hide
                          </button>
                        </div>
                        
                        {logs.length === 0 ? (
                          <p className="text-sm text-slate-500">No delivery logs yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {logs.map((log) => (
                              <div key={log.id} className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded">
                                <div>
                                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                    log.status === 'sent' ? 'bg-green-500' : 'bg-red-500'
                                  }`}></span>
                                  <span className="capitalize">{log.status}</span>
                                  {log.detail && <span className="text-slate-500 ml-2">- {log.detail}</span>}
                                </div>
                                <span className="text-slate-500">
                                  {new Date(log.sent_at).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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