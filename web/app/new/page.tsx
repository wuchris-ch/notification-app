"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"

import { apiUrl, remindersApi, alertChannelsApi, Reminder, AlertChannel } from "../../lib/api"

type User = {
  id: number
  name: string
}

type ScheduleType = "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom"

type ScheduleOption = {
  value: ScheduleType
  title: string
  description: string
}

type WeekdayOption = {
  value: string
  label: string
  longLabel: string
}

type MonthOption = {
  value: string
  label: string
  days: number
}

type CronDetails = {
  cron: string | null
  summary: string
  error: string | null
}

const scheduleOptions: ScheduleOption[] = [
  { value: "daily", title: "Every day", description: "Send this reminder once per day." },
  { value: "weekdays", title: "Weekdays", description: "Monday through Friday." },
  { value: "weekly", title: "Specific days", description: "Pick the days of the week." },
  { value: "monthly", title: "Monthly", description: "On a chosen day each month." },
  { value: "yearly", title: "Yearly", description: "On a specific date once a year." },
  { value: "custom", title: "Custom", description: "Advanced cron expression." },
]

const weekdayOptions: WeekdayOption[] = [
  { value: "1", label: "Mon", longLabel: "Monday" },
  { value: "2", label: "Tue", longLabel: "Tuesday" },
  { value: "3", label: "Wed", longLabel: "Wednesday" },
  { value: "4", label: "Thu", longLabel: "Thursday" },
  { value: "5", label: "Fri", longLabel: "Friday" },
  { value: "6", label: "Sat", longLabel: "Saturday" },
  { value: "0", label: "Sun", longLabel: "Sunday" },
]

const weekdayOrder = ["1", "2", "3", "4", "5", "6", "0"]

const monthOptions: MonthOption[] = [
  { value: "1", label: "January", days: 31 },
  { value: "2", label: "February", days: 29 },
  { value: "3", label: "March", days: 31 },
  { value: "4", label: "April", days: 30 },
  { value: "5", label: "May", days: 31 },
  { value: "6", label: "June", days: 30 },
  { value: "7", label: "July", days: 31 },
  { value: "8", label: "August", days: 31 },
  { value: "9", label: "September", days: 30 },
  { value: "10", label: "October", days: 31 },
  { value: "11", label: "November", days: 30 },
  { value: "12", label: "December", days: 31 },
]

const monthlyDayOptions = Array.from({ length: 31 }, (_, index) => String(index + 1))

function parseTime(value: string): { hour: number; minute: number; error: string | null } {
  if (!value) {
    return { hour: 0, minute: 0, error: "Pick a time" }
  }
  const [hourText, minuteText] = value.split(":")
  if (hourText === undefined || minuteText === undefined) {
    return { hour: 0, minute: 0, error: "Pick a time" }
  }
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { hour: 0, minute: 0, error: "Hour must be between 0 and 23" }
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { hour: 0, minute: 0, error: "Minute must be between 0 and 59" }
  }
  return { hour, minute, error: null }
}

function formatTimeLabel(hour: number, minute: number): string {
  const suffix = hour >= 12 ? "PM" : "AM"
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12
  const minuteLabel = String(minute).padStart(2, "0")
  return `${normalizedHour}:${minuteLabel} ${suffix}`
}

function ordinal(n: number): string {
  const remTen = n % 10
  const remHundred = n % 100
  if (remTen === 1 && remHundred !== 11) return `${n}st`
  if (remTen === 2 && remHundred !== 12) return `${n}nd`
  if (remTen === 3 && remHundred !== 13) return `${n}rd`
  return `${n}th`
}

function sortWeekdays(values: string[]): string[] {
  const unique = Array.from(new Set(values))
  return unique.sort((a, b) => weekdayOrder.indexOf(a) - weekdayOrder.indexOf(b))
}

function describeWeekdays(values: string[]): string {
  const ordered = sortWeekdays(values)
  const labels = ordered
    .map((value) => weekdayOptions.find((option) => option.value === value)?.longLabel)
    .filter((label): label is string => Boolean(label))
  if (labels.length === 0) return ""
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`
}

function deriveCron(details: {
  scheduleType: ScheduleType
  time: string
  weeklyDays: string[]
  monthlyDay: string
  yearlyMonth: string
  yearlyDay: string
  customCron: string
}): CronDetails {
  if (details.scheduleType === "custom") {
    const cron = details.customCron.trim()
    if (!cron) {
      return {
        cron: null,
        summary: "Enter a cron expression to see the preview.",
        error: "Enter a cron expression",
      }
    }
    const parts = cron.split(/\s+/)
    if (parts.length !== 5) {
      return {
        cron: null,
        summary: "Cron expressions must have exactly five fields (min hour day month dow).",
        error: "Cron must have exactly five fields",
      }
    }
    return { cron, summary: "Custom cron schedule", error: null }
  }

  const parsed = parseTime(details.time)
  if (parsed.error) {
    return { cron: null, summary: "Add a valid time to see the preview.", error: parsed.error }
  }
  const minuteField = String(parsed.minute)
  const hourField = String(parsed.hour)
  const timeLabel = formatTimeLabel(parsed.hour, parsed.minute)

  switch (details.scheduleType) {
    case "daily":
      return {
        cron: `${minuteField} ${hourField} * * *`,
        summary: `Every day at ${timeLabel}`,
        error: null,
      }
    case "weekdays":
      return {
        cron: `${minuteField} ${hourField} * * 1-5`,
        summary: `Weekdays (Monday through Friday) at ${timeLabel}`,
        error: null,
      }
    case "weekly": {
      if (details.weeklyDays.length === 0) {
        return {
          cron: null,
          summary: "Choose at least one weekday for the schedule.",
          error: "Pick one or more weekdays",
        }
      }
      const days = sortWeekdays(details.weeklyDays)
      const daySummary = describeWeekdays(days)
      return {
        cron: `${minuteField} ${hourField} * * ${days.join(",")}`,
        summary: `Every ${daySummary} at ${timeLabel}`,
        error: null,
      }
    }
    case "monthly": {
      const dayNumber = Number(details.monthlyDay)
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
        return {
          cron: null,
          summary: "Choose a valid day of the month (1-31).",
          error: "Invalid day of month",
        }
      }
      return {
        cron: `${minuteField} ${hourField} ${dayNumber} * *`,
        summary: `On the ${ordinal(dayNumber)} of every month at ${timeLabel}`,
        error: null,
      }
    }
    case "yearly": {
      const monthNumber = Number(details.yearlyMonth)
      const dayNumber = Number(details.yearlyDay)
      const monthInfo = monthOptions.find((option) => Number(option.value) === monthNumber)
      if (!monthInfo) {
        return { cron: null, summary: "Choose a valid month.", error: "Invalid month" }
      }
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > monthInfo.days) {
        return {
          cron: null,
          summary: `Choose a day between 1 and ${monthInfo.days} for ${monthInfo.label}.`,
          error: "Invalid day for selected month",
        }
      }
      return {
        cron: `${minuteField} ${hourField} ${dayNumber} ${monthNumber} *`,
        summary: `Every ${monthInfo.label} ${ordinal(dayNumber)} at ${timeLabel}`,
        error: null,
      }
    }
    default:
      return { cron: null, summary: "Choose a schedule option.", error: "Unknown schedule" }
  }
}

export default function NewReminder() {
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [refreshingUsers, setRefreshingUsers] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | undefined>(undefined)

  const [alertChannels, setAlertChannels] = useState<AlertChannel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [channelsError, setChannelsError] = useState<string | null>(null)
  const [alertChannelId, setAlertChannelId] = useState<number | undefined>(undefined)

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loadingReminders, setLoadingReminders] = useState(true)
  const [remindersError, setRemindersError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [scheduleType, setScheduleType] = useState<ScheduleType>("daily")
  const [time, setTime] = useState("08:00")
  const [weeklyDays, setWeeklyDays] = useState<string[]>(["1"])
  const [monthlyDay, setMonthlyDay] = useState("1")
  const [yearlyMonth, setYearlyMonth] = useState("1")
  const [yearlyDay, setYearlyDay] = useState("1")
  const [customCron, setCustomCron] = useState("30 7 * * 1-5")

  const [formError, setFormError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    void loadUsers("initial")
    void loadAlertChannels()
    void loadReminders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (scheduleType === "weekly" && weeklyDays.length === 0) {
      setWeeklyDays(["1"])
    }
  }, [scheduleType, weeklyDays.length])

  useEffect(() => {
    if (scheduleType !== "yearly") {
      return
    }
    const monthInfo = monthOptions.find((option) => option.value === yearlyMonth)
    const maxDay = monthInfo?.days ?? 31
    if (Number(yearlyDay) > maxDay) {
      setYearlyDay(String(maxDay))
    }
  }, [scheduleType, yearlyMonth, yearlyDay])

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  useEffect(() => {
    if (!testMessage) return
    const timer = window.setTimeout(() => setTestMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [testMessage])

  const handleSendTest = async () => {
    setTestError(null)
    setTestMessage(null)
    if (!userId) {
      setTestError("Add a user first in the Manage users page.")
      return
    }
    if (!title.trim()) {
      setTestError("Give this reminder a title before sending a test notification.")
      return
    }
    setTesting(true)
    try {
      const response = await fetch(apiUrl("/notifications/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          title: title.trim(),
          body: body.trim() ? body.trim() : undefined,
        }),
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || "Unable to send test notification")
      }
      setTestMessage("Test notification sent. Check the ntfy app.")
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : "Unable to send test notification")
    } finally {
      setTesting(false)
    }
  }

  const loadUsers = async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") {
      setLoadingUsers(true)
    } else {
      setRefreshingUsers(true)
    }
    try {
      setUsersError(null)
      const response = await fetch(apiUrl("/users"))
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || "Unable to load users")
      }
      const data: User[] = await response.json()
      setUsers(data)
      setUserId((current) => {
        if (current && data.some((user) => user.id === current)) {
          return current
        }
        return data.length > 0 ? data[0].id : undefined
      })
    } catch (err: unknown) {
      setUsers([])
      setUserId(undefined)
      setUsersError(err instanceof Error ? err.message : "Unable to load users")
    } finally {
      if (mode === "initial") {
        setLoadingUsers(false)
      } else {
        setRefreshingUsers(false)
      }
    }
  }

  const loadAlertChannels = async () => {
    setLoadingChannels(true)
    try {
      setChannelsError(null)
      const data = await alertChannelsApi.list()
      setAlertChannels(data.filter(channel => channel.enabled))
    } catch (err: unknown) {
      setChannelsError(err instanceof Error ? err.message : "Unable to load alert channels")
    } finally {
      setLoadingChannels(false)
    }
  }

  const loadReminders = async () => {
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
  }

  const cronDetails = useMemo(
    () =>
      deriveCron({
        scheduleType,
        time,
        weeklyDays,
        monthlyDay,
        yearlyMonth,
        yearlyDay,
        customCron,
      }),
    [scheduleType, time, weeklyDays, monthlyDay, yearlyMonth, yearlyDay, customCron],
  )

  const yearlyDayOptions = useMemo(() => {
    const monthInfo = monthOptions.find((option) => option.value === yearlyMonth)
    const max = monthInfo?.days ?? 31
    return Array.from({ length: max }, (_, index) => String(index + 1))
  }, [yearlyMonth])

  const toggleWeekday = (value: string) => {
    setWeeklyDays((current) => {
      const exists = current.includes(value)
      const next = exists ? current.filter((day) => day !== value) : [...current, value]
      return sortWeekdays(next)
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setStatusMessage(null)

    if (!userId) {
      setFormError("Add a user first in the Manage users page.")
      return
    }

    if (!title.trim()) {
      setFormError("Give this reminder a title.")
      return
    }

    if (!cronDetails.cron) {
      setFormError(cronDetails.error || "Choose a schedule option.")
      return
    }

    setSubmitting(true)
    try {
      await remindersApi.create({
        user_id: userId,
        alert_channel_id: alertChannelId,
        title: title.trim(),
        body: body.trim() ? body.trim() : undefined,
        cron: cronDetails.cron,
      })
      setStatusMessage("Reminder saved. The scheduler will send the first alert within the next minute.")
      setTitle("")
      setBody("")
      setAlertChannelId(undefined)
      void loadReminders() // Reload reminders to show the new one
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Unable to create reminder")
    } finally {
      setSubmitting(false)
    }
  }

  const hasUsers = users.length > 0
  
  const getUserName = (userId: number) => {
    return users.find(u => u.id === userId)?.name || `User ${userId}`
  }

  const formatCronDescription = (cron: string) => {
    // Simple cron descriptions for common patterns
    if (cron === "0 9 * * *") return "Daily at 9:00 AM"
    if (cron === "0 18 * * *") return "Daily at 6:00 PM"
    if (cron === "30 7 * * 1-5") return "Weekdays at 7:30 AM"
    if (cron === "0 10 * * 0") return "Sundays at 10:00 AM"
    if (cron === "0 12 25 12 *") return "Christmas Day at 12:00 PM"
    // For other patterns, just show the cron
    return cron
  }

  return (
    <main className="mx-auto max-w-4xl space-y-10 p-6 sm:p-10">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Create a reminder</h1>
            <p className="text-sm text-slate-600">
              Fill in who should receive it, what the reminder says, and when it should go out.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            onClick={() => {
              void loadUsers("refresh")
              void loadAlertChannels()
              void loadReminders()
            }}
            disabled={loadingUsers || refreshingUsers || loadingChannels || loadingReminders}
          >
            {refreshingUsers || loadingChannels || loadingReminders ? "Refreshing..." : "Refresh data"}
          </button>
        </header>

        <form onSubmit={handleSubmit} className="mt-8 space-y-10">
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-900">1. Who should get it?</legend>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Family member</span>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                  value={userId ?? ""}
                  onChange={(event) => {
                    const selected = event.target.value
                    setUserId(selected ? Number(selected) : undefined)
                  }}
                  disabled={!hasUsers || submitting}
                  required
                >
                  {hasUsers ? null : <option value="">No users available</option>}
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">Need another person? <Link className="underline" href="/users">Manage users</Link>.</p>
              </label>
              <span className="text-sm text-slate-500">
                {loadingUsers ? "Loading..." : hasUsers ? `${users.length} available` : "Add users first"}
              </span>
            </div>
            {usersError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{usersError}</p>
            ) : null}

            {/* Alert Channel Selection */}
            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Alert Channel (Optional)</span>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                value={alertChannelId ?? ""}
                onChange={(event) => {
                  const selected = event.target.value
                  setAlertChannelId(selected ? Number(selected) : undefined)
                }}
                disabled={submitting}
              >
                <option value="">Use user's personal topic</option>
                {alertChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} ({channel.ntfy_topic})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Choose an alert channel to send notifications to a shared topic instead of the user's personal topic. 
                <Link className="underline ml-1" href="/alert-channels">Manage channels</Link>.
              </p>
            </div>
            {channelsError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{channelsError}</p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-900">2. What should it say?</legend>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Reminder title</span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                placeholder="Take morning medication"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                disabled={!hasUsers || submitting}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Optional message</span>
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                placeholder="Remember to drink a glass of water with your pills."
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={!hasUsers || submitting}
              />
              <p className="text-xs text-slate-500">If left blank, the ntfy notification will just include the title.</p>
            </label>
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="text-lg font-semibold text-slate-900">3. When should it repeat?</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {scheduleOptions.map((option) => {
                const selected = scheduleType === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left text-sm shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                    }`}
                    onClick={() => setScheduleType(option.value)}
                    disabled={submitting}
                  >
                    <span className="block text-base font-semibold">{option.title}</span>
                    <span className={selected ? "text-slate-200" : "text-slate-500"}>{option.description}</span>
                  </button>
                )
              })}
            </div>

            {scheduleType !== "custom" ? (
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Time of day</span>
                <input
                  type="time"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none sm:w-60"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  step={60}
                  disabled={submitting}
                  required
                />
                <p className="text-xs text-slate-500">We send reminders right at this time in the person&apos;s timezone.</p>
              </label>
            ) : null}

            {scheduleType === "weekly" ? (
              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Pick the days</span>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((option) => {
                    const selected = weeklyDays.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleWeekday(option.value)}
                        className={`min-w-[3.25rem] rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                        }`}
                        disabled={submitting}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-500">Choose one or more days. We will send it on each selected day.</p>
              </div>
            ) : null}

            {scheduleType === "monthly" ? (
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Day of the month</span>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none sm:w-60"
                  value={monthlyDay}
                  onChange={(event) => setMonthlyDay(event.target.value)}
                  disabled={submitting}
                >
                  {monthlyDayOptions.map((option) => (
                    <option key={option} value={option}>
                      {ordinal(Number(option))}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">If a month is shorter (like February 30th), the reminder will skip that month.</p>
              </label>
            ) : null}

            {scheduleType === "yearly" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Month</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                    value={yearlyMonth}
                    onChange={(event) => setYearlyMonth(event.target.value)}
                    disabled={submitting}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Day</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                    value={yearlyDay}
                    onChange={(event) => setYearlyDay(event.target.value)}
                    disabled={submitting}
                  >
                    {yearlyDayOptions.map((option) => (
                      <option key={option} value={option}>
                        {ordinal(Number(option))}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {scheduleType === "custom" ? (
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Cron expression</span>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm shadow-sm transition focus:border-slate-400 focus:bg-white focus:outline-none"
                  placeholder="0 18 * * *"
                  value={customCron}
                  onChange={(event) => setCustomCron(event.target.value)}
                  disabled={submitting}
                />
                <p className="text-xs text-slate-500">Format: minute hour day month day-of-week. Example: 0 18 * * * runs daily at 6:00 PM.</p>
              </label>
            ) : null}

            <div className="rounded-xl bg-slate-900 px-4 py-4 text-white shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-300">Preview</p>
              <p className="mt-1 text-base font-semibold">{cronDetails.summary}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium">
                <span>cron</span>
                <code>{cronDetails.cron ?? "--"}</code>
              </div>
            </div>

            {cronDetails.error ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{cronDetails.error}</p>
            ) : null}
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              {hasUsers
                ? "You can add more reminders later or adjust this schedule by editing the cron in the API."
                : "Add at least one user before creating reminders."}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                onClick={() => void handleSendTest()}
                disabled={!hasUsers || submitting || testing}
              >
                {testing ? "Sending..." : "Send test now"}
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={!hasUsers || submitting}
              >
                {submitting ? "Saving..." : "Save reminder"}
              </button>
            </div>
          </div>
        </form>

        {testMessage ? (
          <p className="mt-6 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{testMessage}</p>
        ) : null}
        {testError ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{testError}</p>
        ) : null}
        {statusMessage ? (
          <p className="mt-6 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{statusMessage}</p>
        ) : null}
        {formError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
      </section>

      {/* Current Reminders Section */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Current Reminders</h2>
            <p className="text-sm text-slate-600">
              Recently created reminders. For full management, visit the{" "}
              <Link href="/reminders" className="underline text-blue-600 hover:text-blue-800">
                reminders page
              </Link>.
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

        {remindersError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{remindersError}</p>
        ) : null}

        <div className="mt-6">
          {loadingReminders ? (
            <p className="text-center text-slate-600 py-8">Loading reminders...</p>
          ) : reminders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 mb-2">No reminders created yet.</p>
              <p className="text-sm text-slate-500">Create your first reminder above to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-500 mb-4">
                Showing {reminders.length} reminder{reminders.length !== 1 ? 's' : ''} (most recent first)
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {reminders.slice(0, 6).map((reminder) => (
                  <div key={reminder.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-medium text-slate-900 text-sm">{reminder.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        reminder.enabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {reminder.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    
                    {reminder.body && (
                      <p className="text-xs text-slate-600 mb-2 truncate">{reminder.body}</p>
                    )}
                    
                    <div className="space-y-1 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>User:</span>
                        <span className="font-medium">{getUserName(reminder.user_id)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Schedule:</span>
                        <span className="font-mono">{reminder.cron}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Description:</span>
                        <span>{formatCronDescription(reminder.cron)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{reminder.created_at ? new Date(reminder.created_at).toLocaleDateString() : 'Recently'}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-2 border-t border-slate-200">
                      <Link
                        href="/reminders"
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Manage this reminder →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              
              {reminders.length > 6 && (
                <div className="text-center pt-4">
                  <Link
                    href="/reminders"
                    className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    View all {reminders.length} reminders
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
