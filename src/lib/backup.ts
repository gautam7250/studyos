import { type Course, type Note, type Snapshot, type StoreName, STORE_KEY, STORE_NAMES, type Session, emptySnapshot } from '../types'
import { isValidKey } from './dates'
import { nowIso } from './util'

export const BACKUP_VERSION = 1
export interface Backup { app: 'studyos'; schemaVersion: number; exportedAt: string; data: Snapshot }
export type ImportMode = 'replace' | 'merge-keep' | 'merge-overwrite'

export function buildBackup(s: Snapshot, exportedAt = nowIso()): Backup {
  // Timer state is transient and the backup bookkeeping key is local, so neither is exported.
  return { app: 'studyos', schemaVersion: BACKUP_VERSION, exportedAt, data: { ...s, prefs: s.prefs.filter((p) => !['timer', 'lastBackup'].includes(p.key)) } }
}
export interface Validation { ok: boolean; errors: string[]; warnings: string[]; backup?: Backup; counts: Partial<Record<StoreName, number>> }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => typeof v === 'string'

/** Validates a parsed JSON value completely before anything touches the database. */
export function validateBackup(raw: unknown): Validation {
  const errors: string[] = [], warnings: string[] = []; const counts: Validation['counts'] = {}
  const fail = () => ({ ok: false, errors, warnings, counts })
  if (!isObj(raw) || raw.app !== 'studyos') { errors.push('This is not a StudyOS backup file.'); return fail() }
  if (typeof raw.schemaVersion !== 'number') { errors.push('The backup has no schema version.'); return fail() }
  if (raw.schemaVersion > BACKUP_VERSION) { errors.push(`This backup comes from a newer StudyOS (schema ${raw.schemaVersion}). Update the app first.`); return fail() }
  if (!isObj(raw.data)) { errors.push('The backup contains no data section.'); return fail() }
  const data = emptySnapshot() as unknown as Record<StoreName, Record<string, unknown>[]>
  for (const s of STORE_NAMES) {
    const arr = raw.data[s]
    if (arr === undefined) continue // older backups may lack newer stores
    if (!Array.isArray(arr)) { errors.push(`"${s}" must be a list.`); continue }
    const key = STORE_KEY[s]; const seen = new Set<string>()
    arr.forEach((r, i) => {
      if (!isObj(r) || !str(r[key]) || !r[key]) { errors.push(`${s}[${i}] has no "${key}".`); return }
      if (seen.has(r[key] as string)) { errors.push(`${s} contains the duplicate id "${r[key]}".`); return }
      seen.add(r[key] as string)
      const need: Record<string, (r: Record<string, unknown>) => boolean> = {
        courses: (x) => str(x.name), series: (x) => str(x.courseId) && isValidKey(x.startDate), events: (x) => str(x.courseId) && isValidKey(x.date) && str(x.start) && str(x.end),
        lectures: (x) => str(x.eventId), notes: (x) => str(x.courseId) && str(x.title), sessions: (x) => str(x.courseId) && isValidKey(x.date) && typeof x.minutes === 'number' && x.minutes > 0,
        tasks: (x) => str(x.title), exams: (x) => str(x.courseId) && Array.isArray(x.topics),
      }
      if (need[s] && !need[s](r)) errors.push(`${s}[${i}] ("${r[key]}") is missing required fields or has invalid values.`)
    })
    data[s] = arr as Record<string, unknown>[]; counts[s] = arr.length
  }
  if (errors.length) return fail()
  const courseIds = new Set(data.courses.map((c) => c.id))
  for (const s of ['events', 'notes', 'sessions', 'tasks', 'exams'] as StoreName[]) {
    const n = data[s].filter((r) => r.courseId && !courseIds.has(r.courseId as string)).length
    if (n) warnings.push(`${n} ${s} refer to courses that are not in this file (fine when merging into existing courses).`)
  }
  return { ok: true, errors, warnings, counts, backup: { app: 'studyos', schemaVersion: raw.schemaVersion, exportedAt: str(raw.exportedAt) ? (raw.exportedAt as string) : '', data: data as unknown as Snapshot } }
}
export interface ImportPlan { result: Snapshot; added: number; conflicts: number; replaced: number; skipped: number }
/** Computes the resulting dataset without touching storage, so the UI can preview it. */
export function planImport(existing: Snapshot, incoming: Snapshot, mode: ImportMode): ImportPlan {
  if (mode === 'replace') {
    const keep = existing.prefs.filter((p) => ['timer', 'lastBackup'].includes(p.key))
    const n = STORE_NAMES.reduce((a, s) => a + incoming[s].length, 0)
    return { result: { ...incoming, prefs: [...incoming.prefs.filter((p) => !['timer', 'lastBackup'].includes(p.key)), ...keep] }, added: n, conflicts: 0, replaced: 0, skipped: 0 }
  }
  const result = emptySnapshot() as unknown as Record<StoreName, Record<string, unknown>[]>
  let added = 0, conflicts = 0, replaced = 0, skipped = 0
  for (const s of STORE_NAMES) {
    const key = STORE_KEY[s]; const map = new Map((existing[s] as unknown as Record<string, unknown>[]).map((r) => [r[key] as string, r]))
    for (const r of incoming[s] as unknown as Record<string, unknown>[]) {
      const id = r[key] as string
      if (!map.has(id)) { map.set(id, r); added++ }
      else if (JSON.stringify(map.get(id)) === JSON.stringify(r)) skipped++
      else { conflicts++; if (mode === 'merge-overwrite') { map.set(id, r); replaced++ } else skipped++ }
    }
    result[s] = [...map.values()]
  }
  return { result: result as unknown as Snapshot, added, conflicts, replaced, skipped }
}

const cell = (v: unknown) => { let t = String(v ?? ''); if (/^[=+\-@]/.test(t)) t = `'${t}`; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(cell).join(',')).join('\n')
export function sessionsToCsv(sessions: Session[], courses: Course[]): string {
  const name = new Map(courses.map((c) => [c.id, c.name]))
  return toCsv(['date', 'course', 'type', 'start', 'end', 'minutes', 'hours', 'topics', 'notes', 'completed'],
    [...sessions].sort((a, b) => a.date.localeCompare(b.date)).map((s) => [s.date, name.get(s.courseId) ?? '(deleted course)', s.type, s.startTime ?? '', s.endTime ?? '', s.minutes, (s.minutes / 60).toFixed(2), s.topics, s.notes, s.completed ? 'yes' : 'no']))
}
export function courseNotesToMarkdown(course: Course, notes: Note[]): string {
  const body = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
    .map((n) => `## ${n.pinned ? '📌 ' : ''}${n.title}\n\n*Updated ${n.updatedAt.slice(0, 10)}${n.tags.length ? ' · tags: ' + n.tags.join(', ') : ''}*\n\n${n.body}\n`).join('\n')
  return `# ${course.name}\n\n${body || '*No notes yet.*\n'}`
}
