
"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState, useCallback } from "react"
import { remindersApi, channelsApi, aiRemindersApi, Channel, Reminder, AIReminderParsed } from "../../lib/api"
import { EditReminderForm } from "../../components/reminders/EditReminderForm"
import { getScheduleDescription, parseCronToState, getOrdinalSuffix } from "../../lib/cron-utils"

interface RecurrencePattern {
  id: string
  label: string
  description: string
  cronTemplate: string
}

const RECURRENCE_PATTERNS: RecurrencePattern[] = [
  { id: 'daily', label: 'Daily', description: 'Every day', cronTemplate: '{minute} {hour} * * *' },
  { id: 'weekly', label: 'Weekly', description: 'Every week', cronTemplate: '{minute} {hour} * * {days}' },
  { id: 'monthly', label: 'Monthly', description: 'Every month', cronTemplate: '{minute} {hour} {day} * *' },
  { id: 'yearly', label: 'Yearly', description: 'Every year', cronTemplate: '{minute} {hour} {day} {month} *' },
  { id: 'weekdays', label: 'Weekdays', description: 'Monday to Friday', cronTemplate: '{minute} {hour} * * 1-5' },
  { id: 'weekends', label: 'Weekends', description: 'Saturday and Sunday', cronTemplate: '{minute} {hour} * * 0,6' }
]


const timezoneOptions = [
  { value: "America/Vancouver", label: "Pacific - Vancouver" },
  { value: "America/Los_Angeles", label: "Pacific - Los Angeles" },
  { value: "America/Denver", label: "Mountain - Denver" },
  { value: "America/Chicago", label: "Central - Chicago" },
  { value: "America/New_York", label: "Eastern - New York" },
  { value: "Europe/London", label: "UK - London" },
  { value: "Europe/Paris", label: "Europe - Paris" },
  { value: "Australia/Sydney", label: "Australia - Sydney" },
]

const DAYS_OF_WEEK = [
  { id: '1', label: 'Mon', name: 'Monday' },
  { id: '2', label: 'Tue', name: 'Tuesday' },
  { id: '3', label: 'Wed', name: 'Wednesday' },
  { id: '4', label: 'Thu', name: 'Thursday' },
  { id: '5', label: 'Fri', name: 'Friday' },
  { id: '6', label: 'Sat', name: 'Saturday' },
  { id: '0', label: 'Sun', name: 'Sunday' }
]

const MONTHS = [
  { id: '1', label: 'Jan' }, { id: '2', label: 'Feb' }, { id: '3', label: 'Mar' },
  { id: '4', label: 'Apr' }, { id: '5', label: 'May' }, { id: '6', label: 'Jun' },
  { id: '7', label: 'Jul' }, { id: '8', label: 'Aug' }, { id: '9', label: 'Sep' },
  { id: '10', label: 'Oct' }, { id: '11', label: 'Nov' }, { id: '12', label: 'Dec' }
]

export default function Dashboard() {
  // Form state
  const [channels, setChannels] = useState<Channel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])
  const [timezone, setTimezone] = useState("America/Vancouver")

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [time, setTime] = useState("08:00")

  // Manual form recurrence state
  const [selectedPattern, setSelectedPattern] = useState<string>('daily')
  const [selectedHour, setSelectedHour] = useState(8)
  const [selectedMinute, setSelectedMinute] = useState(0)
  const [selectedDays, setSelectedDays] = useState<string[]>(['1']) // Default to Monday
  const [selectedDay, setSelectedDay] = useState(1) // Day of month
  const [selectedMonth, setSelectedMonth] = useState(1)
  const [customCron, setCustomCron] = useState('')

  const [formError, setFormError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // AI-powered reminder states
  const [naturalLanguage, setNaturalLanguage] = useState("")
  const [aiParsing, setAiParsing] = useState(false)
  const [aiParsed, setAiParsed] = useState<AIReminderParsed | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  // Reminders list state
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loadingReminders, setLoadingReminders] = useState(true)
  const [remindersError, setRemindersError] = useState<string | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState<number | 'all'>('all')
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [editingChannelIds, setEditingChannelIds] = useState<number[]>([])
  const [deleting, setDeleting] = useState<number | null>(null)

  // Load data on mount
  useEffect(() => {
    void loadChannels()
    void loadReminders()
  }, [])

  // Auto-refresh reminders every 30 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      void loadReminders()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Update cron expression when recurrence settings change
  useEffect(() => {
    updateCronExpression()
  }, [selectedPattern, selectedHour, selectedMinute, selectedDays, selectedDay, selectedMonth])

  // Sync time input with hour/minute selectors
  useEffect(() => {
    const timeStr = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`
    setTime(timeStr)
  }, [selectedHour, selectedMinute])

  // Sync hour/minute selectors with time input
  useEffect(() => {
    const [hour, minute] = time.split(':').map(Number)
    if (!isNaN(hour) && !isNaN(minute)) {
      setSelectedHour(hour)
      setSelectedMinute(minute)
    }
  }, [time])

  // Clear messages after timeout
  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  const loadChannels = async () => {
    setLoadingChannels(true)
    try {
      const data = await channelsApi.list()
      setChannels(data.filter(channel => channel.enabled))
    } catch (err: unknown) {
      setChannels([])
    } finally {
      setLoadingChannels(false)
    }
  }

  const loadReminders = useCallback(async () => {
    setLoadingReminders(true)
    try {
      setRemindersError(null)
      const data = await remindersApi.list()
      setReminders(data)
    } catch (err: unknown) {
      setRemindersError(err instanceof Error ? err.message : "Unable to load reminders")
    } finally {
      setLoadingReminders(false)
    }
  }, [])

  const updateCronExpression = () => {
    const pattern = RECURRENCE_PATTERNS.find(p => p.id === selectedPattern)
    if (!pattern || selectedPattern === 'custom') return

    let cron = pattern.cronTemplate
      .replace('{hour}', selectedHour.toString())
      .replace('{minute}', selectedMinute.toString())

    switch (selectedPattern) {
      case 'weekly':
        cron = cron.replace('{days}', selectedDays.join(','))
        break
      case 'monthly':
        cron = cron.replace('{day}', selectedDay.toString())
        break
      case 'yearly':
        cron = cron.replace('{day}', selectedDay.toString())
        cron = cron.replace('{month}', selectedMonth.toString())
        break
    }

    // Don't update time state here to avoid circular updates
  }

  const toggleDay = (dayId: string) => {
    setSelectedDays(prev =>
      prev.includes(dayId)
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId].sort()
    )
  }
  const toggleChannel = (channelId: number) => {
    setSelectedChannelIds(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    )
  }


  const getLocalScheduleDescription = () => {
    const timeStr = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`
    
    switch (selectedPattern) {
      case 'daily':
        return `Every day at ${timeStr}`
      case 'weekly':
        if (selectedDays.length === 0) return 'No days selected'
        const dayNames = selectedDays.map(id => DAYS_OF_WEEK.find(d => d.id === id)?.name).join(', ')
        return `Every ${dayNames} at ${timeStr}`
      case 'monthly':
        return `Every month on the ${selectedDay}${getOrdinalSuffix(selectedDay)} at ${timeStr}`
      case 'yearly':
        const monthName = MONTHS.find(m => m.id === selectedMonth.toString())?.label
        return `Every year on ${monthName} ${selectedDay}${getOrdinalSuffix(selectedDay)} at ${timeStr}`
      case 'weekdays':
        return `Every weekday (Mon-Fri) at ${timeStr}`
      case 'weekends':
        return `Every weekend (Sat-Sun) at ${timeStr}`
      default:
        return ''
    }
  }

  const getCurrentCron = () => {
    const pattern = RECURRENCE_PATTERNS.find(p => p.id === selectedPattern)
    if (!pattern) return ''

    let cron = pattern.cronTemplate
      .replace('{hour}', selectedHour.toString())
      .replace('{minute}', selectedMinute.toString())

    switch (selectedPattern) {
      case 'weekly':
        cron = cron.replace('{days}', selectedDays.join(','))
        break
      case 'monthly':
        cron = cron.replace('{day}', selectedDay.toString())
        break
      case 'yearly':
        cron = cron.replace('{day}', selectedDay.toString())
        cron = cron.replace('{month}', selectedMonth.toString())
        break
    }

    return cron
  }

  const handleAIParseReminder = async () => {
    if (selectedChannelIds.length === 0) {
      setAiError("Please select at least one channel.")
      return
    }
    
    if (!naturalLanguage.trim()) {
      setAiError("Please enter what you want to be reminded about.")
      return
    }

    setAiParsing(true)
    setAiError(null)
    setAiParsed(null)

    try {
      const parsed = await aiRemindersApi.parse({
        channel_ids: selectedChannelIds,
        timezone: timezone,
        natural_language: naturalLanguage.trim()
      })
      
      setAiParsed(parsed)
      setTitle(parsed.title)
      setBody(parsed.body || "")
      
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Failed to parse reminder with AI")
    } finally {
      setAiParsing(false)
    }
  }

  const handleAICreateReminder = async () => {
    if (selectedChannelIds.length === 0) {
      setAiError("Please select at least one channel.")
      return
    }
    
    if (!naturalLanguage.trim()) {
      setAiError("Please enter what you want to be reminded about.")
      return
    }

    setSubmitting(true)
    setFormError(null)
    setAiError(null)

    try {
      await aiRemindersApi.create({
        channel_ids: selectedChannelIds,
        timezone: timezone,
        natural_language: naturalLanguage.trim()
      })
      
      setStatusMessage("AI reminder created successfully!")
      setNaturalLanguage("")
      setAiParsed(null)
      void loadReminders()
      
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Failed to create AI reminder")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setStatusMessage(null)

    if (selectedChannelIds.length === 0) {
      setFormError("Please select at least one channel.")
      return
    }

    if (!title.trim()) {
      setFormError("Please enter a reminder title.")
      return
    }

    const cron = getCurrentCron()
    if (!cron.trim()) {
      setFormError("Please configure a valid schedule.")
      return
    }

    setSubmitting(true)
    try {
      await remindersApi.create({
        channel_ids: selectedChannelIds,
        timezone: timezone,
        title: title.trim(),
        body: body.trim() ? body.trim() : undefined,
        cron: cron,
      })
      setStatusMessage("Reminder saved successfully!")
      setTitle("")
      setBody("")
      // Channel IDs remain selected
      void loadReminders()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Unable to create reminder")
    } finally {
      setSubmitting(false)
    }
  }

  const hasChannels = channels.length > 0
  
  const getChannelName = (channelId: number) => {
    return channels.find(c => c.id === channelId)?.name || `Channel ${channelId}`
  }

  const filteredReminders = selectedChannelId === 'all'
    ? reminders
    : reminders.filter(r => r.channels.some(c => c.id === selectedChannelId))

  const formatCronDescription = (cron: string) => {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) return cron
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
    
    // Format time
    const hourNum = parseInt(hour)
    const minuteNum = parseInt(minute)
    if (isNaN(hourNum) || isNaN(minuteNum)) return cron
    
    const timeStr = `${hourNum.toString().padStart(2, '0')}:${minuteNum.toString().padStart(2, '0')}`
    
    // Check pattern type
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Every day at ${timeStr}`
    }
    
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') {
      return `Every weekday (Mon-Fri) at ${timeStr}`
    }
    
    if (dayOfMonth === '*' && month === '*' && (dayOfWeek === '0,6' || dayOfWeek === '6,0')) {
      return `Every weekend (Sat-Sun) at ${timeStr}`
    }
    
    if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
      const days = dayOfWeek.split(',').map(d => {
        const day = DAYS_OF_WEEK.find(dow => dow.id === d.trim())
        return day ? day.name : d
      })
      return `Every ${days.join(', ')} at ${timeStr}`
    }
    
    if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
      const day = parseInt(dayOfMonth)
      return `Every month on the ${day}${getOrdinalSuffix(day)} at ${timeStr}`
    }
    
    if (dayOfMonth !== '*' && month !== '*') {
      const day = parseInt(dayOfMonth)
      const monthName = MONTHS.find(m => m.id === month)?.label || month
      return `Every year on ${monthName} ${day}${getOrdinalSuffix(day)} at ${timeStr}`
    }
    
    return cron
  }

  const startEditing = (reminder: Reminder) => {
    setEditingReminder(reminder)
    setEditingChannelIds(reminder.channels.map(c => c.id))
  }

  const updateReminder = async (reminder: Reminder, channelIds: number[]) => {
    setSubmitting(true)
    setFormError(null)

    try {
      await remindersApi.update(reminder.id, {
        title: reminder.title,
        body: reminder.body,
        cron: reminder.cron,
        timezone: reminder.timezone,
        channel_ids: channelIds,
        enabled: reminder.enabled,
      })
      setStatusMessage("Reminder updated successfully!")
      setEditingReminder(null)
      setEditingChannelIds([])
      await loadReminders()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Unable to update reminder")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteReminder = async (reminderId: number) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return
    
    setDeleting(reminderId)
    setFormError(null)

    try {
      await remindersApi.delete(reminderId)
      setStatusMessage("Reminder deleted successfully!")
      await loadReminders()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Unable to delete reminder")
    } finally {
      setDeleting(null)
    }
  }

  const toggleEnabled = async (reminder: Reminder) => {
    try {
      await remindersApi.update(reminder.id, { enabled: !reminder.enabled })
      setStatusMessage(`Reminder ${reminder.enabled ? 'disabled' : 'enabled'}!`)
      await loadReminders()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Unable to update reminder")
    }
  }


  return (
    <div className="min-h-screen bg-slate-50">
      {/* Split Screen Layout */}
      <div className="flex flex-col lg:flex-row lg:h-screen">
        
        {/* Left Panel - Create Reminder Form */}
        <div className="lg:w-1/2 lg:overflow-y-auto bg-white border-r border-slate-200">
          <div className="p-6 lg:p-8">
            <div className="max-w-2xl mx-auto">
              <header className="mb-8">
                <h1 className="text-3xl font-semibold text-slate-900 mb-2">Create Reminder</h1>
                <p className="text-sm text-slate-600">
                  Choose which channels receive it, what it says, and when it goes out.
                </p>
              </header>

              {/* AI-Powered Reminder Creation */}
              <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm ring-1 ring-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">AI-Powered Reminder</h2>
                    <p className="text-sm text-slate-600">Just tell us what you want to be reminded about!</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Send to channels (select at least one)
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-white">
                      {!hasChannels ? (
                        <p className="text-sm text-slate-500">No channels available</p>
                      ) : (
                        channels.map(channel => (
                          <label key={channel.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedChannelIds.includes(channel.id)}
                              onChange={() => toggleChannel(channel.id)}
                              disabled={aiParsing || submitting}
                              className="rounded"
                            />
                            <span className="text-sm">{channel.name}</span>
                            <code className="text-xs text-slate-500">({channel.ntfy_topic})</code>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedChannelIds.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">Select at least one channel</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      disabled={aiParsing || submitting}
                    >
                      {timezoneOptions.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">What do you want to be reminded about?</label>
                    <textarea
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none"
                      placeholder="Examples: 'Remind me to take my medication every day at 8am', 'Call mom every Sunday at 2pm'"
                      rows={3}
                      value={naturalLanguage}
                      onChange={(event) => setNaturalLanguage(event.target.value)}
                      disabled={!hasChannels || aiParsing || submitting}
                    />
                  </div>

                  {aiParsed && (
                    <div className="rounded-lg bg-white border border-green-200 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                          <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-green-800">AI Parsed Successfully</span>
                      </div>
                      
                      <div className="grid gap-2 text-sm">
                        <div><span className="font-medium text-slate-700">Title:</span> {aiParsed.title}</div>
                        {aiParsed.body && <div><span className="font-medium text-slate-700">Message:</span> {aiParsed.body}</div>}
                        <div><span className="font-medium text-slate-700">Schedule:</span> {aiParsed.schedule_description}</div>
                      </div>
                    </div>
                  )}

                  {aiError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                      <p className="text-sm text-red-700">{aiError}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleAIParseReminder}
                      disabled={!hasChannels || selectedChannelIds.length === 0 || !naturalLanguage.trim() || aiParsing || submitting}
                    >
                      {aiParsing ? "Parsing..." : "Parse with AI"}
                    </button>
                    
                    {aiParsed && (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handleAICreateReminder}
                        disabled={!hasChannels || selectedChannelIds.length === 0 || submitting}
                      >
                        {submitting ? "Creating..." : "Create AI Reminder"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="mb-8 flex items-center">
                <div className="flex-1 border-t border-slate-200"></div>
                <span className="px-4 text-sm text-slate-500">or create manually</span>
                <div className="flex-1 border-t border-slate-200"></div>
              </div>

              {/* Manual Form */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Send to channels (select at least one)
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
                        {!hasChannels ? (
                          <p className="text-sm text-slate-500">No channels available</p>
                        ) : (
                          channels.map(channel => (
                            <label key={channel.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedChannelIds.includes(channel.id)}
                                onChange={() => toggleChannel(channel.id)}
                                disabled={submitting}
                                className="rounded"
                              />
                              <span className="text-sm">{channel.name}</span>
                              <code className="text-xs text-slate-500">({channel.ntfy_topic})</code>
                            </label>
                          ))
                        )}
                      </div>
                      {selectedChannelIds.length === 0 && (
                        <p className="text-xs text-red-600 mt-1">Select at least one channel</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        disabled={submitting}
                      >
                        {timezoneOptions.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Reminder title</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                        placeholder="Take morning medication"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        disabled={!hasChannels || selectedChannelIds.length === 0 || submitting}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Optional message</label>
                      <textarea
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                        placeholder="Remember to drink a glass of water with your pills."
                        rows={3}
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        disabled={!hasChannels || selectedChannelIds.length === 0 || submitting}
                      />
                    </div>

                    {/* Recurrence Patterns */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Schedule</h3>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">Recurrence Pattern</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {RECURRENCE_PATTERNS.map(pattern => (
                            <button
                              key={pattern.id}
                              type="button"
                              onClick={() => setSelectedPattern(pattern.id)}
                              className={`p-3 text-sm rounded-lg border transition-colors ${
                                selectedPattern === pattern.id
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="font-medium">{pattern.label}</div>
                              <div className="text-xs text-slate-500 mt-1">{pattern.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Time Selection */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Hour</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                            value={selectedHour}
                            onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>
                                {i.toString().padStart(2, '0')}:00 ({i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Minute</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                            value={selectedMinute}
                            onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Day of Week Selection for Weekly */}
                      {selectedPattern === 'weekly' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-3">Days of Week</label>
                          <div className="grid grid-cols-7 gap-2">
                            {DAYS_OF_WEEK.map(day => (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => toggleDay(day.id)}
                                className={`p-2 text-sm rounded-lg border transition-colors ${
                                  selectedDays.includes(day.id)
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                {day.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Day of Month Selection for Monthly/Yearly */}
                      {(selectedPattern === 'monthly' || selectedPattern === 'yearly') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Day of Month</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                            value={selectedDay}
                            onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                          >
                            {Array.from({ length: 31 }, (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}{getOrdinalSuffix(i + 1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Month Selection for Yearly */}
                      {selectedPattern === 'yearly' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Month</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                          >
                            {MONTHS.map(month => (
                              <option key={month.id} value={month.id}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={!hasChannels || selectedChannelIds.length === 0 || submitting}
                      >
                        {submitting ? "Saving..." : "Save reminder"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Preview Box */}
                <div className="lg:col-span-1">
                  <div className="sticky top-6">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-lg font-medium text-slate-900 mb-4">Preview</h3>
                      
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-slate-700">Title:</span>
                          <p className="text-sm text-slate-900 mt-1">
                            {title || <span className="text-slate-400">Enter a title</span>}
                          </p>
                        </div>

                        {body && (
                          <div>
                            <span className="text-sm font-medium text-slate-700">Message:</span>
                            <p className="text-sm text-slate-900 mt-1">{body}</p>
                          </div>
                        )}

                        <div>
                          <span className="text-sm font-medium text-slate-700">Schedule:</span>
                          <p className="text-sm text-slate-900 mt-1">{getLocalScheduleDescription()}</p>
                        </div>

                        <div>
                          <span className="text-sm font-medium text-slate-700">Channels:</span>
                          <p className="text-sm text-slate-900 mt-1">
                            {selectedChannelIds.length > 0
                              ? selectedChannelIds.map(id => channels.find(c => c.id === id)?.name).filter(Boolean).join(', ')
                              : <span className="text-slate-400">Select channels</span>
                            }
                          </p>
                        </div>

                        <div>
                          <span className="text-sm font-medium text-slate-700">Timezone:</span>
                          <p className="text-sm text-slate-900 mt-1">{timezone}</p>
                        </div>
                      </div>

                      {/* Quick Tips */}
                      <div className="mt-6 pt-4 border-t border-slate-200">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Quick Tips</h4>
                        <ul className="text-xs text-slate-600 space-y-1">
                          <li>• Daily: Runs every day at the specified time</li>
                          <li>• Weekly: Select specific days of the week</li>
                          <li>• Monthly: Runs on the same day each month</li>
                          <li>• Yearly: Runs on the same date each year</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {statusMessage && (
                <div className="mt-6 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  {statusMessage}
                </div>
              )}
              {formError && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Current Reminders List */}
        <div className="lg:w-1/2 lg:overflow-y-auto bg-slate-50">
          <div className="p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
              <header className="mb-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-3xl font-semibold text-slate-900 mb-2">Current Reminders</h2>
                    <p className="text-sm text-slate-600">
                      Live-updating list of all family reminders. Updates automatically every 30 seconds.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                    onClick={() => void loadReminders()}
                    disabled={loadingReminders}
                  >
                    {loadingReminders ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {/* Filter */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Channel</label>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  >
                    <option value="all">All Channels ({reminders.length} reminders)</option>
                    {channels.map(channel => {
                      const count = reminders.filter(r => r.channels.some(c => c.id === channel.id)).length
                      return (
                        <option key={channel.id} value={channel.id}>
                          {channel.name} ({count} reminders)
                        </option>
                      )
                    })}
                  </select>
                </div>
              </header>

              {remindersError && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {remindersError}
                </div>
              )}

              {/* Reminders List */}
              <div className="space-y-4">
                {loadingReminders ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center gap-2 text-slate-600">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading reminders...
                    </div>
                  </div>
                ) : filteredReminders.length === 0 ? (
                  <div className="rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                    <p className="text-slate-600">
                      {selectedChannelId === 'all'
                        ? "No reminders found. Create your first reminder to get started."
                        : `No reminders found for ${getChannelName(selectedChannelId as number)}.`
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredReminders.map((reminder) => (
                      <div key={reminder.id} className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        {editingReminder?.id === reminder.id ? (
                          <EditReminderForm
                            reminder={editingReminder}
                            channels={channels}
                            onSave={updateReminder}
                            onCancel={() => {
                              setEditingReminder(null)
                              setEditingChannelIds([])
                            }}
                            submitting={submitting}
                            setReminder={setEditingReminder}
                            selectedChannelIds={editingChannelIds}
                            setSelectedChannelIds={setEditingChannelIds}
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
                                    {reminder.enabled ? 'Active' : 'Disabled'}
                                  </span>
                                </div>
                                
                                {reminder.body && (
                                  <p className="text-slate-600 mb-3">{reminder.body}</p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-slate-500">Channels:</span>
                                    <p className="font-medium">
                                      {reminder.channels.map(c => c.name).join(', ') || 'None'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Timezone:</span>
                                    <p className="font-medium">{reminder.timezone}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Schedule:</span>
                                    <p className="font-medium">{getScheduleDescription(parseCronToState(reminder.cron))}</p>
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

                            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap gap-3">
                              <button
                                onClick={() => startEditing(reminder)}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleEnabled(reminder)}
                                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                              >
                                {reminder.enabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => deleteReminder(reminder.id)}
                                disabled={deleting === reminder.id}
                                className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                              >
                                {deleting === reminder.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {filteredReminders.length > 0 && (
                  <div className="text-center pt-4">
                    <Link
                      href="/reminders"
                      className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      View delivery logs →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}