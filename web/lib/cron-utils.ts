import { RECURRENCE_PATTERNS, DAYS_OF_WEEK, MONTHS } from './schedule-constants'

export interface ScheduleState {
  hour: number
  minute: number
  pattern: string
  days: string[]
  day: number
  month: number
}

/**
 * Parse a cron expression into a schedule state object
 */
export function parseCronToState(cron: string): ScheduleState {
  const parts = cron.split(' ')
  if (parts.length !== 5) {
    return { hour: 8, minute: 0, pattern: 'daily', days: ['1'], day: 1, month: 1 }
  }
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  const hourNum = parseInt(hour) || 0
  const minuteNum = parseInt(minute) || 0
  
  // Determine pattern
  let pattern = 'daily'
  let days = ['1']
  let day = 1
  let monthNum = 1
  
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    pattern = 'daily'
  } else if (dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') {
    pattern = 'weekdays'
  } else if (dayOfMonth === '*' && month === '*' && (dayOfWeek === '0,6' || dayOfWeek === '6,0')) {
    pattern = 'weekends'
  } else if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    pattern = 'weekly'
    days = dayOfWeek.split(',')
  } else if (dayOfMonth !== '*' && month === '*') {
    pattern = 'monthly'
    day = parseInt(dayOfMonth) || 1
  } else if (dayOfMonth !== '*' && month !== '*') {
    pattern = 'yearly'
    day = parseInt(dayOfMonth) || 1
    monthNum = parseInt(month) || 1
  }
  
  return { hour: hourNum, minute: minuteNum, pattern, days, day, month: monthNum }
}

/**
 * Build a cron expression from a schedule state object
 */
export function buildCronFromState(state: ScheduleState): string {
  const pattern = RECURRENCE_PATTERNS.find(p => p.id === state.pattern)
  if (!pattern) return '0 8 * * *' // Default fallback

  let cron = pattern.cronTemplate
    .replace('{hour}', state.hour.toString())
    .replace('{minute}', state.minute.toString())

  switch (state.pattern) {
    case 'weekly':
      cron = cron.replace('{days}', state.days.join(','))
      break
    case 'monthly':
      cron = cron.replace('{day}', state.day.toString())
      break
    case 'yearly':
      cron = cron.replace('{day}', state.day.toString())
      cron = cron.replace('{month}', state.month.toString())
      break
  }

  return cron
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalSuffix(num: number): string {
  const j = num % 10
  const k = num % 100
  if (j === 1 && k !== 11) return 'st'
  if (j === 2 && k !== 12) return 'nd'
  if (j === 3 && k !== 13) return 'rd'
  return 'th'
}

/**
 * Get a human-readable description of a schedule
 */
export function getScheduleDescription(state: ScheduleState): string {
  const timeStr = `${state.hour.toString().padStart(2, '0')}:${state.minute.toString().padStart(2, '0')}`
  
  switch (state.pattern) {
    case 'daily':
      return `Every day at ${timeStr}`
    case 'weekly':
      if (state.days.length === 0) return 'No days selected'
      const dayNames = state.days.map(id => DAYS_OF_WEEK.find(d => d.id === id)?.name).join(', ')
      return `Every ${dayNames} at ${timeStr}`
    case 'monthly':
      return `Every month on the ${state.day}${getOrdinalSuffix(state.day)} at ${timeStr}`
    case 'yearly':
      const monthName = MONTHS.find(m => m.id === state.month.toString())?.label
      return `Every year on ${monthName} ${state.day}${getOrdinalSuffix(state.day)} at ${timeStr}`
    case 'weekdays':
      return `Every weekday (Mon-Fri) at ${timeStr}`
    case 'weekends':
      return `Every weekend (Sat-Sun) at ${timeStr}`
    default:
      return ''
  }
}