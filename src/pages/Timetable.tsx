import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EventForm from '../components/EventForm'
import { Button, CourseSelect, PageHeader } from '../components/ui'
import { addDays, fmtShort, monthWeeks, parseKey, timeToMin, todayKey, weekStart } from '../lib/dates'
import { findConflicts } from '../lib/recurrence'
import { cx } from '../lib/util'
import { useData } from '../store'
import type { Attendance, CalEvent } from '../types'

const HOUR = 52
const mark: Record<Attendance, string> = { attended: '✓ ', missed: '✗ ', cancelled: '', unrecorded: '' }

export default function Timetable() {
  const { data, put, courseMap, pref, setPref } = useData()
  const [view, setView] = useState<'week' | 'month'>('week'); const [anchor, setAnchor] = useState(todayKey()); const [courseId, setCourseId] = useState('')
  const [form, setForm] = useState<{ event?: CalEvent; defaults?: Partial<CalEvent> } | null>(null); const [notice, setNotice] = useState('')
  const weekends = pref('weekends', false); const today = todayKey()
  const att = useMemo(() => new Map(data.lectures.map((l) => [l.eventId, l.attendance])), [data.lectures])
  const events = useMemo(() => data.events.filter((e) => !courseId || e.courseId === courseId), [data.events, courseId])
  const ws = weekStart(anchor); const days = Array.from({ length: weekends ? 7 : 5 }, (_, i) => addDays(ws, i))
  const a = parseKey(anchor)
  const step = (n: number) => setAnchor(view === 'week' ? addDays(anchor, 7 * n) : (() => { const d = new Date(a.getFullYear(), a.getMonth() + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })())

  async function move(id: string, date: string) {
    const ev = data.events.find((e) => e.id === id); if (!ev || ev.date === date) return
    const moved: CalEvent = { ...ev, date, detached: ev.seriesId ? true : undefined }
    if (await put('events', moved)) {
      const c = findConflicts(data.events, moved)
      setNotice(`Moved “${ev.title}” to ${fmtShort(date)}.` + (c.length ? ` It now overlaps with ${c.map((x) => x.title).join(', ')}; nothing was changed automatically.` : ''))
    }
  }
  const eventLabel = (e: CalEvent) => `${mark[att.get(e.id) ?? 'unrecorded']}${e.title}`
  const Block = ({ e, style }: { e: CalEvent; style?: React.CSSProperties }) => {
    const c = courseMap.get(e.courseId); const st = att.get(e.id) ?? 'unrecorded'
    const clash = findConflicts(events, e).length > 0
    return (
      <div draggable onDragStart={(ev) => ev.dataTransfer.setData('text/plain', e.id)} style={{ ...style, borderLeftColor: c?.color }} className={cx('overflow-hidden rounded border border-line border-l-4 bg-surface2 px-1.5 py-0.5 text-xs', clash && 'ring-1 ring-warn')}>
        <Link to={`/lecture/${e.id}`} className={cx('block font-medium hover:underline', st === 'cancelled' && 'line-through opacity-60')} title={`${e.title} · ${e.start}–${e.end}${e.room ? ' · ' + e.room : ''}`}>{eventLabel(e)}</Link>
        <div className="truncate text-soft">{e.start}–{e.end}{e.room && ` · ${e.room}`}{clash && ' · ⚠ overlap'}</div>
      </div>
    )
  }
  const dropProps = (date: string) => ({ onDragOver: (e: React.DragEvent) => e.preventDefault(), onDrop: (e: React.DragEvent) => { e.preventDefault(); move(e.dataTransfer.getData('text/plain'), date) } })

  const weekEv = events.filter((e) => e.date >= ws && e.date <= addDays(ws, 6))
  const startH = Math.min(8, ...weekEv.map((e) => Math.floor(timeToMin(e.start) / 60))), endH = Math.max(18, ...weekEv.map((e) => Math.ceil(timeToMin(e.end) / 60)))
  const title = view === 'week' ? `${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))}, ${parseKey(ws).getFullYear()}` : new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(a)

  return (
    <>
      <PageHeader title="Timetable" subtitle="Click an event to open its lecture record. Drag an event to another day to move it." actions={<Button variant="primary" onClick={() => setForm({ defaults: { date: anchor } })}>New event</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => step(-1)} aria-label="Previous">‹ Prev</Button><Button onClick={() => setAnchor(today)}>Today</Button><Button onClick={() => step(1)} aria-label="Next">Next ›</Button>
        <span className="mx-2 font-display text-lg" aria-live="polite">{title}</span>
        <div role="group" aria-label="View" className="ml-auto flex gap-1">
          <Button variant={view === 'week' ? 'primary' : 'default'} aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</Button>
          <Button variant={view === 'month' ? 'primary' : 'default'} aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</Button>
        </div>
        <div className="w-56"><CourseSelect label="Filter by course" value={courseId} onChange={setCourseId} includeAll="All courses" /></div>
        <label className="text-sm"><input type="checkbox" checked={weekends} onChange={(e) => setPref('weekends', e.target.checked)} /> Weekends</label>
      </div>
      {notice && <div role="status" className="mb-3 flex justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm">{notice}<button className="text-soft" onClick={() => setNotice('')}>Dismiss</button></div>}

      {view === 'week' ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0,1fr))` }}>
            <div />
            {days.map((d) => (
              <div key={d} className={cx('border-l border-line px-2 py-2 text-sm', d === today && 'bg-accent-soft')}>
                <div className="font-medium">{new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(parseKey(d))} {fmtShort(d)}</div>
                <button className="text-xs text-soft hover:text-ink" onClick={() => setForm({ defaults: { date: d } })} aria-label={`Add event on ${d}`}>+ add</button>
              </div>
            ))}
            <div className="relative" style={{ height: (endH - startH) * HOUR }}>
              {Array.from({ length: endH - startH }, (_, i) => <div key={i} className="absolute left-0 right-1 text-right text-xs text-soft" style={{ top: i * HOUR }}>{String(startH + i).padStart(2, '0')}:00</div>)}
            </div>
            {days.map((d) => (
              <div key={d} {...dropProps(d)} className="relative border-l border-line" style={{ height: (endH - startH) * HOUR }} data-testid={`day-${d}`}>
                {Array.from({ length: endH - startH }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-line/60" style={{ top: i * HOUR }} />)}
                {events.filter((e) => e.date === d).map((e) => {
                  const top = ((timeToMin(e.start) - startH * 60) / 60) * HOUR, h = Math.max(24, ((timeToMin(e.end) - timeToMin(e.start)) / 60) * HOUR)
                  return <div key={e.id} className="absolute inset-x-0.5" style={{ top, height: h }}><Block e={e} style={{ height: '100%' }} /></div>
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <div className="grid min-w-[640px] grid-cols-7 text-sm">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="border-b border-line px-2 py-1 text-soft">{d}</div>)}
            {monthWeeks(a.getFullYear(), a.getMonth()).flat().map((d) => {
              const evs = events.filter((e) => e.date === d).sort((x, y) => x.start.localeCompare(y.start))
              return (
                <div key={d} {...dropProps(d)} className={cx('min-h-24 border-b border-l border-line p-1', parseKey(d).getMonth() !== a.getMonth() && 'opacity-50', d === today && 'bg-accent-soft')}>
                  <button className="text-xs text-soft hover:text-ink" onClick={() => { setAnchor(d); setView('week') }} aria-label={`Open week of ${d}`}>{parseKey(d).getDate()}</button>
                  <div className="mt-1 space-y-1">{evs.slice(0, 3).map((e) => <Block key={e.id} e={e} />)}{evs.length > 3 && <div className="text-xs text-soft">+{evs.length - 3} more</div>}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-soft">✓ attended · ✗ missed · struck-through = cancelled · ⚠ overlapping events (nothing is moved or deleted automatically).</p>
      {form && <EventForm event={form.event} defaults={form.defaults} onClose={() => setForm(null)} />}
    </>
  )
}
