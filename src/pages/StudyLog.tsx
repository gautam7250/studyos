import { useEffect, useMemo, useState } from 'react'
import SessionForm from '../components/SessionForm'
import { Button, Card, Confirm, CourseSelect, CourseTag, Empty, Field, PageHeader, Stat, inputCls } from '../components/ui'
import { fmtDate, fmtHours, localDateKey, localTime } from '../lib/dates'
import { dailyRows, lectureRows, sumMinutes } from '../lib/stats'
import { elapsedMs, fmtClock, msToMinutes, pauseTimer, resumeTimer, startTimer, type TimerState } from '../lib/timer'
import { uid } from '../lib/util'
import { useData } from '../store'
import { SESSION_TYPES, type Session, type SessionType } from '../types'

function TimerCard() {
  const { data, apply, pref, setPref } = useData()
  const timer = pref<TimerState | null>('timer', null)
  const [now, setNow] = useState(Date.now()); const [courseId, setCourseId] = useState(''); const [type, setType] = useState<SessionType>('independent'); const [topics, setTopics] = useState('')
  const [stopping, setStopping] = useState(false); const [discard, setDiscard] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { if (!timer || timer.resumedAt == null) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [timer])
  const clear = () => apply({ prefs: { del: ['timer'] } })
  const ms = timer ? elapsedMs(timer, now) : 0
  const course = timer && data.courses.find((c) => c.id === timer.courseId)
  return (
    <Card title="Study timer">
      {!timer ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Course"><CourseSelect value={courseId} onChange={setCourseId} /></Field>
          <Field label="Session type"><select className={inputCls} value={type} onChange={(e) => setType(e.target.value as SessionType)}>{SESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
          <Field label="Topic (optional)"><input className={inputCls} value={topics} onChange={(e) => setTopics(e.target.value)} /></Field>
          <div className="self-end"><Button variant="primary" onClick={() => { if (!courseId) return setErr('Choose a course to start the timer.'); setErr(''); setPref('timer', startTimer({ id: uid('session'), courseId, type, topics }, Date.now())) }}>Start timer</Button></div>
          {err && <p role="alert" className="text-sm text-danger sm:col-span-4">{err}</p>}
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <div role="timer" aria-live="off" className="font-display text-4xl tabular-nums">{fmtClock(ms)}</div>
            <div className="text-sm"><CourseTag course={course || undefined} /><div className="text-soft">{timer.resumedAt == null ? 'Paused' : 'Running'} · started {new Date(timer.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div></div>
            <div className="ml-auto flex gap-2">
              {timer.resumedAt == null ? <Button onClick={() => setPref('timer', resumeTimer(timer, Date.now()))}>Resume</Button> : <Button onClick={() => setPref('timer', pauseTimer(timer, Date.now()))}>Pause</Button>}
              <Button variant="primary" onClick={() => { setNow(Date.now()); setStopping(true) }}>Stop and save…</Button>
              <Button variant="ghost" onClick={() => setDiscard(true)}>Discard</Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-soft">The timer keeps counting if you close this tab. It only becomes study time when you stop it and confirm the minutes, so a forgotten timer never changes your totals.</p>
        </div>
      )}
      {stopping && timer && (
        <SessionForm title="Save timer as a study session" defaults={{ id: timer.id, courseId: timer.courseId, type: timer.type, topics: timer.topics, lectureId: timer.lectureId, taskId: timer.taskId, date: localDateKey(new Date(timer.startedAt)), startTime: localTime(new Date(timer.startedAt)), minutes: Math.max(1, msToMinutes(elapsedMs(timer, now))) }}
          onClose={() => setStopping(false)} onSaved={() => { clear() }} />
      )}
      {discard && <Confirm title="Discard this timer?" confirmLabel="Discard timer" onCancel={() => setDiscard(false)} onConfirm={async () => { await clear(); setDiscard(false) }}>The {fmtClock(ms)} recorded so far will not be saved as a study session.</Confirm>}
    </Card>
  )
}

export default function StudyLog() {
  const { data, del, courseMap } = useData()
  const [courseId, setCourseId] = useState(''); const [type, setType] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [q, setQ] = useState(''); const [withLectures, setWithLectures] = useState(false)
  const [form, setForm] = useState<Session | 'new' | null>(null); const [deleting, setDeleting] = useState<Session | null>(null)
  const list = useMemo(() => data.sessions.filter((s) => (!courseId || s.courseId === courseId) && (!type || s.type === type) && (!from || s.date >= from) && (!to || s.date <= to) && `${s.topics} ${s.notes}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date) || (b.startTime ?? '').localeCompare(a.startTime ?? '')), [data.sessions, courseId, type, from, to, q])
  const indep = sumMinutes(dailyRows(list)); const lect = sumMinutes(lectureRows(data.events, data.lectures, { from: from || undefined, to: to || undefined, courseId: courseId || undefined }))
  return (
    <>
      <PageHeader title="Study Log" subtitle="Independent study is tracked here. Lecture time comes from attendance on the timetable and is shown separately." actions={<Button variant="primary" onClick={() => setForm('new')}>Log session</Button>} />
      <TimerCard />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Independent study (filtered)" value={fmtHours(indep)} sub={`${list.length} sessions`} />
        <Stat label="Lecture time attended (same filter)" value={fmtHours(lect)} sub="From attended lectures" />
        <Stat label={withLectures ? 'Total including lectures' : 'Personal study total'} value={fmtHours(withLectures ? indep + lect : indep)} sub={withLectures ? 'Independent study + lecture time' : 'Lecture time excluded'} />
      </div>
      <div className="my-4 flex flex-wrap items-end gap-2">
        <div className="w-52"><CourseSelect label="Filter by course" value={courseId} onChange={setCourseId} includeAll="All courses" /></div>
        <select aria-label="Filter by type" className={inputCls + ' w-auto'} value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{SESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <input aria-label="From date" type="date" className={inputCls + ' w-auto'} value={from} onChange={(e) => setFrom(e.target.value)} /><input aria-label="To date" type="date" className={inputCls + ' w-auto'} value={to} onChange={(e) => setTo(e.target.value)} />
        <input aria-label="Search sessions" placeholder="Search topics and notes…" className={inputCls + ' max-w-48'} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="text-sm"><input type="checkbox" checked={withLectures} onChange={(e) => setWithLectures(e.target.checked)} /> Include lecture time in total</label>
      </div>
      {list.length === 0 ? <Empty title={data.sessions.length ? 'No sessions match these filters' : 'No study sessions yet'} hint="Start the timer above or log a session by hand." /> : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-soft"><tr><th className="p-2">Date</th><th>Course</th><th>Type</th><th>Time</th><th>Duration</th><th>Topics</th><th /></tr></thead>
            <tbody>{list.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="p-2">{fmtDate(s.date)}</td><td><CourseTag course={courseMap.get(s.courseId)} /></td><td>{SESSION_TYPES.find((t) => t.value === s.type)?.label}</td>
                <td>{s.startTime ? `${s.startTime}${s.endTime ? '–' + s.endTime : ''}` : '—'}</td><td>{s.minutes} min</td><td className="max-w-48 truncate">{s.topics}{!s.completed && ' (incomplete)'}</td>
                <td className="whitespace-nowrap text-right"><Button variant="ghost" onClick={() => setForm(s)} aria-label={`Edit session on ${s.date}`}>Edit</Button><Button variant="ghost" onClick={() => setDeleting(s)} aria-label={`Delete session on ${s.date}`}>Delete</Button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {form && <SessionForm session={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {deleting && <Confirm title="Delete this session?" confirmLabel="Delete session" onCancel={() => setDeleting(null)} onConfirm={async () => { if (await del('sessions', deleting.id)) setDeleting(null) }}>{deleting.minutes} minutes on {fmtDate(deleting.date)} will be removed and all totals recalculated.</Confirm>}
    </>
  )
}
