import type { Exam, ExamTopic } from '../types'
import { daysUntil } from './dates'

/** Progress = revised topics / all topics. Confidence is reported separately and never changes progress. */
export function examProgress(e: Exam) {
  const total = e.topics.length, done = e.topics.filter((t) => t.done).length
  const rated = e.topics.filter((t) => t.confidence > 0)
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, avgConfidence: rated.length ? rated.reduce((a, t) => a + t.confidence, 0) / rated.length : null }
}
export const weakTopics = (e: Exam): ExamTopic[] => e.topics.filter((t) => t.confidence > 0 && t.confidence <= 2)
export const mockAverage = (e: Exam): number | null => {
  const m = e.mocks.filter((x) => x.max > 0); return m.length ? m.reduce((a, x) => a + x.score / x.max, 0) / m.length : null
}
export const countdown = (e: Exam, today?: string) => (e.date ? daysUntil(e.date, today) : null)
export function nextRevision(e: Exam, today: string) {
  return e.revisions.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date)).find((r) => r.date >= today) ?? null
}
