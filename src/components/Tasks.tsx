import { useMemo, useState } from 'react'
import { addDays, fmtDate, fmtShort, isValidKey, monthWeeks, parseKey, todayKey } from '../lib/dates'
import { isOverdue, matchesView, nextTask, sortTasks, type View } from '../lib/tasks'
import { cx, nowIso, splitTags, uid } from '../lib/util'
import { useData } from '../store'
import type { Priority, Task, TaskStatus } from '../types'
import { Button, Card, Confirm, CourseSelect, CourseTag, Empty, Field, Modal, inputCls } from './ui'

export function TaskForm({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const { data, put } = useData()
  const d = { ...defaults, ...task }
  const [f, setF] = useState({ title: d.title ?? '', description: d.description ?? '', courseId: d.courseId ?? '', lectureId: d.lectureId ?? '', assigned: d.assigned ?? todayKey(), due: d.due ?? '', priority: (d.priority ?? 'medium') as Priority, status: (d.status ?? 'todo') as TaskStatus, est: d.estMin?.toString() ?? '', actual: d.actualMin?.toString() ?? '', tags: (d.tags ?? []).join(', '), notes: d.notes ?? '', url: d.url ?? '' })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const lectures = data.events.filter((e) => e.courseId === f.courseId).sort((a, b) => b.date.localeCompare(a.date))
  async function save() {
    if (!f.title.trim()) return setErr('Enter a task title.')
    if (f.due && !isValidKey(f.due)) return setErr('Enter a valid due date.')
    const num = (s: string) => (s === '' ? undefined : Number(s))
    const est = num(f.est), actual = num(f.actual)
    if ([est, actual].some((n) => n !== undefined && (!Number.isFinite(n) || n < 0))) return setErr('Durations must be zero or more minutes.')
    const rec: Task = {
      id: task?.id ?? uid('task'), createdAt: task?.createdAt ?? nowIso(), examId: d.examId, title: f.title.trim(), description: f.description,
      courseId: f.courseId || undefined, lectureId: f.courseId && f.lectureId ? f.lectureId : undefined, assigned: f.assigned || undefined, due: f.due || undefined,
      priority: f.priority, status: f.status, estMin: est, actualMin: actual, tags: splitTags(f.tags), notes: f.notes, url: f.url.trim(),
      completedDate: f.status === 'done' ? task?.completedDate ?? todayKey() : undefined,
    }
    if (await put('tasks', rec)) onClose()
  }
  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><input className={inputCls} value={f.title} onChange={set('title')} autoFocus /></Field>
        <Field label="Course"><CourseSelect value={f.courseId} onChange={(v) => setF({ ...f, courseId: v, lectureId: '' })} includeAll="No course" /></Field>
        <Field label="Related lecture"><select className={inputCls} value={f.lectureId} onChange={set('lectureId')} disabled={!f.courseId}><option value="">None</option>{lectures.map((e) => <option key={e.id} value={e.id}>{fmtShort(e.date)} · {e.title}</option>)}</select></Field>
        <Field label="Assigned"><input type="date" className={inputCls} value={f.assigned} onChange={set('assigned')} /></Field>
        <Field label="Due date"><input type="date" className={inputCls} value={f.due} onChange={set('due')} /></Field>
        <Field label="Priority"><select className={inputCls} value={f.priority} onChange={set('priority')}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field>
        <Field label="Status"><select className={inputCls} value={f.status} onChange={set('status')}><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select></Field>
        <Field label="Estimated time (minutes)"><input type="number" min={0} className={inputCls} value={f.est} onChange={set('est')} /></Field>
        <Field label="Actual time spent (minutes)"><input type="number" min={0} className={inputCls} value={f.actual} onChange={set('actual')} /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea rows={2} className={inputCls} value={f.description} onChange={set('description')} /></Field>
        <Field label="Tags" hint="Comma separated."><input className={inputCls} value={f.tags} onChange={set('tags')} /></Field>
        <Field label="Link or local file reference" hint="A URL, or a file path such as ~/Documents/sheet-3.pdf."><input className={inputCls} value={f.url} onChange={set('url')} /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className={inputCls} value={f.notes} onChange={set('notes')} /></Field>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{task ? 'Save task' : 'Add task'}</Button></div>
    </Modal>
  )
}

const prioCls: Record<Priority, string> = { high: 'text-danger', medium: 'text-warn', low: 'text-soft' }
export function useTaskActions() {
  const { put } = useData()
  return {
    toggle: (t: Task) => put('tasks', t.status === 'done' ? { ...t, status: 'todo', completedDate: undefined } : { ...t, status: 'done', completedDate: todayKey() }),
    patch: (t: Task, p: Partial<Task>) => put('tasks', { ...t, ...p }),
  }
}
function TaskRow({ t, onEdit, onDelete, showCourse }: { t: Task; onEdit: () => void; onDelete: () => void; showCourse: boolean }) {
  const { courseMap } = useData(); const { toggle } = useTaskActions(); const today = todayKey(); const over = isOverdue(t, today)
  return (
    <li className="flex items-start gap-3 py-2.5">
      <input type="checkbox" className="mt-1.5 h-4 w-4" checked={t.status === 'done'} onChange={() => toggle(t)} aria-label={`${t.status === 'done' ? 'Reopen' : 'Mark complete'}: ${t.title}`} />
      <div className="min-w-0 flex-1">
        <div className={cx('font-medium', t.status === 'done' && 'text-soft line-through')}>{t.title}</div>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-soft">
          {showCourse && t.courseId && <CourseTag course={courseMap.get(t.courseId)} />}
          {t.due && <span className={cx(over && 'font-medium text-danger')}>{over ? 'Overdue · ' : 'Due '}{fmtDate(t.due)}</span>}
          <span className={prioCls[t.priority]}>{t.priority} priority</span>
          {t.status === 'doing' && <span>in progress</span>}
          {t.estMin != null && <span>est. {t.estMin} min</span>}{t.actualMin != null && <span>actual {t.actualMin} min</span>}
          {t.completedDate && <span>done {fmtDate(t.completedDate)}</span>}
          {t.tags.map((g) => <span key={g}>#{g}</span>)}
        </div>
      </div>
      <Button variant="ghost" onClick={onEdit} aria-label={`Edit ${t.title}`}>Edit</Button><Button variant="ghost" onClick={onDelete} aria-label={`Delete ${t.title}`}>Delete</Button>
    </li>
  )
}

const VIEWS: [View, string][] = [['all', 'All'], ['today', 'Today'], ['week', 'This week'], ['overdue', 'Overdue'], ['upcoming', 'Upcoming'], ['completed', 'Completed']]
export function TasksPanel({ courseId, defaults }: { courseId?: string; defaults?: Partial<Task> }) {
  const { data, del } = useData(); const today = todayKey()
  const [view, setView] = useState<View>('all'); const [prio, setPrio] = useState(''); const [course, setCourse] = useState(''); const [q, setQ] = useState('')
  const [mode, setMode] = useState<'list' | 'calendar'>('list'); const [month, setMonth] = useState(today)
  const [form, setForm] = useState<Task | 'new' | null>(null); const [deleting, setDeleting] = useState<Task | null>(null)
  const cid = courseId ?? course
  const tasks = useMemo(() => sortTasks(data.tasks.filter((t) => matchesView(t, view, today) && (!cid || t.courseId === cid) && (!prio || t.priority === prio) && `${t.title} ${t.description} ${t.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [data.tasks, view, cid, prio, q, today])
  const a = parseKey(month)
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Task view" className="flex flex-wrap gap-1">{VIEWS.map(([v, l]) => <Button key={v} variant={view === v ? 'primary' : 'default'} aria-pressed={view === v} onClick={() => setView(v)}>{l}</Button>)}</div>
        <Button className="ml-auto" variant="primary" onClick={() => setForm('new')}>New task</Button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input aria-label="Search tasks" placeholder="Search tasks…" className={inputCls + ' max-w-48'} value={q} onChange={(e) => setQ(e.target.value)} />
        {!courseId && <div className="w-52"><CourseSelect label="Filter by course" value={course} onChange={setCourse} includeAll="All courses" /></div>}
        <select aria-label="Filter by priority" className={inputCls + ' max-w-36'} value={prio} onChange={(e) => setPrio(e.target.value)}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <div className="ml-auto flex gap-1"><Button variant={mode === 'list' ? 'primary' : 'default'} onClick={() => setMode('list')}>List</Button><Button variant={mode === 'calendar' ? 'primary' : 'default'} onClick={() => setMode('calendar')}>Calendar</Button></div>
      </div>
      {mode === 'list' ? (
        tasks.length === 0 ? <Empty title="No tasks match" hint="Change the filters, or add a task." action={<Button onClick={() => setForm('new')}>New task</Button>} /> :
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface px-4">{tasks.map((t) => <TaskRow key={t.id} t={t} showCourse={!courseId} onEdit={() => setForm(t)} onDelete={() => setDeleting(t)} />)}</ul>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2"><Button onClick={() => setMonth(addDays(`${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-01`, -1))}>‹ Prev</Button><span className="font-display text-lg">{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(a)}</span><Button onClick={() => setMonth(addDays(`${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-28`, 5))}>Next ›</Button></div>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface"><div className="grid min-w-[640px] grid-cols-7 text-sm">
            {monthWeeks(a.getFullYear(), a.getMonth()).flat().map((d) => (
              <div key={d} className={cx('min-h-20 border-b border-l border-line p-1', parseKey(d).getMonth() !== a.getMonth() && 'opacity-50', d === today && 'bg-accent-soft')}>
                <div className="text-xs text-soft">{parseKey(d).getDate()}</div>
                {tasks.filter((t) => t.due === d).map((t) => <button key={t.id} onClick={() => setForm(t)} className={cx('mt-1 block w-full truncate rounded bg-surface2 px-1 text-left text-xs', t.status === 'done' && 'line-through opacity-60')}>{t.title}</button>)}
              </div>))}
          </div></div>
          <p className="mt-2 text-xs text-soft">Tasks without a due date are not shown on the calendar.</p>
        </div>
      )}
      {form && <TaskForm task={form === 'new' ? undefined : form} defaults={{ courseId, ...defaults }} onClose={() => setForm(null)} />}
      {deleting && <Confirm title="Delete this task?" confirmLabel="Delete task" onCancel={() => setDeleting(null)} onConfirm={async () => { if (await del('tasks', deleting.id)) setDeleting(null) }}>“{deleting.title}” will be permanently deleted.</Confirm>}
    </div>
  )
}

/** Suggests the next action. Completing it always needs an explicit click. */
export function NextTaskCard({ courseId }: { courseId?: string }) {
  const { data } = useData(); const { toggle, patch } = useTaskActions(); const today = todayKey()
  const [edit, setEdit] = useState<Task | null>(null); const [due, setDue] = useState('')
  const next = nextTask(data.tasks.filter((t) => !courseId || t.courseId === courseId), today)
  if (!next) return <Card title="Next task"><Empty title="Nothing to do right now" hint="Add a task or homework item and it will appear here." /></Card>
  const t = next.task
  return (
    <Card title="Next task" action={<span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{next.reason}</span>}>
      <div className="font-medium">{t.title}</div>
      <div className="text-sm text-soft">{t.due ? `Due ${fmtDate(t.due)}` : 'No due date'} · {t.priority} priority{t.estMin != null && ` · est. ${t.estMin} min`}</div>
      <p className="mt-1 text-xs text-soft">Suggested because: {next.reason.toLowerCase()}. Overdue tasks come first, then priority, then deadline.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Button variant="primary" onClick={() => toggle(t)}>Mark complete</Button>
        <Button onClick={() => setEdit(t)}>Edit</Button>
        <select aria-label="Change priority" className={inputCls + ' w-auto'} value={t.priority} onChange={(e) => patch(t, { priority: e.target.value as Priority })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <input aria-label="Reschedule to" type="date" className={inputCls + ' w-auto'} value={due || t.due || ''} onChange={(e) => setDue(e.target.value)} />
        <Button disabled={!due || due === t.due} onClick={async () => { await patch(t, { due }); setDue('') }}>Reschedule</Button>
      </div>
      {edit && <TaskForm task={edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}
