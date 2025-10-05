"use client"

import { useState } from "react"
import { Channel, Reminder } from "../../lib/api"
import { 
  RECURRENCE_PATTERNS, 
  DAYS_OF_WEEK, 
  MONTHS, 
  PACIFIC_TIMEZONE 
} from "../../lib/schedule-constants"
import {
  parseCronToState,
  buildCronFromState,
  getScheduleDescription,
  getOrdinalSuffix,
  type ScheduleState
} from "../../lib/cron-utils"

interface EditReminderFormProps {
  reminder: Reminder
  channels: Channel[]
  onSave: (reminder: Reminder, channelIds: number[]) => void
  onCancel: () => void
  submitting: boolean
  setReminder: (reminder: Reminder) => void
  selectedChannelIds: number[]
  setSelectedChannelIds: (ids: number[]) => void
}

export function EditReminderForm({ 
  reminder, 
  channels, 
  onSave, 
  onCancel, 
  submitting, 
  setReminder,
  selectedChannelIds,
  setSelectedChannelIds
}: EditReminderFormProps) {
  const [scheduleState, setScheduleState] = useState<ScheduleState>(() => 
    parseCronToState(reminder.cron)
  )

  const updateField = (field: keyof Reminder, value: string | boolean) => {
    setReminder({ ...reminder, [field]: value })
  }

  const toggleChannel = (channelId: number) => {
    setSelectedChannelIds(
      selectedChannelIds.includes(channelId)
        ? selectedChannelIds.filter(id => id !== channelId)
        : [...selectedChannelIds, channelId]
    )
  }

  const toggleDay = (dayId: string) => {
    setScheduleState(prev => ({
      ...prev,
      days: prev.days.includes(dayId)
        ? prev.days.filter(d => d !== dayId)
        : [...prev.days, dayId].sort()
    }))
  }

  const handleSave = () => {
    const updatedReminder = {
      ...reminder,
      cron: buildCronFromState(scheduleState),
      timezone: PACIFIC_TIMEZONE // Always use Vancouver timezone
    }
    onSave(updatedReminder, selectedChannelIds)
  }

  return (
    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
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
      
      {/* Schedule Configuration */}
      <div className="space-y-3 border-t pt-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2">Recurrence Pattern</label>
          <div className="grid grid-cols-3 gap-2">
            {RECURRENCE_PATTERNS.map(pattern => (
              <button
                key={pattern.id}
                type="button"
                onClick={() => setScheduleState(prev => ({ ...prev, pattern: pattern.id }))}
                className={`p-2 text-xs rounded border transition-colors ${
                  scheduleState.pattern === pattern.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-medium">{pattern.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Time Selection */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Hour</label>
            <select
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              value={scheduleState.hour}
              onChange={(e) => setScheduleState(prev => ({ ...prev, hour: parseInt(e.target.value) }))}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i.toString().padStart(2, '0')}:00 ({i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Minute</label>
            <select
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              value={scheduleState.minute}
              onChange={(e) => setScheduleState(prev => ({ ...prev, minute: parseInt(e.target.value) }))}
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
        {scheduleState.pattern === 'weekly' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Days of Week</label>
            <div className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className={`p-1 text-xs rounded border transition-colors ${
                    scheduleState.days.includes(day.id)
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
        {(scheduleState.pattern === 'monthly' || scheduleState.pattern === 'yearly') && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Day of Month</label>
            <select
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              value={scheduleState.day}
              onChange={(e) => setScheduleState(prev => ({ ...prev, day: parseInt(e.target.value) }))}
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
        {scheduleState.pattern === 'yearly' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Month</label>
            <select
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              value={scheduleState.month}
              onChange={(e) => setScheduleState(prev => ({ ...prev, month: parseInt(e.target.value) }))}
            >
              {MONTHS.map(month => (
                <option key={month.id} value={month.id}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Schedule Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <p className="text-xs font-medium text-blue-900">
            Schedule: {getScheduleDescription(scheduleState)}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Timezone: Pacific Time (Vancouver) with DST
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-2">Send to channels:</label>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {channels.map(channel => (
            <label key={channel.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedChannelIds.includes(channel.id)}
                onChange={() => toggleChannel(channel.id)}
                className="rounded"
              />
              <span className="text-sm">{channel.name}</span>
              <span className="text-xs text-slate-500">({channel.ntfy_topic})</span>
            </label>
          ))}
        </div>
        {selectedChannelIds.length === 0 && (
          <p className="text-xs text-red-600 mt-1">Select at least one channel</p>
        )}
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
          onClick={handleSave}
          disabled={submitting || selectedChannelIds.length === 0}
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