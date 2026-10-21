import { Link, useSearchParams } from 'react-router-dom'
import { Card, Empty, PageHeader } from '../components/ui'
import { fmtDate } from '../lib/dates'
import { useData } from '../store'

export default function Search() {
  const [sp] = useSearchParams(); const q = (sp.get('q') ?? '').trim().toLowerCase(); const { data, courseMap } = useData()
  const has = (...f: (string | undefined)[]) => f.some((x) => x?.toLowerCase().includes(q))
  if (!q) return <><PageHeader title="Search" /><Empty title="Type something in the search box" hint="Searches courses, lecture records, notes, tasks and study sessions." /></>
  const courses = data.courses.filter((c) => has(c.name, c.code, c.description, c.instructor, c.notes, c.syllabus.join(' ')))
  const lectures = data.lectures.filter((l) => has(l.topics, l.concepts, l.examples, l.notes, l.questions, l.homework, l.summary, l.followUps))
  const notes = data.notes.filter((n) => has(n.title, n.body, n.tags.join(' ')))
  const tasks = data.tasks.filter((t) => has(t.title, t.description, t.notes, t.tags.join(' ')))
  const sessions = data.sessions.filter((s) => has(s.topics, s.notes))
  const total = courses.length + lectures.length + notes.length + tasks.length + sessions.length
  const cn = (id: string) => courseMap.get(id)?.name ?? 'Deleted course'
  return (
    <>
      <PageHeader title={`Search: “${sp.get('q')}”`} subtitle={`${total} result${total === 1 ? '' : 's'}`} />
      {total === 0 && <Empty title="Nothing found" hint="Try a different word. Search covers course info, lecture records, notes, tasks and session topics." />}
      <div className="space-y-4">
        {courses.length > 0 && <Card title="Courses"><ul className="text-sm">{courses.map((c) => <li key={c.id}><Link className="underline" to={`/courses/${c.id}`}>{c.name}</Link></li>)}</ul></Card>}
        {lectures.length > 0 && <Card title="Lecture records"><ul className="text-sm">{lectures.map((l) => <li key={l.id}><Link className="underline" to={`/lecture/${l.eventId}`}>{cn(l.courseId)} · {fmtDate(data.events.find((e) => e.id === l.eventId)?.date)}</Link><span className="text-soft"> {l.topics.slice(0, 80)}</span></li>)}</ul></Card>}
        {notes.length > 0 && <Card title="Notes"><ul className="text-sm">{notes.map((n) => <li key={n.id}><Link className="underline" to={`/courses/${n.courseId}?tab=notes`}>{n.title}</Link><span className="text-soft"> · {cn(n.courseId)}</span></li>)}</ul></Card>}
        {tasks.length > 0 && <Card title="Tasks"><ul className="text-sm">{tasks.map((t) => <li key={t.id}>{t.courseId ? <Link className="underline" to={`/courses/${t.courseId}?tab=homework`}>{t.title}</Link> : t.title}<span className="text-soft"> {t.status === 'done' ? '· done' : t.due ? `· due ${fmtDate(t.due)}` : ''}</span></li>)}</ul></Card>}
        {sessions.length > 0 && <Card title="Study sessions"><ul className="text-sm">{sessions.map((s) => <li key={s.id}>{fmtDate(s.date)} · {cn(s.courseId)} · {s.minutes} min <span className="text-soft">{s.topics}</span></li>)}</ul></Card>}
      </div>
    </>
  )
}
