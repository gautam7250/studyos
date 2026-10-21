import type { Priority, Task } from '../types'
import { addDays, weekStart } from './dates'

export type View = 'all' | 'today' | 'week' | 'overdue' | 'upcoming' | 'completed'
const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
export const isOpen = (t: Task) => t.status !== 'done'
export const isOverdue = (t: Task, today: string) => isOpen(t) && !!t.due && t.due < today

export function matchesView(t: Task, view: View, today: string): boolean {
  if (view === 'all') return true
  if (view === 'completed') return t.status === 'done'
  if (!isOpen(t)) return false
  if (view === 'overdue') return !!t.due && t.due < today
  if (!t.due) return false
  if (view === 'today') return t.due === today
  if (view === 'upcoming') return t.due > today
  const ws = weekStart(today); return t.due >= ws && t.due <= addDays(ws, 6) // week
}
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || rank[a.priority] - rank[b.priority] || a.createdAt.localeCompare(b.createdAt))
}
/** Suggestion only: overdue first, then by priority, then by due date. Nothing is ever completed automatically. */
export function nextTask(tasks: Task[], today: string): { task: Task; reason: string } | null {
  const open = tasks.filter(isOpen); if (!open.length) return null
  const sorted = [...open].sort((a, b) =>
    Number(isOverdue(b, today)) - Number(isOverdue(a, today)) || rank[a.priority] - rank[b.priority] ||
    (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt.localeCompare(b.createdAt))
  const t = sorted[0]
  const reason = isOverdue(t, today) ? 'Overdue' : t.due === today ? 'Due today' : t.priority === 'high' ? 'High priority' : t.due ? 'Soonest deadline' : 'Open task'
  return { task: t, reason }
}
export function completionRate(tasks: Task[]): number | null { return tasks.length ? tasks.filter((t) => t.status === 'done').length / tasks.length : null }
