import type { Changes, Course, Snapshot } from '../types'
import { addDays, todayKey, weekday } from './dates'
import { generateEvents } from './recurrence'

/** Everything generated here carries demo:true so it can be removed again in one step. Nothing is added to the exam dates. */
export function planDemoLoad(s: Snapshot, today = todayKey()): Changes {
  const courses = s.courses.filter((c) => !c.archived).slice(0, 3) as Course[]
  if (!courses.length) return {}
  const ch: Required<Pick<Changes, 'series' | 'events' | 'lectures' | 'sessions' | 'tasks' | 'notes' | 'exams'>> = { series: { put: [] }, events: { put: [] }, lectures: { put: [] }, sessions: { put: [] }, tasks: { put: [] }, notes: { put: [] }, exams: { put: [] } }
  const mondayish = addDays(today, -21)
  courses.forEach((c, i) => {
    const start = addDays(mondayish, ((i * 2 + 1 - weekday(mondayish) + 7) % 7))
    const ser = { id: `demo_series_${i}`, courseId: c.id, title: `${c.name} (demo)`, weekday: weekday(start), start: `${10 + i * 2}:00`, end: `${11 + i * 2}:30`, room: `Demo room ${i + 1}`, instructor: c.instructor, type: 'lecture' as const, startDate: start, endDate: addDays(today, 28), skip: [], demo: true }
    ch.series.put!.push(ser)
    for (const e of generateEvents(ser)) {
      ch.events.put!.push({ ...e, demo: true })
      if (e.date < today) ch.lectures.put!.push({ id: e.id, eventId: e.id, courseId: c.id, attendance: (e.date.charCodeAt(9) + i) % 5 === 0 ? 'missed' : 'attended', topics: 'Demo topic: sample lecture content', concepts: '', examples: '', notes: '', questions: '', homework: '', summary: '', followUps: '', updatedAt: new Date().toISOString(), demo: true })
    }
    ch.exams.put!.push({ id: `demo_exam_${i}`, courseId: c.id, title: `${c.name}: demo exam (no date)`, format: 'Demo', topics: ['Topic A', 'Topic B', 'Topic C'].map((t, k) => ({ id: `demo_topic_${i}_${k}`, title: t, done: k === 0, confidence: k === 0 ? 4 : k === 1 ? 2 : 0 })), questions: [], mocks: [], revisions: [], nextAction: '', demo: true })
  })
  for (let d = 0; d < 21; d++) {
    const date = addDays(today, -d - 1), c = courses[d % 3]
    if (d % 7 === 5) continue // a few zero-study days
    ch.sessions.put!.push({ id: `demo_session_${d}`, courseId: c.id, date, minutes: 30 + ((d * 37) % 4) * 30, type: d % 4 === 0 ? 'revision' : 'independent', topics: 'Demo session', notes: '', completed: true, demo: true })
  }
  const t = (id: string, title: string, due: string | undefined, over: Partial<Snapshot['tasks'][number]> = {}) => ({ id: `demo_task_${id}`, courseId: courses[0].id, title, description: '', due, priority: 'medium' as const, status: 'todo' as const, tags: ['demo'], notes: '', url: '', createdAt: new Date().toISOString(), demo: true, ...over })
  ch.tasks.put!.push(t('1', 'Demo: overdue exercise sheet', addDays(today, -2), { priority: 'high' }), t('2', 'Demo: reading due soon', addDays(today, 3)), t('3', 'Demo: finished assignment', addDays(today, -5), { status: 'done', completedDate: addDays(today, -6) }), t('4', 'Demo: someday task', undefined, { priority: 'low' }))
  ch.notes.put!.push({ id: 'demo_note_1', courseId: courses[0].id, title: 'Demo note', body: 'This is sample content. Remove all demo data in Settings.', tags: ['demo'], pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), demo: true })
  return ch
}
export function planDemoRemove(s: Snapshot): Changes {
  const ids = <T extends { id: string; demo?: boolean }>(a: T[]) => a.filter((x) => x.demo).map((x) => x.id)
  const gone = new Set(ids(s.events)); const unlink = <T extends { lectureId?: string; demo?: boolean }>(a: T[]) => a.filter((x) => !x.demo && x.lectureId && gone.has(x.lectureId)).map((x) => ({ ...x, lectureId: undefined }))
  return { series: { del: ids(s.series) }, events: { del: [...gone] }, lectures: { del: ids(s.lectures) }, sessions: { del: ids(s.sessions), put: unlink(s.sessions) }, tasks: { del: ids(s.tasks), put: unlink(s.tasks) }, notes: { del: ids(s.notes), put: unlink(s.notes) }, exams: { del: ids(s.exams) } }
}
export const hasDemo = (s: Snapshot) => [s.series, s.events, s.lectures, s.sessions, s.tasks, s.notes, s.exams].some((a) => (a as { demo?: boolean }[]).some((x) => x.demo))
