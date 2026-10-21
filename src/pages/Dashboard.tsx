import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Chart, { hoursRows } from '../components/Chart'
import { NextTaskCard, useTaskActions } from '../components/Tasks'
import { Button, Card, CourseTag, Empty, Progress, Stat, inputCls } from '../components/ui'
import { countdown } from '../lib/exams'
import { addDays, fmtDate, fmtHours, fmtShort, parseKey, todayKey } from '../lib/dates'
import { attendanceStats, cumulative, dailyRows, fillZero, studyStreak, sumMinutes, weekRange } from '../lib/stats'
import { isOpen, isOverdue, sortTasks } from '../lib/tasks'
import { cx, nowIso, pct } from '../lib/util'
import { useData } from '../store'
import type { Attendance, CalEvent } from '../types'

type Range = '7' | '30' | 'all'

function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 52, c = 2 * Math.PI * r, p = goal > 0 ? Math.min(1, value / goal) : 0
  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={goal > 0 ? `${fmtHours(value)} of ${fmtHours(goal)} weekly goal` : 'No weekly goal set'}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90"><circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface)" strokeWidth="12" /><circle cx="64" cy="64" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><div className="font-display text-2xl leading-none">{(value / 60).toFixed(1)} h</div><div className="mt-1 text-[11px] text-soft">{goal > 0 ? `of ${(goal / 60).toFixed(0)} h goal` : 'set targets in Courses'}</div></div>
    </div>
  )
}
const level = (m: number) => (m <= 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4)
const MIX = ['transparent', '25%', '45%', '70%', '100%']
function Heatmap({ rows, today, weeks = 15 }: { rows: { date: string; minutes: number }[]; today: string; weeks?: number }) {
  const m = new Map(rows.map((r) => [r.date, r.minutes])); const start = addDays(today, -((parseKey(today).getDay() + 6) % 7) - 7 * (weeks - 1))
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const total = cols.flat().reduce((a, d) => a + (d <= today ? m.get(d) ?? 0 : 0), 0), active = cols.flat().filter((d) => d <= today && (m.get(d) ?? 0) > 0).length
  return (
    <div>
      <div className="overflow-x-auto"><div role="img" aria-label={`Study activity, last ${weeks} weeks: ${active} active days, ${(total / 60).toFixed(1)} hours`} className="inline-flex gap-1">
        {cols.map((col, i) => <div key={i} className="flex flex-col gap-1">{col.map((d) => { const mins = m.get(d) ?? 0, fut = d > today
          return <div key={d} title={`${fmtShort(d)}: ${fut ? 'upcoming' : (mins / 60).toFixed(1) + ' h'}`} className={cx('h-3.5 w-3.5 rounded-[3px] border', fut ? 'border-transparent' : 'border-line', d === today && 'ring-1 ring-ink')} style={{ background: fut || !mins ? 'var(--surface2)' : `color-mix(in srgb, var(--accent) ${MIX[level(mins)]}, var(--surface2))`, opacity: fut ? 0.35 : 1 }} /> })}</div>)}
      </div></div>
      <div className="mt-2 flex items-center gap-1 text-xs text-soft">Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className="inline-block h-3 w-3 rounded-[3px] border border-line" style={{ background: l ? `color-mix(in srgb, var(--accent) ${MIX[l]}, var(--surface2))` : 'var(--surface2)' }} />)} More · {active} active days, {(total / 60).toFixed(1)} h in {weeks} weeks (independent study)</div>
    </div>
  )
}
export default function Dashboard() {
  const { data, put, courseMap } = useData(); const { toggle } = useTaskActions(); const today = todayKey(); const [range, setRange] = useState<Range>('30')
  const from = range === 'all' ? undefined : addDays(today, -(Number(range) - 1))
  const wk = weekRange(today)
  const att = attendanceStats(data.events, data.lectures, today, { from, to: today })
  const todays = data.events.filter((e) => e.date === today).sort((a, b) => a.start.localeCompare(b.start))
  const recMap = new Map(data.lectures.map((l) => [l.eventId, l]))
  const todayMin = sumMinutes(dailyRows(data.sessions, { from: today, to: today })), weekMin = sumMinutes(dailyRows(data.sessions, wk))
  const open = data.tasks.filter(isOpen); const overdue = open.filter((t) => isOverdue(t, today))
  const deadlines = sortTasks(open.filter((t) => t.due && t.due >= today && t.due <= addDays(today, 14))).slice(0, 6)
  const exams = data.exams.filter((e) => e.date && e.date >= today).sort((a, b) => a.date!.localeCompare(b.date!)).slice(0, 4)
  const notes = [...data.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const actions = [...overdue, ...open.filter((t) => t.due === today)].slice(0, 5)
  const trend = useMemo(() => { const f = from ?? data.sessions.map((s) => s.date).sort()[0]; return f ? cumulative(fillZero(dailyRows(data.sessions, { from: f, to: today }), f, today)) : [] }, [data.sessions, from, today])
  const byCourse = data.courses.filter((c) => !c.archived || data.sessions.some((s) => s.courseId === c.id)).map((c) => ({ label: c.code || c.name.slice(0, 10), hours: +(sumMinutes(dailyRows(data.sessions, { courseId: c.id, from, to: today })) / 60).toFixed(2) })).filter((r) => r.hours > 0)
  const empty = data.sessions.length === 0 && data.events.length === 0
  const allRows = useMemo(() => dailyRows(data.sessions), [data.sessions]); const streak = studyStreak(allRows, today)
  const goal = data.courses.filter((c) => !c.archived).reduce((a, c) => a + c.targetHoursPerWeek * 60, 0)
  const hr = new Date().getHours(); const greeting = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'
  const dueToday = open.filter((t) => t.due === today).length
  const summary = [`${todays.length} lecture${todays.length === 1 ? '' : 's'} today`, overdue.length ? `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}` : dueToday ? `${dueToday} due today` : 'nothing overdue', todayMin ? `${fmtHours(todayMin)} studied so far` : 'no study logged yet'].join(' · ')
  const week = Array.from({ length: 7 }, (_, i) => addDays(wk.from, i))

  async function mark(e: CalEvent, a: Attendance) {
    const r = recMap.get(e.id) ?? { id: e.id, eventId: e.id, courseId: e.courseId, attendance: 'unrecorded' as Attendance, topics: '', concepts: '', examples: '', notes: '', questions: '', homework: '', summary: '', followUps: '', updatedAt: '' }
    await put('lectures', { ...r, attendance: a, attendedDate: a === 'attended' ? today : undefined, updatedAt: nowIso() })
  }
  return (
    <>
      <h1 className="sr-only">Dashboard</h1>
      <section className="mb-6 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-line bg-accent-soft p-6 md:p-8">
        <div className="min-w-0 max-w-xl">
          <div className="text-xs font-medium uppercase tracking-widest text-soft">{fmtDate(today)}</div>
          <div className="mt-1 font-display text-4xl leading-tight tracking-tight md:text-5xl">{greeting}.</div>
          <p className="mt-2 text-sm text-soft">{summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link to="/study-log" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">Start studying</Link>
            <Link to="/tasks" className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm">Tasks</Link>
            <span className="rounded-full bg-surface px-3 py-1 text-xs" title="Consecutive days with independent study">{streak > 0 ? `${streak}-day study streak` : 'No streak yet'}</span>
          </div>
        </div>
        <Ring value={weekMin} goal={goal} />
      </section>
      <section aria-label="This week" className="mb-6">
        <h2 className="mb-2 font-display text-lg">This week</h2>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">{week.map((d) => {
          const evs = data.events.filter((e) => e.date === d); const due = open.filter((t) => t.due === d).length; const mins = sumMinutes(dailyRows(data.sessions, { from: d, to: d }))
          return (
            <Link key={d} to="/timetable" className={cx('rounded-lg border p-2 text-center hover:bg-surface2', d === today ? 'border-accent bg-surface ring-1 ring-accent' : 'border-line bg-surface')} aria-label={`${fmtShort(d)}: ${evs.length} lectures, ${due} deadlines, ${(mins / 60).toFixed(1)} hours studied`}>
              <div className="text-[11px] uppercase text-soft">{new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(parseKey(d))}</div>
              <div className="font-display text-xl">{parseKey(d).getDate()}</div>
              <div className="mt-1 flex min-h-3 flex-wrap justify-center gap-0.5">{evs.slice(0, 5).map((e) => <span key={e.id} className="h-2 w-2 rounded-full" style={{ background: courseMap.get(e.courseId)?.color ?? '#999' }} />)}</div>
              <div className="mt-1 text-[11px] text-soft">{due ? `${due} due` : ' '}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (mins / 120) * 100)}%` }} /></div>
            </Link>)
        })}</div>
        <p className="mt-1 text-xs text-soft">Dots = lectures (course colours) · bar = study time that day (full bar = 2 h)</p>
      </section>
      <div className="mb-4 flex items-center justify-end gap-2 text-sm"><label htmlFor="range" className="text-soft">Statistics range</label><select id="range" className={inputCls + ' w-auto'} value={range} onChange={(e) => setRange(e.target.value as Range)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></select></div>
      {empty && <div className="mb-6"><Empty title="Nothing recorded yet" hint="Everything below is calculated from your own records. Add a schedule in the timetable or log a study session. To see how it looks with sample data, load the clearly labelled demo data in Settings." action={<div className="flex justify-center gap-2"><Link className="rounded-md border border-line px-3 py-1.5 text-sm" to="/timetable">Open timetable</Link><Link className="rounded-md border border-line px-3 py-1.5 text-sm" to="/study-log">Log study</Link><Link className="rounded-md border border-line px-3 py-1.5 text-sm" to="/settings">Settings</Link></div>} /></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lectures today" value={todays.length} />
        <Stat label="Attendance rate" value={pct(att.rate)} sub={`${att.attended} attended · ${att.missed} missed (${range === 'all' ? 'all time' : `last ${range} days`})`} />
        <Stat label="Study today / this week" value={`${fmtHours(todayMin)} / ${fmtHours(weekMin)}`} sub="Independent study only" />
        <Stat label="Pending / overdue tasks" value={`${open.length} / ${overdue.length}`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Today’s lectures">
          {todays.length === 0 ? <p className="text-sm text-soft">No lectures scheduled today.</p> : <ul className="divide-y divide-line">{todays.map((e) => {
            const st = recMap.get(e.id)?.attendance ?? 'unrecorded'
            return <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><div className="min-w-0 flex-1"><Link className="font-medium underline" to={`/lecture/${e.id}`}>{e.start}–{e.end} {e.title}</Link><div><CourseTag course={courseMap.get(e.courseId)} /> <span className="text-soft">· {st}</span></div></div>
              <Button aria-pressed={st === 'attended'} onClick={() => mark(e, 'attended')}>Attended</Button><Button aria-pressed={st === 'missed'} onClick={() => mark(e, 'missed')}>Missed</Button></li>
          })}</ul>}
        </Card>
        <Card title="Today’s next actions">
          {actions.length ? <ul className="space-y-1.5 text-sm">{actions.map((t) => <li key={t.id} className="flex items-center gap-2"><input type="checkbox" checked={false} onChange={() => toggle(t)} aria-label={`Mark complete: ${t.title}`} /><span>{t.title}<span className="text-soft"> · {isOverdue(t, today) ? 'overdue' : 'due today'}</span></span></li>)}</ul> : <p className="text-sm text-soft">Nothing overdue or due today.</p>}
        </Card>
        <NextTaskCard />
        <Card title="Upcoming deadlines and exams">
          {deadlines.length + exams.length === 0 ? <p className="text-sm text-soft">No deadlines in the next 14 days and no exam dates entered.</p> : <ul className="space-y-1.5 text-sm">
            {exams.map((e) => <li key={e.id}><strong>{e.title}</strong> <span className="text-soft">· {fmtDate(e.date)} · {countdown(e, today)} days</span></li>)}
            {deadlines.map((t) => <li key={t.id}>{t.title} <span className="text-soft">· due {fmtShort(t.due!)}</span></li>)}</ul>}
        </Card>
        <Card title="Study activity" className="lg:col-span-2"><Heatmap rows={allRows} today={today} /></Card>
        <Card title="Study hours trend" className="lg:col-span-2">
          {trend.length ? <><Chart kind="bar" label="Daily independent study hours" data={hoursRows(trend)} series={[{ key: 'daily', name: 'Daily hours', color: 'var(--accent)' }]} height={200} />
            <p className="mt-1 text-xs text-soft">Hours of independent study per day, zero days included. Lecture attendance time is excluded. See Analytics for running totals.</p></> : <p className="text-sm text-soft">Log a study session to see your trend.</p>}
        </Card>
        <Card title="Study hours by course">{byCourse.length ? <Chart kind="bar" label="Independent study hours by course" data={byCourse} series={[{ key: 'hours', name: 'Hours', color: 'var(--accent)' }]} height={200} /> : <p className="text-sm text-soft">No study hours in this range.</p>}</Card>
        <Card title="Course progress this week">
          <ul className="space-y-2.5">{data.courses.filter((c) => !c.archived).map((c) => { const m = sumMinutes(dailyRows(data.sessions, { courseId: c.id, ...wk })), t = c.targetHoursPerWeek * 60
            return <li key={c.id} className="text-sm"><div className="flex justify-between"><CourseTag course={c} /><span className="text-soft">{(m / 60).toFixed(1)} / {c.targetHoursPerWeek} h</span></div><Progress value={t ? (m / t) * 100 : 0} label={`${c.name} weekly target`} /></li> })}</ul>
        </Card>
        <Card title="Recent notes" className="lg:col-span-2">
          {notes.length ? <ul className="space-y-1 text-sm">{notes.map((n) => <li key={n.id}><Link className="underline" to={`/courses/${n.courseId}?tab=notes`}>{n.title}</Link> <span className="text-soft">· {courseMap.get(n.courseId)?.name} · {fmtDate(n.updatedAt.slice(0, 10))}</span></li>)}</ul> : <p className="text-sm text-soft">No notes yet.</p>}
        </Card>
      </div>
    </>
  )
}
