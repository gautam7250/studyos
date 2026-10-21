import type { CalEvent, Course, LectureRecord, Session } from '../types'
import { addDays, durationMin, eachDay, localDateKey, parseKey, weekStart } from './dates'

export interface DayRow { date: string; minutes: number }
export interface Opts { from?: string; to?: string; courseId?: string }
const within = (d: string, o: Opts) => (!o.from || d >= o.from) && (!o.to || d <= o.to)

function group(items: { date: string; minutes: number }[]): DayRow[] {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.date, (m.get(i.date) ?? 0) + i.minutes) // same-day sessions are summed once each
  return [...m].map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date))
}
/** Independent study per local date (sessions only; lecture attendance is separate). */
export function dailyRows(sessions: Session[], o: Opts = {}): DayRow[] {
  return group(sessions.filter((s) => within(s.date, o) && (!o.courseId || s.courseId === o.courseId)))
}
/** Lecture time = duration of events marked attended, on the actual attendance date. */
export function lectureRows(events: CalEvent[], lectures: LectureRecord[], o: Opts = {}): DayRow[] {
  const ev = new Map(events.map((e) => [e.id, e]))
  const items: DayRow[] = []
  for (const l of lectures) {
    const e = ev.get(l.eventId)
    if (!e || l.attendance !== 'attended') continue
    if (o.courseId && e.courseId !== o.courseId) continue
    const date = l.attendedDate || e.date
    if (within(date, o)) items.push({ date, minutes: Math.max(0, durationMin(e.start, e.end)) })
  }
  return group(items)
}
export const mergeRows = (...sets: DayRow[][]): DayRow[] => group(sets.flat())
/** Adds zero-hour days so charts are continuous. */
export function fillZero(rows: DayRow[], from?: string, to?: string): DayRow[] {
  const start = from ?? rows[0]?.date, end = to ?? rows[rows.length - 1]?.date
  if (!start || !end || start > end) return []
  const m = new Map(rows.map((r) => [r.date, r.minutes]))
  return eachDay(start, end).map((date) => ({ date, minutes: m.get(date) ?? 0 }))
}
/** Running total (SQL: SUM(daily) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)). Always derived, never stored. */
export function cumulative(rows: DayRow[]): (DayRow & { cumulative: number })[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date)); let run = 0
  return sorted.map((r) => ({ ...r, cumulative: (run += r.minutes) }))
}
export function weeklyTotals(rows: DayRow[]): DayRow[] { return group(rows.map((r) => ({ date: weekStart(r.date), minutes: r.minutes }))) }
export function monthlyTotals(rows: DayRow[]): DayRow[] { return group(rows.map((r) => ({ date: r.date.slice(0, 7), minutes: r.minutes }))) }
export const sumMinutes = (rows: DayRow[]) => rows.reduce((a, r) => a + r.minutes, 0)

export interface AttendanceStats { attended: number; missed: number; cancelled: number; unrecorded: number; rate: number | null }
/** Rate = attended / (attended + missed). Cancelled and unrecorded sessions are not counted against you. */
export function attendanceStats(events: CalEvent[], lectures: LectureRecord[], today: string, o: Opts = {}): AttendanceStats {
  const rec = new Map(lectures.map((l) => [l.eventId, l.attendance]))
  const s = { attended: 0, missed: 0, cancelled: 0, unrecorded: 0 }
  for (const e of events) {
    if (e.date > today || !within(e.date, o) || (o.courseId && e.courseId !== o.courseId)) continue
    s[rec.get(e.id) ?? 'unrecorded']++
  }
  const d = s.attended + s.missed
  return { ...s, rate: d ? s.attended / d : null }
}
export function courseTargetMinutes(course: Course, from: string, to: string) {
  const days = Math.max(1, Math.round((parseKey(to).getTime() - parseKey(from).getTime()) / 864e5) + 1)
  return Math.round((course.targetHoursPerWeek * 60 * days) / 7)
}
export function weekRange(today: string) { const from = weekStart(today); return { from, to: addDays(from, 6) } }
export { localDateKey }

/** Consecutive days with independent study, ending today (or yesterday if today has none yet). */
export function studyStreak(rows: DayRow[], today: string): number {
  const days = new Set(rows.filter((r) => r.minutes > 0).map((r) => r.date))
  let d = days.has(today) ? today : addDays(today, -1), n = 0
  while (days.has(d)) { n++; d = addDays(d, -1) }
  return n
}
