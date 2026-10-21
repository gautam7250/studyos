import { useMemo, useState } from 'react'
import { fmtStamp, fmtShort } from '../lib/dates'
import { cx, nowIso, splitTags, uid } from '../lib/util'
import { useData } from '../store'
import type { Note } from '../types'
import { Button, Confirm, Empty, Field, Modal, inputCls } from './ui'

export function NoteForm({ note, defaults, onClose }: { note?: Note; defaults?: Partial<Note> & { courseId: string }; onClose: () => void }) {
  const { data, put } = useData(); const d = { ...defaults, ...note } as Partial<Note> & { courseId: string }
  const [f, setF] = useState({ title: d.title ?? '', body: d.body ?? '', tags: (d.tags ?? []).join(', '), pinned: d.pinned ?? false, lectureId: d.lectureId ?? '', examTopicId: d.examTopicId ?? '' })
  const [err, setErr] = useState('')
  const lectures = data.events.filter((e) => e.courseId === d.courseId).sort((a, b) => b.date.localeCompare(a.date))
  const topics = data.exams.filter((e) => e.courseId === d.courseId).flatMap((e) => e.topics.map((t) => ({ id: t.id, label: `${e.title}: ${t.title}` })))
  async function save() {
    if (!f.title.trim()) return setErr('Give the note a title.')
    const t = nowIso()
    const rec: Note = { id: note?.id ?? uid('note'), courseId: d.courseId, title: f.title.trim(), body: f.body, tags: splitTags(f.tags), pinned: f.pinned, lectureId: f.lectureId || undefined, examTopicId: f.examTopicId || undefined, createdAt: note?.createdAt ?? t, updatedAt: t }
    if (await put('notes', rec)) onClose()
  }
  return (
    <Modal title={note ? 'Edit note' : 'New note'} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label="Note (Markdown or plain text)" className="sm:col-span-2"><textarea rows={10} className={inputCls + ' font-mono'} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="Tags" hint="Comma separated."><input className={inputCls} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
        <Field label="Linked lecture"><select className={inputCls} value={f.lectureId} onChange={(e) => setF({ ...f, lectureId: e.target.value })}><option value="">None</option>{lectures.map((e) => <option key={e.id} value={e.id}>{fmtShort(e.date)} · {e.title}</option>)}</select></Field>
        <Field label="Linked exam topic"><select className={inputCls} value={f.examTopicId} onChange={(e) => setF({ ...f, examTopicId: e.target.value })}><option value="">None</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Pin as important</label>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save note</Button></div>
    </Modal>
  )
}

export function NotesPanel({ courseId, lectureId }: { courseId: string; lectureId?: string }) {
  const { data, del, put } = useData()
  const [q, setQ] = useState(''); const [tag, setTag] = useState(''); const [form, setForm] = useState<Note | 'new' | null>(null); const [deleting, setDeleting] = useState<Note | null>(null)
  const mine = useMemo(() => data.notes.filter((n) => n.courseId === courseId && (!lectureId || n.lectureId === lectureId)), [data.notes, courseId, lectureId])
  const tags = [...new Set(mine.flatMap((n) => n.tags))].sort()
  const list = mine.filter((n) => (!tag || n.tags.includes(tag)) && `${n.title} ${n.body} ${n.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input aria-label="Search notes" placeholder="Search notes…" className={inputCls + ' max-w-xs'} value={q} onChange={(e) => setQ(e.target.value)} />
        {tags.length > 0 && <select aria-label="Filter by tag" className={inputCls + ' w-auto'} value={tag} onChange={(e) => setTag(e.target.value)}><option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}</select>}
        <Button className="ml-auto" variant="primary" onClick={() => setForm('new')}>New note</Button>
      </div>
      {list.length === 0 ? <Empty title={mine.length ? 'No notes match' : 'No notes yet'} hint="Notes are saved on this device and can be linked to a lecture or an exam topic." /> : (
        <ul className="space-y-3">{list.map((n) => (
          <li key={n.id} className={cx('rounded-lg border bg-surface p-4', n.pinned ? 'border-accent' : 'border-line')}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{n.pinned && <span aria-label="Pinned">📌 </span>}{n.title}</h3>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" onClick={() => put('notes', { ...n, pinned: !n.pinned })}>{n.pinned ? 'Unpin' : 'Pin'}</Button>
                <Button variant="ghost" onClick={() => setForm(n)} aria-label={`Edit note ${n.title}`}>Edit</Button>
                <Button variant="ghost" onClick={() => setDeleting(n)} aria-label={`Delete note ${n.title}`}>Delete</Button>
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
            <p className="mt-2 text-xs text-soft">Updated {fmtStamp(n.updatedAt)}{n.tags.map((t) => ` · #${t}`)}{n.lectureId && data.events.find((e) => e.id === n.lectureId) && <> · <a className="underline" href={`#/lecture/${n.lectureId}`}>lecture {fmtShort(data.events.find((e) => e.id === n.lectureId)!.date)}</a></>}</p>
          </li>))}
        </ul>
      )}
      {form && <NoteForm note={form === 'new' ? undefined : form} defaults={{ courseId, lectureId }} onClose={() => setForm(null)} />}
      {deleting && <Confirm title="Delete this note?" confirmLabel="Delete note" onCancel={() => setDeleting(null)} onConfirm={async () => { if (await del('notes', deleting.id)) setDeleting(null) }}>“{deleting.title}” will be permanently deleted.</Confirm>}
    </div>
  )
}
