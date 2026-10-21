import { type Changes, type Course, type Snapshot, type StoreName, STORE_KEY, STORE_NAMES, emptySnapshot } from './types'
import { nowIso } from './lib/util'

/** Bump DB_VERSION and append one function to MIGRATIONS per schema change. Migrations may only add; they never drop stores. */
export const DB_VERSION = 2
const MIGRATIONS: ((db: IDBDatabase) => void)[] = [
  (db) => { for (const s of STORE_NAMES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: STORE_KEY[s] }) },
  // v2: attached files (kept outside the JSON-backup snapshot because they are binary)
  (db) => { if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' }) },
]

export function openDb(name = 'studyos'): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION)
    req.onupgradeneeded = (e) => { for (let v = e.oldVersion; v < DB_VERSION; v++) MIGRATIONS[v](req.result) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open the local database.'))
    req.onblocked = () => reject(new Error('The database is open in another tab. Close other StudyOS tabs and reload.'))
  })
}
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('Transaction aborted')) })
const asPromise = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

export async function loadSnapshot(db: IDBDatabase): Promise<Snapshot> {
  const snap = emptySnapshot() as unknown as Record<StoreName, unknown[]>
  const tx = db.transaction(STORE_NAMES, 'readonly')
  await Promise.all(STORE_NAMES.map(async (s) => { snap[s] = await asPromise(tx.objectStore(s).getAll()) }))
  return snap as unknown as Snapshot
}
/** Applies puts and deletes across stores in ONE transaction (all or nothing). */
export async function applyChanges(db: IDBDatabase, changes: Changes): Promise<void> {
  const stores = (Object.keys(changes) as StoreName[]).filter((s) => changes[s]?.put?.length || changes[s]?.del?.length)
  if (!stores.length) return
  const tx = db.transaction(stores, 'readwrite')
  for (const s of stores) {
    const c = changes[s]!; const os = tx.objectStore(s)
    for (const r of (c.put ?? []) as unknown[]) os.put(r)
    for (const id of c.del ?? []) os.delete(id)
  }
  await done(tx)
}
/** Atomically replaces everything (used by "replace" restore). */
export async function replaceAll(db: IDBDatabase, snap: Snapshot): Promise<void> {
  const tx = db.transaction(STORE_NAMES, 'readwrite')
  for (const s of STORE_NAMES) { const os = tx.objectStore(s); os.clear(); for (const r of snap[s] as unknown[]) os.put(r) }
  await done(tx)
}

export const EXAMPLE_COURSES: [string, string, string][] = [
  ['Logic and Argumentation Theory', 'LOG', '#0f5c5c'], ['Ethics (MA)', 'ETH', '#8a4b2f'],
  ['Data Modeling and Knowledge Generation', 'DMK', '#3b5ba5'], ['An Introduction to Philosophy', 'INTRO', '#7a4f9c'],
  ['German Elementary Course 3', 'DE3', '#b5892a'], ['Machine Learning for Beginners', 'MLB', '#2f7d4f'],
  ['Mathematical Foundations', 'MATH', '#a3302b'], ['Reinforcement Learning for Science', 'RLS', '#4a6670'],
]
export function newCourse(p: Partial<Course> & { name: string }): Course {
  const t = nowIso()
  return { id: `course_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`, code: '', semester: 'WS 2026/27', instructor: '', room: '', color: '#0f5c5c', description: '', syllabus: [], targetHoursPerWeek: 4, notes: '', archived: false, createdAt: t, updatedAt: t, ...p }
}
/** Adds the editable starter courses exactly once. Deleting them later never brings them back. */
export async function ensureSeed(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(['prefs', 'courses'], 'readwrite')
  const flag = await asPromise(tx.objectStore('prefs').get('seeded'))
  if (!flag) {
    for (const [name, code, color] of EXAMPLE_COURSES) tx.objectStore('courses').put(newCourse({ name, code, color, example: true }))
    tx.objectStore('prefs').put({ key: 'seeded', value: true })
  }
  await done(tx)
}

/** Attached files. Bytes are stored as an ArrayBuffer; metadata is listed without loading the bytes into app state. */
export interface FileMeta { id: string; courseId?: string; lectureId?: string; name: string; type: string; size: number; addedAt: string }
export interface StoredFile extends FileMeta { data: ArrayBuffer }
export const MAX_FILE_BYTES = 50 * 1024 * 1024
const meta = ({ data: _d, ...m }: StoredFile): FileMeta => m
export async function filesMeta(db: IDBDatabase): Promise<FileMeta[]> {
  return new Promise((res, rej) => {
    const out: FileMeta[] = []; const req = db.transaction('files', 'readonly').objectStore('files').openCursor()
    req.onsuccess = () => { const c = req.result; if (c) { out.push(meta(c.value as StoredFile)); c.continue() } else res(out) }
    req.onerror = () => rej(req.error)
  })
}
export async function filePut(db: IDBDatabase, f: StoredFile): Promise<FileMeta> { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(f); await done(tx); return meta(f) }
export const fileGet = (db: IDBDatabase, id: string) => asPromise<StoredFile | undefined>(db.transaction('files', 'readonly').objectStore('files').get(id))
export async function filesDelete(db: IDBDatabase, ids: string[]) { if (!ids.length) return; const tx = db.transaction('files', 'readwrite'); for (const id of ids) tx.objectStore('files').delete(id); await done(tx) }
export async function fileUnlinkLectures(db: IDBDatabase, lectureIds: Set<string>): Promise<void> {
  const tx = db.transaction('files', 'readwrite'); const os = tx.objectStore('files')
  await new Promise<void>((res, rej) => { const r = os.openCursor(); r.onsuccess = () => { const c = r.result; if (!c) return res(); const v = c.value as StoredFile; if (v.lectureId && lectureIds.has(v.lectureId)) c.update({ ...v, lectureId: undefined }); c.continue() }; r.onerror = () => rej(r.error) })
  await done(tx)
}
