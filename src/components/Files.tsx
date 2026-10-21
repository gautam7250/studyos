import { useRef, useState } from 'react'
import { fmtStamp } from '../lib/dates'
import { useData } from '../store'
import { Button, Confirm, Empty } from './ui'

export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`)

/** Attach any files (slides, PDFs, images, code) to a course or a single lecture. They stay in this browser only. */
export function FilesPanel({ courseId, lectureId }: { courseId: string; lectureId?: string }) {
  const { files, addFiles, removeFilesWhere, openFile } = useData()
  const input = useRef<HTMLInputElement>(null); const [msgs, setMsgs] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [over, setOver] = useState(false); const [del, setDel] = useState<string | null>(null)
  const mine = files.filter((f) => f.courseId === courseId && (!lectureId || f.lectureId === lectureId)).sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  async function add(list: FileList | File[] | null) {
    if (!list || !list.length) return; setBusy(true)
    const errs = await addFiles([...list], { courseId, lectureId }); setMsgs(errs); setBusy(false); if (input.current) input.current.value = ''
  }
  const target = files.find((f) => f.id === del)
  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
        className={'rounded-lg border-2 border-dashed p-5 text-center text-sm ' + (over ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}>
        <p className="font-medium">Drop files here, or</p>
        <label className="mt-2 inline-block cursor-pointer rounded-md border border-accent bg-accent px-3 py-1.5 font-medium text-accent-ink">
          {busy ? 'Saving…' : 'Choose files'}<input ref={input} type="file" multiple aria-label="Upload files" className="sr-only" onChange={(e) => add(e.target.files)} />
        </label>
        <p className="mt-2 text-xs text-soft">Any file type, up to 50 MB each. Files are stored privately in this browser. They are not uploaded anywhere and are not part of the JSON backup.</p>
      </div>
      {msgs.length > 0 && <ul role="alert" className="mt-2 text-sm text-danger">{msgs.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      {mine.length === 0 ? <div className="mt-3"><Empty title="No files yet" /></div> : (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">{mine.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{f.name}</div><div className="text-xs text-soft">{fmtSize(f.size)} · {f.type || 'unknown type'} · added {fmtStamp(f.addedAt)}</div></div>
            <Button onClick={() => openFile(f.id)} aria-label={`Open ${f.name}`}>Open</Button><Button onClick={() => openFile(f.id, true)} aria-label={`Download ${f.name}`}>Download</Button><Button variant="ghost" onClick={() => setDel(f.id)} aria-label={`Delete ${f.name}`}>Delete</Button>
          </li>))}</ul>
      )}
      {target && <Confirm title="Delete this file?" confirmLabel="Delete file" onCancel={() => setDel(null)} onConfirm={async () => { await removeFilesWhere((f) => f.id === target.id); setDel(null) }}>“{target.name}” will be permanently removed from this browser. It cannot be recovered unless you still have the original.</Confirm>}
    </div>
  )
}
