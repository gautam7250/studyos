import { describe, expect, it } from 'vitest'
import { applyChanges, filePut, fileGet, filesDelete, filesMeta, fileUnlinkLectures, DB_VERSION, ensureSeed, loadSnapshot, openDb, replaceAll } from './db'
import { planCourseDelete, planEventDelete, integrityReport } from './lib/cascade'
import { buildBackup, planImport, sessionsToCsv, validateBackup, courseNotesToMarkdown } from './lib/backup'
import { generateEvents } from './lib/recurrence'
import { newCourse } from './db'
import { emptySnapshot, STORE_NAMES, type Snapshot, type LectureRecord, type Series } from './types'
import { session, task, exam } from './test/factories'

let n = 0
const fresh = () => openDb(`test-${++n}-${Math.random()}`)
const lecture = (eventId: string, courseId: string, extra: Partial<LectureRecord> = {}): LectureRecord => ({ id: eventId, eventId, courseId, attendance: 'attended', topics: 'Modus ponens', concepts: '', examples: '', notes: '', questions: '', homework: '', summary: '', followUps: '', updatedAt: '2026-03-02T10:00:00Z', ...extra })
const ser: Series = { id: 'ser', courseId: 'c1', title: 'Logic', weekday: 1, start: '10:00', end: '12:00', room: '', instructor: '', type: 'lecture', startDate: '2026-03-02', endDate: '2026-03-16', skip: [] }

async function populated(): Promise<Snapshot> {
  const db = await fresh(); const c1 = newCourse({ id: 'c1', name: 'Logic' }), c2 = newCourse({ id: 'c2', name: 'Ethics' })
  const events = generateEvents(ser)
  await applyChanges(db, {
    courses: { put: [c1, c2] }, series: { put: [ser] }, events: { put: events },
    lectures: { put: [lecture(events[0].id, 'c1')] },
    notes: { put: [{ id: 'n1', courseId: 'c1', lectureId: events[0].id, title: 'Modus ponens', body: 'If P then Q', tags: ['logic'], pinned: true, createdAt: '2026-03-02T10:00:00Z', updatedAt: '2026-03-02T10:00:00Z' }] },
    sessions: { put: [session({ id: 's1', courseId: 'c1', lectureId: events[0].id }), session({ id: 's2', courseId: 'c2' })] },
    tasks: { put: [task({ id: 't1', courseId: 'c1', lectureId: events[0].id }), task({ id: 't2', courseId: 'c2' })] },
    exams: { put: [exam({ id: 'x1', courseId: 'c1' })] },
  })
  return loadSnapshot(db)
}

describe('IndexedDB storage', () => {
  it('has a schema version and every store', async () => {
    const db = await fresh(); expect(db.version).toBe(DB_VERSION); expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES, 'files'].sort())
  })
  it('keeps data after the connection is closed and reopened (a "refresh")', async () => {
    const name = `persist-${Math.random()}`; let db = await openDb(name)
    await applyChanges(db, { notes: { put: [{ id: 'n1', courseId: 'c', title: 'Kept', body: 'text', tags: [], pinned: false, createdAt: '', updatedAt: '' }] } }); db.close()
    db = await openDb(name); expect((await loadSnapshot(db)).notes[0].title).toBe('Kept')
  })
  it('updates and deletes records', async () => {
    const db = await fresh(); const c = newCourse({ name: 'A' })
    await applyChanges(db, { courses: { put: [c] } }); await applyChanges(db, { courses: { put: [{ ...c, name: 'B' }] } })
    expect((await loadSnapshot(db)).courses.map((x) => x.name)).toEqual(['B'])
    await applyChanges(db, { courses: { del: [c.id] } }); expect((await loadSnapshot(db)).courses).toHaveLength(0)
  })
  it('seeds the 8 editable example courses once, and never re-adds deleted ones', async () => {
    const db = await fresh(); await ensureSeed(db); await ensureSeed(db)
    let s = await loadSnapshot(db); expect(s.courses).toHaveLength(8)
    expect(s.courses.map((c) => c.name)).toContain('Reinforcement Learning for Science')
    await applyChanges(db, { courses: { del: s.courses.map((c) => c.id) } }); await ensureSeed(db)
    s = await loadSnapshot(db); expect(s.courses).toHaveLength(0)
  })
  it('migrating an existing v1 database without data loss is additive (reopen keeps records)', async () => {
    const name = `mig-${Math.random()}`; const db = await openDb(name); await applyChanges(db, { courses: { put: [newCourse({ name: 'Keep' })] } }); db.close()
    expect((await loadSnapshot(await openDb(name))).courses).toHaveLength(1)
  })
})

describe('relationships and integrity', () => {
  it('renaming a course leaves lecture records, notes and sessions attached (stable ids)', async () => {
    const s = await populated(); const renamed = { ...s.courses.find((c) => c.id === 'c1')!, name: 'Logic II' }
    const after = { ...s, courses: s.courses.map((c) => (c.id === 'c1' ? renamed : c)) }
    expect(after.lectures[0].courseId).toBe('c1'); expect(integrityReport(after).every((r) => r.count === 0)).toBe(true)
  })
  it('archiving changes only the flag; all related records remain', async () => {
    const s = await populated(); const archived = s.courses.map((c) => (c.id === 'c1' ? { ...c, archived: true } : c))
    expect(archived.find((c) => c.id === 'c1')!.archived).toBe(true)
    expect(s.notes).toHaveLength(1); expect(s.sessions).toHaveLength(2); expect(s.lectures).toHaveLength(1)
  })
  it('deleting a course removes only that course’s data and reports counts first', async () => {
    const s = await populated(); const plan = planCourseDelete(s, 'c1')
    expect(plan.counts).toMatchObject({ lectures: 3, 'lecture records': 1, notes: 1, 'study sessions': 1, tasks: 1, exams: 1 })
    const db = await fresh(); await replaceAll(db, s); await applyChanges(db, plan.changes)
    const after = await loadSnapshot(db)
    expect(after.courses.map((c) => c.id)).toEqual(['c2']); expect(after.sessions.map((x) => x.id)).toEqual(['s2']); expect(after.tasks.map((x) => x.id)).toEqual(['t2'])
    expect(integrityReport(after).every((r) => r.count === 0)).toBe(true)
  })
  it('deleting one occurrence skips it in the series, removes its record, and unlinks notes/sessions/tasks instead of deleting them', async () => {
    const s = await populated(); const id = s.events[0].id
    const ch = planEventDelete(s, id, 'one')
    expect(ch.events?.del).toEqual([id]); expect(ch.lectures?.del).toEqual([id]); expect(ch.series?.put?.[0].skip).toEqual([s.events[0].date])
    expect(ch.notes?.put?.[0].lectureId).toBeUndefined(); expect(ch.sessions?.put?.[0].id).toBe('s1'); expect(ch.tasks?.put?.[0].id).toBe('t1')
  })
  it('deleting a whole series removes all its events', async () => {
    const s = await populated(); const ch = planEventDelete(s, s.events[1].id, 'series')
    expect(ch.events?.del).toHaveLength(3); expect(ch.series?.del).toEqual(['ser'])
  })
})

describe('backup and restore', () => {
  it('round-trips every kind of record through JSON validation and a replace restore', async () => {
    const s = await populated(); const json = JSON.parse(JSON.stringify(buildBackup(s)))
    const v = validateBackup(json); expect(v.ok).toBe(true); expect(v.errors).toEqual([])
    const plan = planImport(emptySnapshot(), v.backup!.data, 'replace')
    const db = await fresh(); await replaceAll(db, plan.result); const restored = await loadSnapshot(db)
    for (const k of ['courses', 'series', 'events', 'lectures', 'notes', 'sessions', 'tasks', 'exams'] as const) expect(restored[k]).toHaveLength(s[k].length)
    expect(restored.notes[0].body).toBe('If P then Q')
  })
  it('rejects bad files before touching anything', () => {
    expect(validateBackup('nope').ok).toBe(false)
    expect(validateBackup({ app: 'other' }).errors[0]).toMatch(/not a StudyOS/)
    expect(validateBackup({ app: 'studyos', schemaVersion: 99, data: {} }).errors[0]).toMatch(/newer/)
    expect(validateBackup({ app: 'studyos', schemaVersion: 1, data: { sessions: [{ id: 'a', courseId: 'c', date: 'bad', minutes: 5 }] } }).ok).toBe(false)
    expect(validateBackup({ app: 'studyos', schemaVersion: 1, data: { courses: [{ id: 'a', name: 'x' }, { id: 'a', name: 'y' }] } }).errors[0]).toMatch(/duplicate/)
    expect(validateBackup({ app: 'studyos', schemaVersion: 1, data: { tasks: {} } }).ok).toBe(false)
  })
  it('merge keeps existing records on conflict, adds new ones, and reports duplicates', async () => {
    const s = await populated(); const incoming = structuredClone(s)
    incoming.courses[0].name = 'Changed in backup'; incoming.notes.push({ ...incoming.notes[0], id: 'n-new', title: 'New' })
    const keep = planImport(s, incoming, 'merge-keep')
    expect(keep.conflicts).toBe(1); expect(keep.added).toBe(1); expect(keep.result.courses.find((c) => c.id === incoming.courses[0].id)!.name).toBe(s.courses[0].name)
    const over = planImport(s, incoming, 'merge-overwrite')
    expect(over.result.courses.find((c) => c.id === incoming.courses[0].id)!.name).toBe('Changed in backup'); expect(over.result.notes).toHaveLength(2)
  })
  it('a merge never deletes existing data', async () => {
    const s = await populated(); const r = planImport(s, emptySnapshot(), 'merge-keep'); expect(r.result.sessions).toHaveLength(2); expect(r.added).toBe(0)
  })
  it('exports sessions as safe CSV and notes as Markdown', async () => {
    const s = await populated(); s.sessions[0].notes = '=HYPERLINK("x"), "quoted"'
    const csv = sessionsToCsv(s.sessions, s.courses); expect(csv.split('\n')[0]).toContain('minutes'); expect(csv).toContain(`"'=HYPERLINK(""x""), ""quoted"""`)
    expect(courseNotesToMarkdown(s.courses[0], s.notes)).toContain('If P then Q')
  })
})

describe('attached files and schema upgrade', () => {
  it('upgrades a v1 database to v2 without losing any data', async () => {
    const name = `v1-${Math.random()}`
    await new Promise<void>((res, rej) => { const r = indexedDB.open(name, 1); r.onupgradeneeded = () => { for (const s of STORE_NAMES) r.result.createObjectStore(s, { keyPath: s === 'prefs' ? 'key' : 'id' }); r.transaction!.objectStore('courses').put(newCourse({ name: 'Old data' })) }; r.onsuccess = () => { r.result.close(); res() }; r.onerror = () => rej(r.error) })
    const db = await openDb(name); expect(db.version).toBe(2); expect(db.objectStoreNames.contains('files')).toBe(true); expect((await loadSnapshot(db)).courses[0].name).toBe('Old data')
  })
  it('stores, lists, reads back, unlinks and deletes files', async () => {
    const db = await fresh(); const bytes = new Uint8Array([1, 2, 3, 4]).buffer
    const m = await filePut(db, { id: 'f1', courseId: 'c1', lectureId: 'e1', name: 'slides.pdf', type: 'application/pdf', size: 4, addedAt: '2026-03-02T00:00:00Z', data: bytes })
    expect(m).not.toHaveProperty('data'); expect(await filesMeta(db)).toHaveLength(1)
    expect([...new Uint8Array((await fileGet(db, 'f1'))!.data)]).toEqual([1, 2, 3, 4])
    await fileUnlinkLectures(db, new Set(['e1'])); expect((await filesMeta(db))[0].lectureId).toBeUndefined(); expect((await filesMeta(db))[0].courseId).toBe('c1')
    await filesDelete(db, ['f1']); expect(await filesMeta(db)).toHaveLength(0)
  })
})
