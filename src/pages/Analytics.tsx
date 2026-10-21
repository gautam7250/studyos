import { useMemo, useState } from 'react'
import Chart from '../components/Chart'
import { Button, Card, CourseSelect, Empty, PageHeader, Stat, inputCls } from '../components/ui'
import { sessionsToCsv, toCsv } from '../lib/backup'
import { addDays, fmtHours, todayKey, weekStart } from '../lib/dates'
import { attendanceStats, courseTargetMinutes, cumulative, dailyRows, fillZero, lectureRows, mergeRows, sumMinutes, weeklyTotals } from '../lib/stats'
import { completionRate } from '../lib/tasks'
import { download, pct } from '../lib/util'
import { useData } from '../store'

type Range = '7' | '30' | '90' | 'all' | 'custom'
const h = (m: number) => +(m / 60).toFixed(2)
export default function Analytics() {
  const { data } = useData(); const today = todayKey()
  const [range, setRange] = useState<Range>('30'); const [cFrom, setCFrom] = useState(addDays(today, -29)); const [cTo, setCTo] = useState(today); const [courseId, setCourseId] = useState(''); const [withLectures, setWithLectures] = useState(false)
  const firstDate = [...data.sessions.map((s) => s.date), ...lectureRows(data.events, data.lectures).map((r) => r.date)].sort()[0]
  const to = range === 'custom' ? cTo : today
  const from = range === 'custom' ? cFrom : range === 'all' ? firstDate : addDays(today, -(Number(range) - 1))
  const invalid = !!from && from > to
  const o = { from, to, courseId: courseId || undefined }

  const v = useMemo(() => {
    if (!from || invalid) return null
    const indep = dailyRows(data.sessions, o), lect = lectureRows(data.events, data.lectures, o)
    const daily = fillZero(withLectures ? mergeRows(indep, lect) : indep, from, to); const cum = cumulative(daily)
    const dayTable = cum.map((r) => ({ label: r.date.slice(5), date: r.date, daily: h(r.minutes), cumulative: h(r.cumulative) }))
    const wk = (rows: typeof indep) => new Map(weeklyTotals(fillZero(rows, from, to)).map((r) => [r.date, r.minutes]))
    const wi = wk(indep), wl = wk(lect); const weeks = [...new Set([...wi.keys(), ...wl.keys()])].sort()
    const weekly = weeks.map((w) => ({ label: w.slice(5), independent: h(wi.get(w) ?? 0), lecture: h(wl.get(w) ?? 0) }))
    const courses = data.courses.filter((c) => (!courseId || c.id === courseId) && (!c.archived || data.sessions.some((s) => s.courseId === c.id)))
    const per = courses.map((c) => ({ c, rows: fillZero(dailyRows(data.sessions, { from, to, courseId: c.id }), from, to) })).filter((x) => sumMinutes(x.rows) > 0)
    const byCourseCum = dayTable.map((r, i) => ({ label: r.label, ...Object.fromEntries(per.map((x) => [x.c.id, h(cumulative(x.rows)[i].cumulative)])) }))
    const wkAll = [...new Set(per.flatMap((x) => weeklyTotals(x.rows).map((r) => r.date)))].sort()
    const byCourseWeek = wkAll.map((w) => ({ label: w.slice(5), ...Object.fromEntries(per.map((x) => [x.c.id, h(weeklyTotals(x.rows).find((r) => r.date === w)?.minutes ?? 0)])) }))
    const targets = courses.map((c) => ({ label: c.code || c.name.slice(0, 10), actual: h(sumMinutes(dailyRows(data.sessions, { from, to, courseId: c.id }))), target: h(courseTargetMinutes(c, from, to)) }))
    const rates = courses.map((c) => ({ c, att: attendanceStats(data.events.filter((e) => e.courseId === c.id), data.lectures, today, { from, to }), done: completionRate(data.tasks.filter((t) => t.courseId === c.id && (!t.due || (t.due >= from && t.due <= to) || t.status === 'done'))) }))
    const monthly = new Map<string, number>(); for (const r of daily) monthly.set(r.date.slice(0, 7), (monthly.get(r.date.slice(0, 7)) ?? 0) + r.minutes)
    return { dayTable, weekly, per, byCourseCum, byCourseWeek, targets, rates, monthly: [...monthly], total: sumMinutes(daily), lectTotal: sumMinutes(lect), indepTotal: sumMinutes(indep), thisWeek: sumMinutes(dailyRows(data.sessions, { courseId: o.courseId, from: weekStart(today), to: addDays(weekStart(today), 6) })) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, from, to, courseId, withLectures, invalid])

  function exportReport() {
    if (!v) return
    download(`studyos-daily-hours-${from}-to-${to}.csv`, toCsv(['date', withLectures ? 'daily_hours_incl_lectures' : 'daily_independent_hours', 'cumulative_hours'], v.dayTable.map((r) => [r.date, r.daily, r.cumulative])), 'text/csv')
  }
  return (
    <>
      <PageHeader title="Analytics" subtitle="Everything is calculated from your sessions and attendance records. Running totals are derived, never stored." actions={<><Button onClick={exportReport} disabled={!v}>Export report (CSV)</Button><Button onClick={() => download('studyos-sessions.csv', sessionsToCsv(data.sessions.filter((s) => (!courseId || s.courseId === courseId) && (!from || s.date >= from) && s.date <= to), data.courses), 'text/csv')}>Export sessions (CSV)</Button></>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <select aria-label="Date range" className={inputCls + ' w-auto'} value={range} onChange={(e) => setRange(e.target.value as Range)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option><option value="custom">Custom range</option></select>
        {range === 'custom' && <><input aria-label="From" type="date" className={inputCls + ' w-auto'} value={cFrom} onChange={(e) => setCFrom(e.target.value)} /><input aria-label="To" type="date" className={inputCls + ' w-auto'} value={cTo} onChange={(e) => setCTo(e.target.value)} /></>}
        <div className="w-52"><CourseSelect label="Course" value={courseId} onChange={setCourseId} includeAll="All courses" /></div>
        <label className="text-sm"><input type="checkbox" checked={withLectures} onChange={(e) => setWithLectures(e.target.checked)} /> Include lecture time</label>
      </div>
      <p className="mb-4 text-sm text-soft">Units: hours (h), local calendar dates. Lecture time is <strong>{withLectures ? 'included' : 'excluded'}</strong> in the daily and cumulative charts; it is the duration of lectures marked attended. Running totals start at 0 on the first day of the selected range.</p>
      {invalid ? <Empty title="The start date is after the end date" hint="Fix the custom range to see charts." /> : !v || (v.total === 0 && v.lectTotal === 0 && v.indepTotal === 0) ? <Empty title="No study data in this range" hint="Log study sessions or mark lectures as attended, or widen the date range." /> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Independent study" value={fmtHours(v.indepTotal)} sub="In range" /><Stat label="Lecture time attended" value={fmtHours(v.lectTotal)} sub="In range" />
            <Stat label="This calendar week" value={fmtHours(v.thisWeek)} sub="Independent study" /><Stat label="Total shown in charts" value={fmtHours(v.total)} sub={withLectures ? 'Including lectures' : 'Independent only'} />
          </div>
          <Card title="Daily hours"><Chart kind="bar" label="Daily study hours" data={v.dayTable} series={[{ key: 'daily', name: 'Hours per day', color: 'var(--accent)' }]} /></Card>
          <Card title="Cumulative hours over time"><Chart kind="line" label="Cumulative study hours" data={v.dayTable} series={[{ key: 'cumulative', name: 'Cumulative hours', color: 'var(--accent)' }]} />
            <details className="mt-2 text-sm"><summary className="cursor-pointer">Show the numbers</summary><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left"><thead className="text-soft"><tr><th>Date</th><th>Hours that day</th><th>Cumulative hours</th></tr></thead><tbody>{v.dayTable.map((r) => <tr key={r.date}><td>{r.date}</td><td>{r.daily}</td><td>{r.cumulative}</td></tr>)}</tbody></table></div></details></Card>
          <Card title="Cumulative hours by course">{v.per.length ? <Chart kind="line" label="Cumulative study hours by course" data={v.byCourseCum} series={v.per.map((x) => ({ key: x.c.id, name: x.c.name, color: x.c.color }))} /> : <p className="text-sm text-soft">No course sessions in range.</p>}</Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Independent study vs lecture time (weekly)"><Chart kind="bar" stacked label="Weekly independent study versus lecture hours" data={v.weekly} series={[{ key: 'independent', name: 'Independent study', color: 'var(--accent)' }, { key: 'lecture', name: 'Lecture attendance', color: '#b5892a' }]} /></Card>
            <Card title="Weekly hours by course (activity trend)">{v.per.length ? <Chart kind="bar" stacked label="Weekly study hours by course" data={v.byCourseWeek} series={v.per.map((x) => ({ key: x.c.id, name: x.c.name, color: x.c.color }))} /> : <p className="text-sm text-soft">No data.</p>}</Card>
          </div>
          <Card title="Actual hours vs study targets"><Chart kind="bar" label="Actual study hours versus targets" data={v.targets} series={[{ key: 'actual', name: 'Actual', color: 'var(--accent)' }, { key: 'target', name: 'Target', color: '#9aa6b2' }]} /><p className="mt-1 text-xs text-soft">Target = weekly target × days in range ÷ 7.</p></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Monthly totals"><table className="w-full text-left text-sm"><thead className="text-soft"><tr><th>Month</th><th>Hours</th></tr></thead><tbody>{v.monthly.map(([m, mins]) => <tr key={m}><td>{m}</td><td>{h(mins)}</td></tr>)}</tbody></table></Card>
            <Card title="Attendance and assignment completion"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-soft"><tr><th>Course</th><th>Attendance</th><th>Tasks done</th></tr></thead><tbody>{v.rates.map((r) => <tr key={r.c.id}><td>{r.c.name}</td><td>{pct(r.att.rate)}</td><td>{pct(r.done)}</td></tr>)}</tbody></table></div><p className="mt-1 text-xs text-soft">Attendance = attended ÷ (attended + missed). Tasks done = completed ÷ all tasks due in range (plus completed ones).</p></Card>
          </div>
        </div>
      )}
    </>
  )
}
