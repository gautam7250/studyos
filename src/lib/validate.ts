import { isValidKey, timeToMin } from './dates'

/** Returns an error message, or null when a manual session is valid. */
export function validateSession(s: { date: string; minutes: number; startTime?: string; endTime?: string; courseId: string }): string | null {
  if (!s.courseId) return 'Choose a course.'
  if (!isValidKey(s.date)) return 'Enter a valid date.'
  if (!Number.isFinite(s.minutes) || !Number.isInteger(s.minutes)) return 'Duration must be a whole number of minutes.'
  if (s.minutes < 1) return 'Duration must be at least 1 minute.'
  if (s.minutes > 1440) return 'A single session cannot exceed 24 hours.'
  if (s.startTime && s.endTime && timeToMin(s.endTime) <= timeToMin(s.startTime)) return 'End time must be after start time.'
  return null
}
