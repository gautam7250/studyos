import { useState } from 'react'
import { fmtShort, localDateKey, minToTime, timeToMin, todayKey } from '../lib/dates'
import { uid } from '../lib/util'
import { validateSession } from '../lib/validate'
import { useData } from '../store'
import { SESSION_TYPES, type Session, type SessionType } from '../types'
import { Button, CourseSelect, Field, Modal, inputCls } from './ui'

/** Manual entry and editing. Also used to confirm a stopped timer (fixed id makes saving idempotent). */
export default function SessionForm({ session, defaults, title, onClose, onSaved }: { session?: Session; defaults?: Partial<Session>; title?: string; onClose: () => void; onSaved?: (s: Session) => void }) {
  const { data, put } = useData(); const d = { ...defaults, ...session }
  const [f, setF] = useState({ courseId: d.courseId ?? '', date: d.date ?? todayKey(), start: d.startTime ?? '', end: d.endTime ?? '', minutes: String(d.minutes ?? 60), type: (d.type ?? 'independent') as SessionType, topics: d.topics ?? '', notes: d.notes ?? '', completed: d.completed ?? true, lectureId: d.lectureId ?? '', taskId: d.taskId ?? '' })
  const [err, setErr] = useState(''); const [dup, setDup] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const lectures = data.events.filter((e) => e.courseId === f.courseId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60)
  const tasks = data.tasks.filter((t) => t.courseId === f.courseId && t.status !== 'done')
  function times(next: typeof f) { // keep duration in sync when both times are given
    if (next.start && next.end && timeToMin(next.end) > timeToMin(next.start)) next.minutes = String(timeToMin(next.end) - timeToMin(next.start))
    setF(next)
  }
  async function save() {
    const minutes = Number(f.minutes)
    const e = validateSession({ courseId: f.courseId, date: f.date, minutes, startTime: f.start || undefined, endTime: f.end || undefined })
    if (e) return setErr(e)
    const isDup = !d.id && !dup && data.sessions.some((s) => s.courseId === f.courseId && s.date === f.date && s.minutes === minutes && (s.startTime ?? '') === f.start && s.topics === f.topics)
    if (isDup) { setErr('An identical session already exists for this course, date and duration.'); setDup(true); return }
    const rec: Session = { id: d.id ?? uid('session'), courseId: f.courseId, date: f.date, startTime: f.start || undefined, endTime: f.end || (f.start ? minToTime(timeToMin(f.start) + minutes) : undefined), minutes, type: f.type, topics: f.topics, notes: f.notes, completed: f.completed, lectureId: f.lectureId || undefined, taskId: f.taskId || undefined, demo: d.demo }
    if (await put('sessions', rec)) { onSaved?.(rec); onClose() }
  }
  return (
    <Modal title={title ?? (session ? 'Edit study session' : 'Log a study session')} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Course"><CourseSelect value={f.courseId} onChange={(v) => setF({ ...f, courseId: v, lectureId: '', taskId: '' })} /></Field>
        <Field label="Session type"><select className={inputCls} value={f.type} onChange={set('type')}>{SESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
        <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={set('date')} /></Field>
        <Field label="Duration (minutes)" hint="Filled in automatically when start and end are set."><input type="number" min={1} max={1440} className={inputCls} value={f.minutes} onChange={set('minutes')} /></Field>
        <Field label="Start time (optional)"><input type="time" className={inputCls} value={f.start} onChange={(e) => times({ ...f, start: e.target.value })} /></Field>
        <Field label="End time (optional)"><input type="time" className={inputCls} value={f.end} onChange={(e) => times({ ...f, end: e.target.value })} /></Field>
        <Field label="Linked lecture (optional)"><select className={inputCls} value={f.lectureId} onChange={set('lectureId')} disabled={!f.courseId}><option value="">None</option>{lectures.map((e) => <option key={e.id} value={e.id}>{fmtShort(e.date)} · {e.title}</option>)}</select></Field>
        <Field label="Linked task (optional)"><select className={inputCls} value={f.taskId} onChange={set('taskId')} disabled={!f.courseId}><option value="">None</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
        <Field label="Topics studied" className="sm:col-span-2"><input className={inputCls} value={f.topics} onChange={set('topics')} /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className={inputCls} value={f.notes} onChange={set('notes')} /></Field>
        <label className="text-sm"><input type="checkbox" checked={f.completed} onChange={(e) => setF({ ...f, completed: e.target.checked })} /> Session completed as planned</label>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button>{dup ? <Button variant="primary" onClick={save}>Save anyway</Button> : <Button variant="primary" onClick={save}>Save session</Button>}</div>
    </Modal>
  )
}
export { localDateKey }
