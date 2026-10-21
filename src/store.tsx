import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { applyChanges, ensureSeed, fileGet, fileUnlinkLectures, filePut, filesDelete, filesMeta, loadSnapshot, MAX_FILE_BYTES, openDb, replaceAll as dbReplaceAll, type FileMeta } from './db'
import { nowIso, uid } from './lib/util'
import { type Changes, type Course, emptySnapshot, type Snapshot, type StoreName, STORE_KEY, STORE_NAMES } from './types'

interface Api {
  data: Snapshot; courseMap: Map<string, Course>
  apply: (c: Changes) => Promise<boolean>
  put: <K extends StoreName>(store: K, rec: Snapshot[K][number]) => Promise<boolean>
  del: (store: StoreName, id: string) => Promise<boolean>
  replaceAll: (s: Snapshot) => Promise<boolean>
  pref: <T,>(key: string, fallback: T) => T
  setPref: (key: string, value: unknown) => Promise<boolean>
  error: string | null; clearError: () => void
  files: FileMeta[]
  addFiles: (list: File[], link: { courseId?: string; lectureId?: string }) => Promise<string[]>
  removeFilesWhere: (pred: (f: FileMeta) => boolean) => Promise<void>
  unlinkLectureFiles: (ids: string[]) => Promise<void>
  openFile: (id: string, download?: boolean) => Promise<void>
}
const Ctx = createContext<Api | null>(null)
export const useData = () => { const c = useContext(Ctx); if (!c) throw new Error('useData outside DataProvider'); return c }

function merge(prev: Snapshot, ch: Changes): Snapshot {
  const next = { ...prev } as Record<StoreName, unknown[]>
  for (const s of STORE_NAMES) {
    const c = ch[s]; if (!c) continue; const key = STORE_KEY[s]
    const dels = new Set(c.del ?? []); const puts = new Map(((c.put ?? []) as unknown as Record<string, string>[]).map((r) => [r[key], r]))
    const kept = (prev[s] as unknown as Record<string, string>[]).filter((r) => !dels.has(r[key])).map((r) => puts.get(r[key]) ?? r)
    const existing = new Set(kept.map((r) => r[key]))
    next[s] = [...kept, ...[...puts.values()].filter((r) => !existing.has(r[key]) && !dels.has(r[key]))]
  }
  return next as unknown as Snapshot
}

export function DataProvider({ children, dbName }: { children: ReactNode; dbName?: string }) {
  const [data, setData] = useState<Snapshot>(emptySnapshot)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<FileMeta[]>([])
  const dbRef = useRef<IDBDatabase | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const db = await openDb(dbName); await ensureSeed(db); const snap = await loadSnapshot(db); const fm = await filesMeta(db)
        if (!alive) return; dbRef.current = db; setData(snap); setFiles(fm); setStatus('ready')
      } catch (e) { if (alive) { setError(e instanceof Error ? e.message : String(e)); setStatus('error') } }
    })()
    return () => { alive = false; dbRef.current?.close() }
  }, [dbName])

  const apply = useCallback(async (c: Changes) => {
    if (!dbRef.current) return false
    try { await applyChanges(dbRef.current, c); setData((p) => merge(p, c)); return true }
    catch (e) { setError(`Your change could not be saved: ${e instanceof Error ? e.message : e}`); return false }
  }, [])
  const api = useMemo<Api>(() => ({
    data, courseMap: new Map(data.courses.map((c) => [c.id, c])), apply,
    put: (store, rec) => apply({ [store]: { put: [rec] } } as Changes),
    del: (store, id) => apply({ [store]: { del: [id] } } as Changes),
    replaceAll: async (s) => {
      if (!dbRef.current) return false
      try { await dbReplaceAll(dbRef.current, s); setData(s); return true } catch (e) { setError(`Restore failed and nothing was changed: ${e instanceof Error ? e.message : e}`); return false }
    },
    pref: <T,>(key: string, fallback: T) => { const p = data.prefs.find((x) => x.key === key); return (p ? p.value : fallback) as T },
    setPref: (key, value) => apply({ prefs: { put: [{ key, value }] } }),
    error, clearError: () => setError(null), files,
    addFiles: async (list, link) => {
      const db = dbRef.current; const errs: string[] = []; const added: FileMeta[] = []; if (!db) return ['Storage is not ready.']
      for (const f of list) {
        if (f.size > MAX_FILE_BYTES) { errs.push(`${f.name} is larger than 50 MB and was not added.`); continue }
        try { added.push(await filePut(db, { id: uid('file'), ...link, name: f.name, type: f.type, size: f.size, addedAt: nowIso(), data: await f.arrayBuffer() })) }
        catch (e) { errs.push(`${f.name} could not be saved: ${e instanceof Error ? e.message : e}`) }
      }
      setFiles((p) => [...p, ...added]); return errs
    },
    removeFilesWhere: async (pred) => { const db = dbRef.current; if (!db) return; const ids = files.filter(pred).map((f) => f.id); await filesDelete(db, ids); setFiles((p) => p.filter((f) => !ids.includes(f.id))) },
    unlinkLectureFiles: async (ids) => { const db = dbRef.current; if (!db) return; const set = new Set(ids); await fileUnlinkLectures(db, set); setFiles((p) => p.map((f) => (f.lectureId && set.has(f.lectureId) ? { ...f, lectureId: undefined } : f))) },
    openFile: async (id, download) => {
      const rec = dbRef.current && (await fileGet(dbRef.current, id)); if (!rec) return
      const url = URL.createObjectURL(new Blob([rec.data], { type: rec.type || 'application/octet-stream' }))
      if (download) { const a = document.createElement('a'); a.href = url; a.download = rec.name; a.click() } else window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
  }), [data, apply, error, files])

  if (status === 'loading') return <div className="p-10 text-soft" role="status">Opening your local study data…</div>
  if (status === 'error') return (
    <div className="mx-auto max-w-lg p-10" role="alert">
      <h1 className="font-display text-2xl">StudyOS cannot open its local storage</h1>
      <p className="mt-2 text-soft">{error}</p>
      <p className="mt-2 text-sm text-soft">Private browsing windows and some browser settings block IndexedDB. Open StudyOS in a normal window and reload.</p>
    </div>
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
