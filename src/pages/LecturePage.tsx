import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EventForm from '../components/EventForm'
import { FilesPanel } from '../components/Files'
import { NotesPanel } from '../components/Notes'
import SessionForm from '../components/SessionForm'
import { TaskForm } from '../components/Tasks'
import { Button, Card, Confirm, CourseTag, Empty, Field, PageHeader, inputCls } from '../components/ui'
import { planEventDelete } from '../lib/cascade'
import { durationMin, fmtDate, fmtStamp, todayKey } from '../lib/dates'
import { nowIso } from '../lib/util'
import { useData } from '../store'
import type { Attendance, CalEvent, LectureRecord } from '../types'

const ATT: [Attendance, string][] = [['unrecorded', 'Not recorded'], ['attended', 'Attended'], ['missed', 'Missed'], ['cancelled', 'Cancelled']]
const FIELDS: [keyof LectureRecord, string, string][] = [
  ['topics', 'Topics covered', 'What was this session about?'], ['concepts', 'Main concepts and definitions', ''], ['examples', 'Important examples', ''],
  ['notes', 'Important notes', ''], ['questions', 'Questions for the professor', ''], ['homework', 'Homework assigned', ''], ['summary', 'Personal summary or reflection', ''], ['followUps', 'Follow-up tasks (to remember)', ''],
]

export default function LecturePage() {
  const { id = '' } = useParams(); const { data } = useData(); const ev = data.events.find((e) => e.id === id)
  if (!ev) return <Empty title="This lecture no longer exists" hint="It may have been deleted. Your notes and sessions are kept." action={<Link className="underline" to="/timetable">Back to the timetable</Link>} />
  return <Lecture key={ev.id} ev={ev} />
}

function Lecture({ ev }: { ev: CalEvent }) {
  const { data, put, apply, courseMap, unlinkLectureFiles } = useData()
  const saved = data.lectures.find((l) => l.eventId === ev.id)
  const blank: LectureRecord = { id: ev.id, eventId: ev.id, courseId: ev.courseId, attendance: 'unrecorded', topics: '', concepts: '', examples: '', notes: '', questions: '', homework: '', summary: '', followUps: '', updatedAt: '' }
  const [draft, setDraft] = useState<LectureRecord>(saved ?? blank)
  const [dirty, setDirty] = useState(false); const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false); const [scope, setScope] = useState<'one' | 'series'>('one'); const [task, setTask] = useState(false); const [session, setSession] = useState(false)
  const course = courseMap.get(ev.courseId)
  const persist = async (next: LectureRecord) => { const rec = { ...next, courseId: ev.courseId, updatedAt: nowIso() }; if (await put('lectures', rec)) { setDraft(rec); setDirty(false) } }
  const sessions = data.sessions.filter((s) => s.lectureId === ev.id); const tasks = data.tasks.filter((t) => t.lectureId === ev.id)
  const lectureMin = durationMin(ev.start, ev.end)
  return (
    <>
      <PageHeader title={ev.title} subtitle={<><CourseTag course={course} /> · {fmtDate(ev.date)}, {ev.start}–{ev.end}{ev.room && ` · ${ev.room}`}{ev.instructor && ` · ${ev.instructor}`}{ev.seriesId && ' · repeats weekly'}</>}
        actions={<>{course && <Link to={`/courses/${course.id}`} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface2">Open course</Link>}<Button onClick={() => setEditing(true)}>Edit or move</Button><Button variant="danger" onClick={() => setDeleting(true)}>Delete…</Button></>} />
      <Card title="Attendance">
        <div role="group" aria-label="Attendance" className="flex flex-wrap items-end gap-2">
          {ATT.map(([v, l]) => <Button key={v} variant={draft.attendance === v ? 'primary' : 'default'} aria-pressed={draft.attendance === v} onClick={() => persist({ ...draft, attendance: v, attendedDate: v === 'attended' ? draft.attendedDate ?? (ev.date <= todayKey() ? ev.date : todayKey()) : undefined })}>{l}</Button>)}
          {draft.attendance === 'attended' && <Field label="Actual attendance date"><input type="date" className={inputCls + ' w-auto'} value={draft.attendedDate ?? ev.date} onChange={(e) => e.target.value && persist({ ...draft, attendedDate: e.target.value })} /></Field>}
        </div>
        <p className="mt-2 text-xs text-soft">Lecture time ({lectureMin} min) counts as lecture attendance, never as independent study.</p>
      </Card>

      <Card title="Lecture record" className="mt-4" action={<span className="text-xs text-soft">{dirty ? 'Unsaved changes' : saved ? `Saved ${fmtStamp(saved.updatedAt)}` : 'Not saved yet'}</span>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, label, ph]) => <Field key={k} label={label} className={k === 'topics' || k === 'summary' ? 'sm:col-span-2' : ''}><textarea rows={k === 'topics' ? 2 : 4} placeholder={ph} className={inputCls} value={draft[k] as string} onChange={(e) => { setDraft({ ...draft, [k]: e.target.value }); setDirty(true) }} /></Field>)}
        </div>
        <div className="mt-3 flex justify-end"><Button variant="primary" disabled={!dirty && !!saved} onClick={() => persist(draft)}>Save lecture record</Button></div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Follow-up tasks" action={<Button onClick={() => setTask(true)}>New task from this lecture</Button>}>
          {tasks.length === 0 ? <p className="text-sm text-soft">No tasks linked to this lecture yet.</p> : <ul className="space-y-1 text-sm">{tasks.map((t) => <li key={t.id} className={t.status === 'done' ? 'text-soft line-through' : ''}>{t.title}{t.due && ` · due ${fmtDate(t.due)}`}</li>)}</ul>}
        </Card>
        <Card title="Linked study sessions" action={<Button onClick={() => setSession(true)}>Log study for this lecture</Button>}>
          {sessions.length === 0 ? <p className="text-sm text-soft">No independent study linked yet.</p> : <ul className="space-y-1 text-sm">{sessions.map((s) => <li key={s.id}>{fmtDate(s.date)} · {s.minutes} min{s.topics && ` · ${s.topics}`}</li>)}<li className="text-xs text-soft">Total {sessions.reduce((a, s) => a + s.minutes, 0)} min independent study</li></ul>}
        </Card>
      </div>
      <h2 className="mb-3 mt-8 font-display text-xl">Files for this lecture</h2>
      <FilesPanel courseId={ev.courseId} lectureId={ev.id} />
      <h2 className="mb-3 mt-8 font-display text-xl">Notes for this lecture</h2>
      <NotesPanel courseId={ev.courseId} lectureId={ev.id} />

      {editing && <EventForm event={ev} onClose={() => setEditing(false)} />}
      {task && <TaskForm defaults={{ courseId: ev.courseId, lectureId: ev.id, title: draft.homework.split('\n')[0] || '' }} onClose={() => setTask(false)} />}
      {session && <SessionForm defaults={{ courseId: ev.courseId, lectureId: ev.id, type: 'lecture-review', topics: draft.topics.split('\n')[0] }} onClose={() => setSession(false)} />}
      {deleting && (
        <Confirm title="Delete this lecture?" confirmLabel="Delete" onCancel={() => setDeleting(false)} onConfirm={async () => { if (await apply(planEventDelete(data, ev.id, scope))) { await unlinkLectureFiles(scope === 'series' && ev.seriesId ? data.events.filter((e) => e.seriesId === ev.seriesId).map((e) => e.id) : [ev.id]); setDeleting(false); location.hash = '#/timetable' } }}>
          {ev.seriesId && <fieldset className="mb-3"><label className="mr-4"><input type="radio" name="dscope" checked={scope === 'one'} onChange={() => setScope('one')} /> Only this occurrence</label><label><input type="radio" name="dscope" checked={scope === 'series'} onChange={() => setScope('series')} /> The entire series</label></fieldset>}
          <p>The calendar event{scope === 'series' ? 's' : ''} and the lecture record{scope === 'series' ? 's' : ''} (topics, concepts, summary, attendance) will be deleted. Notes, study sessions, tasks and files linked to it are kept and only unlinked.</p>
        </Confirm>
      )}
    </>
  )
}
