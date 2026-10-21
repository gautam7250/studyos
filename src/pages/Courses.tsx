import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CourseForm from '../components/CourseForm'
import { Button, Card, Confirm, Dot, Empty, PageHeader, inputCls } from '../components/ui'
import { planCourseDelete } from '../lib/cascade'
import { todayKey } from '../lib/dates'
import { attendanceStats, dailyRows, sumMinutes } from '../lib/stats'
import { pct } from '../lib/util'
import { useData } from '../store'
import type { Course } from '../types'

export default function Courses() {
  const { data, put, apply, files, removeFilesWhere } = useData()
  const [q, setQ] = useState(''); const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Course | 'new' | null>(null); const [deleting, setDeleting] = useState<Course | null>(null)
  const list = useMemo(() => data.courses.filter((c) => c.archived === showArchived && `${c.name} ${c.code} ${c.instructor}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [data.courses, q, showArchived])
  const plan = deleting ? planCourseDelete(data, deleting.id) : null
  return (
    <>
      <PageHeader title="Courses" subtitle="Open a course to see its lectures, notes, homework, exam preparation and statistics." actions={<Button variant="primary" onClick={() => setEditing('new')}>Add course</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input aria-label="Search courses" placeholder="Search courses…" className={inputCls + ' max-w-xs'} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="text-sm"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
      </div>
      {list.length === 0 ? <Empty title={showArchived ? 'No archived courses' : 'No courses found'} hint={showArchived ? 'Archived courses keep all their notes and history.' : 'Add a course, or clear the search.'} /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((c) => {
            const att = attendanceStats(data.events.filter((e) => e.courseId === c.id), data.lectures, todayKey())
            const hours = sumMinutes(dailyRows(data.sessions, { courseId: c.id })) / 60
            return (
              <Card key={c.id}>
                <div className="flex items-start gap-2"><span className="mt-1.5"><Dot color={c.color} /></span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/courses/${c.id}`} className="font-display text-lg hover:underline">{c.name}</Link>
                    <div className="text-xs text-soft">{[c.code, c.semester, c.instructor].filter(Boolean).join(' · ')}{c.example && ' · example course'}</div>
                  </div></div>
                <p className="mt-2 text-sm text-soft">Attendance {pct(att.rate)} · {hours.toFixed(1)} h independent study (target {c.targetHoursPerWeek} h/week)</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(c)}>Edit</Button>
                  <Button onClick={() => put('courses', { ...c, archived: !c.archived })}>{c.archived ? 'Restore' : 'Archive'}</Button>
                  <Button variant="danger" onClick={() => setDeleting(c)}>Delete…</Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {editing && <CourseForm course={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && plan && (
        <Confirm title={`Delete “${deleting.name}”?`} confirmLabel="Delete course and its data" onCancel={() => setDeleting(null)} onConfirm={async () => { if (await apply(plan.changes)) { await removeFilesWhere((f) => f.courseId === deleting.id); setDeleting(null) } }}>
          <p>This permanently deletes the course <strong>and everything attached to it</strong>:</p>
          <ul className="mt-2 list-disc pl-5">{Object.entries(plan.counts).map(([k, v]) => <li key={k}>{v} {k}</li>)}<li>{files.filter((f) => f.courseId === deleting.id).length} attached files</li></ul>
          <p className="mt-2">If you only want it out of the way, use <strong>Archive</strong> instead: all notes, sessions and reports are kept. Export a backup first if unsure.</p>
        </Confirm>
      )}
    </>
  )
}
