import { useState } from 'react'
import { fmtDate, isValidKey, todayKey } from '../lib/dates'
import { countdown, examProgress, mockAverage, nextRevision, weakTopics } from '../lib/exams'
import { pct, uid } from '../lib/util'
import { useData } from '../store'
import type { Exam } from '../types'
import { TaskForm } from './Tasks'
import { Button, Card, Confirm, CourseSelect, CourseTag, Empty, Field, Modal, Progress, inputCls } from './ui'

function ExamForm({ exam, courseId, onClose }: { exam?: Exam; courseId?: string; onClose: () => void }) {
  const { put } = useData()
  const [f, setF] = useState({ courseId: exam?.courseId ?? courseId ?? '', title: exam?.title ?? '', date: exam?.date ?? '', time: exam?.time ?? '', format: exam?.format ?? '' }); const [err, setErr] = useState('')
  async function save() {
    if (!f.courseId) return setErr('Choose a course.'); if (!f.title.trim()) return setErr('Enter an exam title.'); if (f.date && !isValidKey(f.date)) return setErr('Enter a valid date, or leave it empty if it is not known yet.')
    const rec: Exam = { id: exam?.id ?? uid('exam'), topics: [], questions: [], mocks: [], revisions: [], nextAction: '', ...exam, courseId: f.courseId, title: f.title.trim(), date: f.date || undefined, time: f.time || undefined, format: f.format }
    if (await put('exams', rec)) onClose()
  }
  return (
    <Modal title={exam ? 'Edit exam' : 'New exam'} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Course"><CourseSelect value={f.courseId} onChange={(v) => setF({ ...f, courseId: v })} /></Field>
        <Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label="Exam date" hint="Leave empty until the date is announced."><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Time (optional)"><input type="time" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Format" className="sm:col-span-2" hint="For example written, oral, open-book, project."><input className={inputCls} value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })} /></Field>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{exam ? 'Save exam' : 'Create exam'}</Button></div>
    </Modal>
  )
}

function ExamCard({ exam, showCourse }: { exam: Exam; showCourse: boolean }) {
  const { put, del, courseMap } = useData(); const today = todayKey()
  const [edit, setEdit] = useState(false); const [deleting, setDeleting] = useState(false); const [taskFor, setTaskFor] = useState(false)
  const [topic, setTopic] = useState(''); const [q, setQ] = useState(''); const [a, setA] = useState(''); const [mock, setMock] = useState({ date: today, score: '', max: '100', notes: '' }); const [rev, setRev] = useState({ date: today, minutes: '60', note: '' }); const [err, setErr] = useState('')
  const course = courseMap.get(exam.courseId); const prog = examProgress(exam); const days = countdown(exam, today); const weak = weakTopics(exam); const nextRev = nextRevision(exam, today); const avg = mockAverage(exam)
  const save = (p: Partial<Exam>) => put('exams', { ...exam, ...p })
  const topicName = (id?: string) => exam.topics.find((t) => t.id === id)?.title
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-display text-xl">{exam.title}</h3>{showCourse && <CourseTag course={course} />}
          <p className="text-sm text-soft">{exam.format || 'Format not set'} · {exam.date ? `${fmtDate(exam.date)}${exam.time ? ' ' + exam.time : ''}` : 'Date not announced yet'}</p></div>
        <div className="text-right">
          {days != null && <div className="font-display text-2xl" aria-label="Countdown">{days > 0 ? `${days} day${days === 1 ? '' : 's'} left` : days === 0 ? 'Today' : `${-days} day${days === -1 ? '' : 's'} ago`}</div>}
          <div className="mt-1 flex justify-end gap-1"><Button variant="ghost" onClick={() => setEdit(true)}>Edit exam</Button><Button variant="ghost" onClick={() => setDeleting(true)}>Delete</Button></div>
        </div>
      </div>

      <div className="mt-3"><Progress value={prog.pct} label="Revision progress" />
        <p className="mt-1 text-sm">{prog.done} of {prog.total} topics revised ({prog.pct}%){prog.avgConfidence != null && ` · average confidence ${prog.avgConfidence.toFixed(1)} / 5`}</p>
        <p className="text-xs text-soft">Progress = topics ticked as revised ÷ all topics. Confidence ratings do not change progress.</p></div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section aria-label="Topics"><h4 className="font-medium">Syllabus topics</h4>
          {exam.topics.length === 0 && <p className="text-sm text-soft">No topics yet.{course && course.syllabus.length > 0 && <> <button className="underline" onClick={() => save({ topics: course.syllabus.map((t) => ({ id: uid('topic'), title: t, done: false, confidence: 0 })) })}>Import {course.syllabus.length} topics from the course syllabus</button></>}</p>}
          <ul className="divide-y divide-line">{exam.topics.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
              <input type="checkbox" checked={t.done} onChange={() => save({ topics: exam.topics.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })} aria-label={`Revised: ${t.title}`} />
              <span className={t.done ? 'flex-1 text-soft line-through' : 'flex-1'}>{t.title}</span>
              <select aria-label={`Confidence for ${t.title}`} className={inputCls + ' w-auto py-1'} value={t.confidence} onChange={(e) => save({ topics: exam.topics.map((x) => (x.id === t.id ? { ...x, confidence: Number(e.target.value) } : x)) })}><option value={0}>Unrated</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select>
              <Button variant="ghost" onClick={() => save({ topics: exam.topics.filter((x) => x.id !== t.id) })} aria-label={`Remove topic ${t.title}`}>Remove</Button>
            </li>))}</ul>
          <div className="mt-2 flex gap-2"><input aria-label="New topic" placeholder="Add a topic…" className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && topic.trim() && (save({ topics: [...exam.topics, { id: uid('topic'), title: topic.trim(), done: false, confidence: 0 }] }), setTopic(''))} />
            <Button onClick={() => { if (topic.trim()) { save({ topics: [...exam.topics, { id: uid('topic'), title: topic.trim(), done: false, confidence: 0 }] }); setTopic('') } }}>Add topic</Button></div>
          <div className="mt-3"><h4 className="font-medium">Weak topics</h4>{weak.length ? <ul className="list-disc pl-5 text-sm">{weak.map((t) => <li key={t.id}>{t.title} (confidence {t.confidence}/5)</li>)}</ul> : <p className="text-sm text-soft">None. Topics rated 1 or 2 out of 5 appear here.</p>}</div>
        </section>

        <section aria-label="Revision plan"><h4 className="font-medium">Revision sessions</h4>
          <ul className="divide-y divide-line">{[...exam.revisions].sort((x, y) => x.date.localeCompare(y.date)).map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm"><input type="checkbox" checked={r.done} onChange={() => save({ revisions: exam.revisions.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)) })} aria-label={`Revision on ${r.date} done`} />
              <span className="flex-1">{fmtDate(r.date)}{r.minutes ? ` · ${r.minutes} min` : ''}{r.note && ` · ${r.note}`}</span><Button variant="ghost" onClick={() => save({ revisions: exam.revisions.filter((x) => x.id !== r.id) })} aria-label={`Remove revision on ${r.date}`}>Remove</Button></li>))}</ul>
          <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Revision date" type="date" className={inputCls + ' w-auto'} value={rev.date} onChange={(e) => setRev({ ...rev, date: e.target.value })} /><input aria-label="Revision minutes" type="number" min={1} className={inputCls + ' w-24'} value={rev.minutes} onChange={(e) => setRev({ ...rev, minutes: e.target.value })} /><input aria-label="Revision note" placeholder="Focus…" className={inputCls + ' flex-1'} value={rev.note} onChange={(e) => setRev({ ...rev, note: e.target.value })} />
            <Button onClick={() => { if (!isValidKey(rev.date)) return setErr('Enter a valid revision date.'); setErr(''); save({ revisions: [...exam.revisions, { id: uid('rev'), date: rev.date, minutes: Number(rev.minutes) || undefined, topicIds: [], note: rev.note, done: false }] }); setRev({ ...rev, note: '' }) }}>Schedule</Button></div>
          <div className="mt-3"><Field label="Next revision action"><input className={inputCls} value={exam.nextAction} onChange={(e) => save({ nextAction: e.target.value })} placeholder="What will you do next?" /></Field>
            {nextRev && <p className="mt-1 text-xs text-soft">Next scheduled session: {fmtDate(nextRev.date)}</p>}
            <Button className="mt-2" onClick={() => setTaskFor(true)}>Create task from this</Button></div>
        </section>

        <section aria-label="Practice questions"><h4 className="font-medium">Practice questions</h4>
          <ul className="divide-y divide-line">{exam.questions.map((x) => (
            <li key={x.id} className="py-1.5 text-sm"><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={x.done} onChange={() => save({ questions: exam.questions.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)) })} /><span className={x.done ? 'text-soft line-through' : ''}>{x.question}{x.topicId && topicName(x.topicId) && <em className="text-soft"> ({topicName(x.topicId)})</em>}</span></label>
              {x.answer && <p className="ml-6 whitespace-pre-wrap text-xs text-soft">Answer notes: {x.answer}</p>}<Button variant="ghost" onClick={() => save({ questions: exam.questions.filter((y) => y.id !== x.id) })} aria-label={`Remove question ${x.question}`}>Remove</Button></li>))}</ul>
          <div className="mt-2 space-y-2"><input aria-label="Practice question" placeholder="Question…" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} /><input aria-label="Answer notes" placeholder="Answer notes (optional)…" className={inputCls} value={a} onChange={(e) => setA(e.target.value)} />
            <Button onClick={() => { if (q.trim()) { save({ questions: [...exam.questions, { id: uid('q'), question: q.trim(), answer: a, done: false }] }); setQ(''); setA('') } }}>Add question</Button></div>
        </section>

        <section aria-label="Mock exams"><h4 className="font-medium">Mock exam scores</h4>
          <ul className="divide-y divide-line">{exam.mocks.map((m) => <li key={m.id} className="flex items-center gap-2 py-1.5 text-sm"><span className="flex-1">{fmtDate(m.date)}: {m.score} / {m.max} ({Math.round((m.score / m.max) * 100)}%){m.notes && ` · ${m.notes}`}</span><Button variant="ghost" onClick={() => save({ mocks: exam.mocks.filter((x) => x.id !== m.id) })} aria-label={`Remove mock on ${m.date}`}>Remove</Button></li>)}</ul>
          {avg != null && <p className="mt-1 text-sm">Average: {pct(avg)}</p>}
          <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Mock date" type="date" className={inputCls + ' w-auto'} value={mock.date} onChange={(e) => setMock({ ...mock, date: e.target.value })} /><input aria-label="Mock score" type="number" min={0} placeholder="Score" className={inputCls + ' w-24'} value={mock.score} onChange={(e) => setMock({ ...mock, score: e.target.value })} /><input aria-label="Mock maximum" type="number" min={1} className={inputCls + ' w-24'} value={mock.max} onChange={(e) => setMock({ ...mock, max: e.target.value })} />
            <Button onClick={() => { const s = Number(mock.score), m = Number(mock.max); if (mock.score === '' || !(m > 0) || s < 0 || s > m || !isValidKey(mock.date)) return setErr('Enter a score between 0 and the maximum, and a valid date.'); setErr(''); save({ mocks: [...exam.mocks, { id: uid('mock'), date: mock.date, score: s, max: m, notes: mock.notes }] }); setMock({ ...mock, score: '' }) }}>Record score</Button></div>
        </section>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      {edit && <ExamForm exam={exam} onClose={() => setEdit(false)} />}
      {taskFor && <TaskForm defaults={{ courseId: exam.courseId, examId: exam.id, title: exam.nextAction || `Revise for ${exam.title}`, due: nextRev?.date, tags: ['revision'] }} onClose={() => setTaskFor(false)} />}
      {deleting && <Confirm title={`Delete “${exam.title}”?`} confirmLabel="Delete exam" onCancel={() => setDeleting(false)} onConfirm={async () => { if (await del('exams', exam.id)) setDeleting(false) }}>This removes its {exam.topics.length} topics, {exam.questions.length} practice questions, {exam.mocks.length} mock scores and {exam.revisions.length} revision sessions. Study sessions and notes are kept.</Confirm>}
    </Card>
  )
}

export function ExamsPanel({ courseId }: { courseId?: string }) {
  const { data } = useData(); const [form, setForm] = useState(false)
  const list = data.exams.filter((e) => !courseId || e.courseId === courseId).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  return (
    <div>
      <div className="mb-3 flex justify-end"><Button variant="primary" onClick={() => setForm(true)}>New exam</Button></div>
      {list.length === 0 ? <Empty title="No exams yet" hint="Create an exam, add syllabus topics and track your revision. A date is optional until it is announced." /> : <div className="space-y-4">{list.map((e) => <ExamCard key={e.id} exam={e} showCourse={!courseId} />)}</div>}
      {form && <ExamForm courseId={courseId} onClose={() => setForm(false)} />}
    </div>
  )
}
