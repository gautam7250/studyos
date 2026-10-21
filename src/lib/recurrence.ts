import type { CalEvent, ID, Series } from '../types'
import { addDays, weekday } from './dates'

/** Deterministic ids (`seriesId_date`) mean regenerating a series can never create duplicates. */
export function generateEvents(s: Series): CalEvent[] {
  const out: CalEvent[] = []
  let d = s.startDate
  while (weekday(d) !== s.weekday) d = addDays(d, 1)
  for (; d <= s.endDate && out.length < 200; d = addDays(d, 7)) {
    if (s.skip.includes(d)) continue
    out.push({ id: `${s.id}_${d}`, seriesId: s.id, courseId: s.courseId, title: s.title, date: d, start: s.start, end: s.end, room: s.room, instructor: s.instructor, type: s.type, demo: s.demo })
  }
  return out
}
/**
 * Brings stored events in line with a series. Detached (individually edited) occurrences are kept untouched,
 * and occurrences with a lecture record (protectedIds) are never removed.
 */
export function reconcileSeries(s: Series, existing: CalEvent[], protectedIds: Set<ID>) {
  const mine = existing.filter((e) => e.seriesId === s.id)
  const wanted = generateEvents(s); const wantedIds = new Set(wanted.map((e) => e.id))
  const have = new Map(mine.map((e) => [e.id, e]))
  const put: CalEvent[] = []
  for (const w of wanted) { const cur = have.get(w.id); if (!cur) put.push(w); else if (!cur.detached) put.push({ ...w }) }
  const remove = mine.filter((e) => !wantedIds.has(e.id) && !e.detached && !protectedIds.has(e.id)).map((e) => e.id)
  return { put, remove }
}
export function findConflicts(events: CalEvent[], c: { id?: ID; date: string; start: string; end: string }): CalEvent[] {
  return events.filter((e) => e.id !== c.id && e.date === c.date && e.start < c.end && e.end > c.start)
}
