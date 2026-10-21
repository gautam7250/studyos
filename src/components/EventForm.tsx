import { useMemo, useState } from 'react'
import { findConflicts, reconcileSeries } from '../lib/recurrence'
import { addDays, durationMin, fmtDate, isValidKey, todayKey, weekday } from '../lib/dates'
import { uid } from '../lib/util'
import { useData } from '../store'
import { type CalEvent, EVENT_TYPES, type Series } from '../types'
import { Button, CourseSelect, Field, Modal, inputCls } from './ui'

/** Create or edit a calendar event. Existing events are never deleted or moved to resolve a conflict; conflicts only warn. */
export default function EventForm({ event, defaults, onClose }: { event?: CalEvent; defaults?: Partial<CalEvent>; onClose: (saved?: CalEvent) => void }) {
  const { data, apply, courseMap } = useData()
  const series = event?.seriesId ? data.series.find((s) => s.id === event.seriesId) : undefined
  const [f, setF] = useState({ courseId: event?.courseId ?? defaults?.courseId ?? '', title: event?.title ?? defaults?.title ?? '', type: event?.type ?? defaults?.type ?? 'lecture', date: event?.date ?? defaults?.date ?? todayKey(), start: event?.start ?? defaults?.start ?? '10:00', end: event?.end ?? defaults?.end ?? '12:00', room: event?.room ?? defaults?.room ?? '', instructor: event?.instructor ?? defaults?.instructor ?? '' })
  const [repeat, setRepeat] = useState(false); const [until, setUntil] = useState(addDays(f.date, 7 * 12))
  const [scope, setScope] = useState<'one' | 'all'>('one'); const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const course = courseMap.get(f.courseId)
  const editingAll = !!series && scope === 'all'
  const conflicts = useMemo(() => (isValidKey(f.date) && f.start < f.end ? findConflicts(data.events, { id: event?.id, ...f }) : []), [data.events, event?.id, f])

  async function save() {
    if (!f.courseId) return setErr('Choose a course.')
    if (!isValidKey(f.date)) return setErr('Enter a valid date.')
    if (!f.start || !f.end || durationMin(f.start, f.end) <= 0) return setErr('The end time must be after the start time.')
    const title = f.title.trim() || course?.name || 'Lecture'
    const fields = { courseId: f.courseId, title, type: f.type, start: f.start, end: f.end, room: f.room, instructor: f.instructor }
    const protectedIds = new Set(data.lectures.map((l) => l.eventId))
    if (event && series && scope === 'all') {
      if (until && repeat && !isValidKey(until)) return setErr('Enter a valid end date for the series.')
      const next: Series = { ...series, ...fields, endDate: repeat && until ? until : series.endDate }
      const r = reconcileSeries(next, data.events, protectedIds)
      if (await apply({ series: { put: [next] }, events: { put: r.put, del: r.remove } })) onClose()
      return
    }
    if (event) {
      const moved = f.date !== event.date || f.start !== event.start || f.end !== event.end
      const rec: CalEvent = { ...event, ...fields, date: f.date, detached: event.seriesId ? event.detached || moved || undefined : undefined }
      // an edited occurrence is detached so later series edits do not overwrite it
      if (event.seriesId) rec.detached = true
      if (await apply({ events: { put: [rec] }, lectures: { put: data.lectures.filter((l) => l.eventId === event.id && l.courseId !== f.courseId).map((l) => ({ ...l, courseId: f.courseId })) } })) onClose(rec)
      return
    }
    if (repeat) {
      if (!isValidKey(until) || until < f.date) return setErr('The series end date must be on or after the first date.')
      const s: Series = { id: uid('series'), courseId: f.courseId, title, weekday: weekday(f.date), start: f.start, end: f.end, room: f.room, instructor: f.instructor, type: f.type, startDate: f.date, endDate: until, skip: [] }
      const r = reconcileSeries(s, [], new Set())
      if (await apply({ series: { put: [s] }, events: { put: r.put } })) onClose()
      return
    }
    const rec: CalEvent = { id: uid('event'), ...fields, date: f.date }
    if (await apply({ events: { put: [rec] } })) onClose(rec)
  }
  return (
    <Modal title={event ? 'Edit event' : 'New event'} onClose={() => onClose()} wide>
      {series && (
        <fieldset className="mb-4 rounded-md border border-line p-3 text-sm">
          <legend className="px-1 font-medium">This event repeats weekly. Apply changes to:</legend>
          <label className="mr-6"><input type="radio" name="scope" checked={scope === 'one'} onChange={() => setScope('one')} /> This occurrence only ({fmtDate(event!.date)})</label>
          <label><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} /> Entire series (edited occurrences stay as they are)</label>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Course"><CourseSelect value={f.courseId} onChange={(v) => { const c = courseMap.get(v); setF({ ...f, courseId: v, room: f.room || c?.room || '', instructor: f.instructor || c?.instructor || '' }) }} /></Field>
        <Field label="Title" hint="Defaults to the course name."><input className={inputCls} value={f.title} onChange={set('title')} /></Field>
        <Field label="Event type"><select className={inputCls} value={f.type} onChange={set('type')}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Date" hint={editingAll ? 'To change the weekday of a series, create a new series.' : undefined}><input type="date" className={inputCls} value={f.date} onChange={set('date')} disabled={editingAll} /></Field>
        <Field label="Start time"><input type="time" className={inputCls} value={f.start} onChange={set('start')} /></Field>
        <Field label="End time"><input type="time" className={inputCls} value={f.end} onChange={set('end')} /></Field>
        <Field label="Room"><input className={inputCls} value={f.room} onChange={set('room')} /></Field>
        <Field label="Instructor"><input className={inputCls} value={f.instructor} onChange={set('instructor')} /></Field>
      </div>
      {(!event || editingAll) && (
        <div className="mt-3 text-sm">
          <label><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> {editingAll ? 'Change the series end date' : 'Repeat weekly'}</label>
          {repeat && <div className="mt-2 max-w-xs"><Field label="Repeat until"><input type="date" className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} /></Field></div>}
        </div>
      )}
      {conflicts.length > 0 && (
        <div role="status" className="mt-3 rounded-md border border-warn px-3 py-2 text-sm text-warn">
          Time conflict with {conflicts.map((c) => `${courseMap.get(c.courseId)?.name ?? 'an event'} (${c.start}–${c.end})`).join(', ')}. You can still save; nothing will be moved or deleted.
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button onClick={() => onClose()}>Cancel</Button><Button variant="primary" onClick={save}>{event ? 'Save changes' : 'Add event'}</Button></div>
    </Modal>
  )
}
