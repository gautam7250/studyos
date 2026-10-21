import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Chart, { hoursRows } from '../components/Chart'
import CourseForm from '../components/CourseForm'
import { ExamsPanel } from '../components/Exams'
import { FilesPanel } from '../components/Files'
import EventForm from '../components/EventForm'
import { NotesPanel } from '../components/Notes'
import { NextTaskCard, TasksPanel } from '../components/Tasks'
import { Button, Card, Empty, PageHeader, Stat } from '../components/ui'
import { countdown, examProgress } from '../lib/exams'
import { fmtDate, fmtHours, todayKey } from '../lib/dates'
import { attendanceStats, cumulative, dailyRows, fillZero, sumMinutes, weekRange } from '../lib/stats'
import { isOverdue, sortTasks } from '../lib/tasks'
import { pct } from '../lib/util'
import { useData } from '../store'
import type { Attendance } from '../types'

const TABS = [['overview', 'Overview'], ['lectures', 'Lecture history'], ['notes', 'Notes'], ['homework', 'Homework & tasks'], ['exams', 'Exam preparation'], ['files', 'Files'], ['next', 'Next task']] as const
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function CourseWorkspace() {
  const { id = '' } = useParams(); const { courseMap } = useData(); const [sp, setSp] = useSearchParams(); const tab = sp.get('tab') ?? 'overview'
  const course = courseMap.get(id)
  if (!course) return <Empty title="Course not found" hint="It may have been deleted." action={<Link className="underline" to="/courses">Back to courses</Link>} />
  return (
    <>
      <PageHeader title={course.name} subtitle={<><Link to="/courses" className="underline">Courses</Link> · {[course.code, course.semester, course.instructor, course.room].filter(Boolean).join(' · ')}{course.archived && ' · archived'}</>} />
      <div role="tablist" aria-label="Course sections" className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setSp({ tab: k })} className={'-mb-px border-b-2 px-3 py-2 text-sm ' + (tab === k ? 'border-accent font-medium text-accent' : 'border-transparent text-soft hover:text-ink')}>{l}</button>)}
      </div>
      <div role="tabpanel">
        {tab === 'overview' && <Overview id={id} />}{tab === 'lectures' && <LectureHistory id={id} />}
        {tab === 'notes' && <NotesPanel courseId={id} />}{tab === 'homework' && <TasksPanel courseId={id} />}
        {tab === 'exams' && <ExamsPanel courseId={id} />}
        {tab === 'files' && <FilesPanel courseId={id} />}
        {tab === 'next' && <div className="space-y-4"><NextTaskCard courseId={id} /><Card title="Also open for this course"><OpenTasks id={id} skip={1} /></Card></div>}
      </div>
    </>
  )
}
function OpenTasks({ id, skip = 0, limit = 5 }: { id: string; skip?: number; limit?: number }) {
  const { data } = useData(); const today = todayKey()
  const list = sortTasks(data.tasks.filter((t) => t.courseId === id && t.status !== 'done')).sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today))).slice(skip, skip + limit)
  return list.length ? <ul className="space-y-1 text-sm">{list.map((t) => <li key={t.id}>{t.title}<span className="text-soft"> · {t.due ? `${isOverdue(t, today) ? 'overdue, ' : 'due '}${fmtDate(t.due)}` : 'no due date'}</span></li>)}</ul> : <p className="text-sm text-soft">Nothing else open.</p>
}

function Overview({ id }: { id: string }) {
  const { data, courseMap } = useData(); const course = courseMap.get(id)!; const today = todayKey()
  const [edit, setEdit] = useState(false); const [sched, setSched] = useState(false)
  const att = attendanceStats(data.events.filter((e) => e.courseId === id), data.lectures, today)
  const total = sumMinutes(dailyRows(data.sessions, { courseId: id })); const wk = weekRange(today); const thisWeek = sumMinutes(dailyRows(data.sessions, { courseId: id, ...wk }))
  const exams = data.exams.filter((e) => e.courseId === id && e.date && e.date >= today).sort((a, b) => a.date!.localeCompare(b.date!)); const exam = exams[0]
  const series = data.series.filter((s) => s.courseId === id)
  const rows = useMemo(() => cumulative(fillZero(dailyRows(data.sessions, { courseId: id }), undefined, today)), [data.sessions, id, today])
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Attendance" value={pct(att.rate)} sub={`${att.attended} attended · ${att.missed} missed · ${att.cancelled} cancelled`} />
        <Stat label="Independent study" value={fmtHours(total)} sub="Lecture time not included" />
        <Stat label="This week vs target" value={`${(thisWeek / 60).toFixed(1)} / ${course.targetHoursPerWeek} h`} />
        <Stat label="Next exam" value={exam ? `${countdown(exam, today)} d` : '—'} sub={exam ? `${exam.title}, ${fmtDate(exam.date)}` : 'No exam date entered'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Course information" action={<Button onClick={() => setEdit(true)}>Edit course</Button>}>
          {course.description && <p className="mb-2 text-sm">{course.description}</p>}
          {course.syllabus.length > 0 && <><h3 className="text-sm font-medium">Syllabus</h3><ul className="mb-2 list-disc pl-5 text-sm">{course.syllabus.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
          {course.notes && <p className="whitespace-pre-wrap text-sm text-soft">{course.notes}</p>}
          {!course.description && !course.syllabus.length && !course.notes && <p className="text-sm text-soft">Add a description, syllabus or notes with “Edit course”.</p>}
        </Card>
        <Card title="Lecture schedule" action={<Button onClick={() => setSched(true)}>Add schedule</Button>}>
          {series.length ? <ul className="text-sm">{series.map((s) => <li key={s.id}>{DAYS[s.weekday]} {s.start}–{s.end}{s.room && `, ${s.room}`} <span className="text-soft">({s.startDate} to {s.endDate})</span></li>)}</ul> : <p className="text-sm text-soft">No weekly schedule yet. Add one, or create single events in the timetable.</p>}
        </Card>
        <Card title="Upcoming assignments"><OpenTasks id={id} limit={5} /></Card>
        <NextTaskCard courseId={id} />
        {exam && <Card title={`Revision: ${exam.title}`}><p className="text-sm">{examProgress(exam).done} of {examProgress(exam).total} topics revised ({examProgress(exam).pct}%)</p></Card>}
        <Card title="Cumulative independent study (hours)" className="lg:col-span-2">
          {rows.length ? <Chart kind="line" label={`Cumulative study hours for ${course.name}`} data={hoursRows(rows)} series={[{ key: 'cumulative', name: 'Cumulative hours', color: course.color }]} /> : <p className="text-sm text-soft">Log a study session for this course to see its running total.</p>}
        </Card>
      </div>
      {edit && <CourseForm course={course} onClose={() => setEdit(false)} />}
      {sched && <EventForm defaults={{ courseId: id, room: course.room, instructor: course.instructor, title: course.name, date: today }} onClose={() => setSched(false)} />}
    </div>
  )
}
const badge: Record<Attendance, string> = { attended: 'text-ok', missed: 'text-danger', cancelled: 'text-soft', unrecorded: 'text-soft' }
function LectureHistory({ id }: { id: string }) {
  const { data } = useData(); const today = todayKey(); const [future, setFuture] = useState(false)
  const rec = new Map(data.lectures.map((l) => [l.eventId, l]))
  const list = data.events.filter((e) => e.courseId === id && (future || e.date <= today)).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div>
      <label className="mb-3 block text-sm"><input type="checkbox" checked={future} onChange={(e) => setFuture(e.target.checked)} /> Include upcoming lectures</label>
      {list.length === 0 ? <Empty title="No lectures yet" hint="Add a weekly schedule on the Overview tab, or create events in the timetable." /> : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">{list.map((e) => {
          const r = rec.get(e.id); const st = r?.attendance ?? 'unrecorded'; const study = data.sessions.filter((s) => s.lectureId === e.id).reduce((a, s) => a + s.minutes, 0)
          return (
            <li key={e.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3"><Link className="font-medium underline" to={`/lecture/${e.id}`}>{fmtDate(e.date)} · {e.start}–{e.end}</Link><span className={badge[st]}>{st === 'unrecorded' ? 'not recorded' : st}</span>{study > 0 && <span className="text-soft">{study} min linked study</span>}</div>
              {r?.topics && <div><span className="text-soft">Topics: </span>{r.topics}</div>}
              {r?.homework && <div><span className="text-soft">Homework: </span>{r.homework}</div>}
              {r?.notes && <div className="truncate text-soft">Notes: {r.notes}</div>}
            </li>)
        })}</ul>
      )}
    </div>
  )
}
