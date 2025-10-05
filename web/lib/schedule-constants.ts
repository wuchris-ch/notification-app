export interface RecurrencePattern {
  id: string
  label: string
  description: string
  cronTemplate: string
}

export const RECURRENCE_PATTERNS: RecurrencePattern[] = [
  { id: 'daily', label: 'Daily', description: 'Every day', cronTemplate: '{minute} {hour} * * *' },
  { id: 'weekly', label: 'Weekly', description: 'Every week', cronTemplate: '{minute} {hour} * * {days}' },
  { id: 'monthly', label: 'Monthly', description: 'Every month', cronTemplate: '{minute} {hour} {day} * *' },
  { id: 'yearly', label: 'Yearly', description: 'Every year', cronTemplate: '{minute} {hour} {day} {month} *' },
  { id: 'weekdays', label: 'Weekdays', description: 'Monday to Friday', cronTemplate: '{minute} {hour} * * 1-5' },
  { id: 'weekends', label: 'Weekends', description: 'Saturday and Sunday', cronTemplate: '{minute} {hour} * * 0,6' }
]

export const DAYS_OF_WEEK = [
  { id: '1', label: 'Mon', name: 'Monday' },
  { id: '2', label: 'Tue', name: 'Tuesday' },
  { id: '3', label: 'Wed', name: 'Wednesday' },
  { id: '4', label: 'Thu', name: 'Thursday' },
  { id: '5', label: 'Fri', name: 'Friday' },
  { id: '6', label: 'Sat', name: 'Saturday' },
  { id: '0', label: 'Sun', name: 'Sunday' }
]

export const MONTHS = [
  { id: '1', label: 'Jan' }, { id: '2', label: 'Feb' }, { id: '3', label: 'Mar' },
  { id: '4', label: 'Apr' }, { id: '5', label: 'May' }, { id: '6', label: 'Jun' },
  { id: '7', label: 'Jul' }, { id: '8', label: 'Aug' }, { id: '9', label: 'Sep' },
  { id: '10', label: 'Oct' }, { id: '11', label: 'Nov' }, { id: '12', label: 'Dec' }
]

export const PACIFIC_TIMEZONE = 'America/Vancouver'