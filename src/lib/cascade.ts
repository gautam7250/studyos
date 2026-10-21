import type { Changes, ID, Snapshot } from '../types'
import { nowIso } from './util'

export interface CoursePlan { changes: Changes; counts: Record<string, number> }
/** Deleting a course removes everything that belongs to it. The UI shows `counts` before confirming. Archiving removes nothing. */
export function planCourseDelete(s: Snapshot, courseId: ID): CoursePlan {
  const ids = <T extends { id: string; courseId?: string }>(a: T[]) => a.filter((x) => x.courseId === courseId).map((x) => x.id)
  const changes: Changes = {
    courses: { del: [courseId] }, series: { del: ids(s.series) }, events: { del: ids(s.events) }, lectures: { del: ids(s.lectures) },
    notes: { del: ids(s.notes) }, sessions: { del: ids(s.sessions) }, tasks: { del: ids(s.tasks) }, exams: { del: ids(s.exams) },
  }
  const n = (k: keyof Changes) => changes[k]?.del?.length ?? 0
  return { changes, counts: { lectures: n('events'), 'lecture records': n('lectures'), notes: n('notes'), 'study sessions': n('sessions'), tasks: n('tasks'), exams: n('exams') } }
}
/** Removes one occurrence (adds it to the series skip list so it is not regenerated) or a whole series. */
export function planEventDelete(s: Snapshot, eventId: ID, scope: 'one' | 'series'): Changes {
  const ev = s.events.find((e) => e.id === eventId); if (!ev) return {}
  const evIds = scope === 'series' && ev.seriesId ? s.events.filter((e) => e.seriesId === ev.seriesId).map((e) => e.id) : [eventId]
  const gone = new Set(evIds); const t = nowIso()
  const changes: Changes = { events: { del: evIds }, lectures: { del: s.lectures.filter((l) => gone.has(l.eventId)).map((l) => l.id) } }
  if (ev.seriesId) {
    const ser = s.series.find((x) => x.id === ev.seriesId)
    if (scope === 'series') changes.series = { del: [ev.seriesId] }
    else if (ser) changes.series = { put: [{ ...ser, skip: [...new Set([...ser.skip, ev.date])] }] }
  }
  // keep notes, sessions and tasks; just unlink the lecture reference
  const unlink = <T extends { lectureId?: string }>(a: T[]) => a.filter((x) => x.lectureId && gone.has(x.lectureId)).map((x) => ({ ...x, lectureId: undefined }))
  const nn = unlink(s.notes).map((x) => ({ ...x, updatedAt: t }))
  if (nn.length) changes.notes = { put: nn }
  const ss = unlink(s.sessions); if (ss.length) changes.sessions = { put: ss }
  const tt = unlink(s.tasks); if (tt.length) changes.tasks = { put: tt }
  return changes
}
export function integrityReport(s: Snapshot): { label: string; count: number }[] {
  const courses = new Set(s.courses.map((c) => c.id)), events = new Set(s.events.map((e) => e.id))
  const bad = (a: { courseId?: string }[]) => a.filter((x) => x.courseId && !courses.has(x.courseId)).length
  const lec = (a: { lectureId?: string }[]) => a.filter((x) => x.lectureId && !events.has(x.lectureId)).length
  return [
    { label: 'Events pointing to a missing course', count: bad(s.events) }, { label: 'Lecture records without an event', count: s.lectures.filter((l) => !events.has(l.eventId)).length },
    { label: 'Notes pointing to a missing course', count: bad(s.notes) }, { label: 'Notes linked to a missing lecture', count: lec(s.notes) },
    { label: 'Sessions pointing to a missing course', count: bad(s.sessions) }, { label: 'Tasks pointing to a missing course', count: bad(s.tasks) },
    { label: 'Exams pointing to a missing course', count: bad(s.exams) },
  ]
}
