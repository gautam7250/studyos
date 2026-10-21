import { useRef, useState } from 'react'
import { Button, Card, Confirm, PageHeader, Field, inputCls } from '../components/ui'
import { buildBackup, courseNotesToMarkdown, planImport, sessionsToCsv, validateBackup, type ImportMode, type Validation } from '../lib/backup'
import { integrityReport } from '../lib/cascade'
import { hasDemo, planDemoLoad, planDemoRemove } from '../lib/demo'
import { fmtStamp, localDateKey } from '../lib/dates'
import { download, nowIso } from '../lib/util'
import { fmtSize } from '../components/Files'
import { useData } from '../store'
import { STORE_NAMES } from '../types'

export default function Settings() {
  const { data, apply, replaceAll, pref, setPref, files } = useData()
  const [file, setFile] = useState<{ name: string; v: Validation } | null>(null); const [mode, setMode] = useState<ImportMode>('merge-keep'); const [confirmReplace, setConfirmReplace] = useState(false)
  const [msg, setMsg] = useState(''); const [persist, setPersist] = useState(''); const input = useRef<HTMLInputElement>(null)
  const last = pref<string | null>('lastExport', null); const stamp = localDateKey()
  const plan = file?.v.ok && file.v.backup ? planImport(data, file.v.backup.data, mode) : null
  const integrity = integrityReport(data); const problems = integrity.filter((r) => r.count > 0)

  async function exportJson() { download(`studyos-backup-${stamp}.json`, JSON.stringify(buildBackup(data), null, 2), 'application/json'); await setPref('lastExport', nowIso()); setMsg('Backup downloaded. Keep it somewhere outside the browser (iCloud Drive, an external disk).') }
  async function pick(f: File | undefined) {
    setMsg(''); if (!f) return
    try { setFile({ name: f.name, v: validateBackup(JSON.parse(await f.text())) }) } catch { setFile({ name: f.name, v: { ok: false, errors: ['This file is not valid JSON.'], warnings: [], counts: {} } }) }
  }
  async function runImport() {
    if (!plan) return
    const ok = await replaceAll(plan.result)
    if (ok) { setMsg(mode === 'replace' ? 'Backup restored. All previous data was replaced.' : `Merged: ${plan.added} added, ${plan.replaced} overwritten, ${plan.skipped} left unchanged.`); setFile(null); setConfirmReplace(false); if (input.current) input.current.value = '' }
  }
  return (
    <>
      <PageHeader title="Settings & Backup" subtitle="Your data lives in this browser on this device. Back it up regularly." />
      <div className="space-y-4">
        <Card title="Where your data lives">
          <p className="text-sm">StudyOS stores everything in your browser’s IndexedDB. It is private to this website address and this browser: <strong>localhost data does not appear on GitHub Pages, and nothing syncs between devices</strong>. Clearing site data, using a private window, or a browser reset can erase it. Export a backup often.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Button onClick={async () => setPersist((await navigator.storage?.persist?.()) ? 'Persistent storage granted: the browser will not evict your data under storage pressure.' : 'The browser did not grant persistent storage. Keep backups.')}>Request persistent storage</Button><span className="text-sm text-soft" role="status">{persist}</span></div>
        </Card>

        <Card title="Export">
          <p className="mb-3 text-sm text-soft">Last export started: {last ? fmtStamp(last) : 'never'} (the app cannot confirm where the file was saved).</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={exportJson}>Download full backup (JSON)</Button>
            <Button onClick={() => download(`studyos-sessions-${stamp}.csv`, sessionsToCsv(data.sessions, data.courses), 'text/csv')}>Study sessions (CSV)</Button>
          </div>
          <h3 className="mt-4 text-sm font-medium">Course notes (Markdown)</h3>
          <div className="mt-2 flex flex-wrap gap-2">{data.courses.map((c) => <Button key={c.id} onClick={() => download(`${(c.code || c.name).replace(/[^\w-]+/g, '_')}-notes.md`, courseNotesToMarkdown(c, data.notes.filter((n) => n.courseId === c.id)), 'text/markdown')}>{c.code || c.name}</Button>)}</div>
        </Card>

        <Card title="Restore from a backup">
          <Field label="Choose a StudyOS backup file (.json)"><input ref={input} type="file" accept="application/json,.json" className={inputCls} onChange={(e) => pick(e.target.files?.[0])} /></Field>
          {file && !file.v.ok && <div role="alert" className="mt-3 rounded-md border border-danger p-3 text-sm text-danger"><strong>{file.name} cannot be imported. Nothing was changed.</strong><ul className="mt-1 list-disc pl-5">{file.v.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {file?.v.ok && plan && (
            <div className="mt-3 text-sm">
              <p className="font-medium">Preview of {file.name} {file.v.backup?.exportedAt && `(exported ${fmtStamp(file.v.backup.exportedAt)})`}</p>
              <table className="mt-2 w-full max-w-md text-left"><thead className="text-soft"><tr><th>Records</th><th>In file</th><th>Now</th></tr></thead><tbody>{STORE_NAMES.filter((s) => s !== 'prefs').map((s) => <tr key={s}><td>{s}</td><td>{file.v.counts[s] ?? 0}</td><td>{data[s].length}</td></tr>)}</tbody></table>
              {file.v.warnings.map((w, i) => <p key={i} className="mt-1 text-warn">{w}</p>)}
              <fieldset className="mt-3 space-y-1"><legend className="font-medium">How should it be imported?</legend>
                <label className="block"><input type="radio" name="mode" checked={mode === 'merge-keep'} onChange={() => setMode('merge-keep')} /> Merge, keep my current version when an ID exists in both (safest)</label>
                <label className="block"><input type="radio" name="mode" checked={mode === 'merge-overwrite'} onChange={() => setMode('merge-overwrite')} /> Merge, use the backup’s version when an ID exists in both</label>
                <label className="block"><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace everything with the backup</label></fieldset>
              <p className="mt-2" role="status">{mode === 'replace' ? `Result: all current data is replaced by ${plan.added} records from the file.` : `Result: ${plan.added} new records added, ${plan.conflicts} conflicting IDs (${mode === 'merge-keep' ? `${plan.skipped} kept as they are` : `${plan.replaced} overwritten`}). Nothing is deleted.`}</p>
              <div className="mt-3 flex gap-2"><Button variant="primary" onClick={() => (mode === 'replace' ? setConfirmReplace(true) : runImport())}>Import</Button><Button onClick={() => { setFile(null); if (input.current) input.current.value = '' }}>Cancel</Button></div>
            </div>
          )}
          {msg && <p role="status" className="mt-3 text-sm text-ok">{msg}</p>}
        </Card>

        <Card title="Attached files">
          <p className="text-sm">{files.length} file{files.length === 1 ? '' : 's'} stored, {fmtSize(files.reduce((a, f) => a + f.size, 0))} in total.</p>
          <p className="mt-1 text-sm text-soft"><strong>Files are not included in the JSON backup</strong> (it only holds text records). Keep your original files, or use Download on each file in a course’s Files tab. Deleting a course deletes its attached files.</p>
        </Card>

        <Card title="Sample (demo) data">
          <p className="mb-3 text-sm text-soft">Adds clearly labelled sample lectures, study sessions, tasks and an exam without a date to the first three courses, so you can see how the charts behave. Everything is tagged “demo” and can be removed in one step. Your own records are never touched.</p>
          <div className="flex gap-2"><Button disabled={hasDemo(data)} onClick={async () => { if (await apply(planDemoLoad(data))) setMsg('Demo data loaded.') }}>Load demo data</Button><Button disabled={!hasDemo(data)} onClick={async () => { if (await apply(planDemoRemove(data))) setMsg('Demo data removed.') }}>Remove demo data</Button></div>
        </Card>

        <Card title="Data integrity check">
          {problems.length === 0 ? <p className="text-sm text-ok">No broken references found.</p> : <ul className="list-disc pl-5 text-sm text-warn">{problems.map((p) => <li key={p.label}>{p.label}: {p.count}</li>)}</ul>}
          <p className="mt-1 text-xs text-soft">Checks that notes, sessions, tasks, events and exams still point to existing courses and lectures.</p>
        </Card>
      </div>
      {confirmReplace && <Confirm title="Replace all current data?" confirmLabel="Replace everything" onCancel={() => setConfirmReplace(false)} onConfirm={runImport}>Your current courses, notes, sessions and everything else will be replaced by the backup. This cannot be undone, so download a backup of the current state first if you might need it.</Confirm>}
    </>
  )
}
