import type { CalEvent, Session, Task, Exam } from '../types'
let n = 0
export const session = (p: Partial<Session> = {}): Session => ({ id: `s${++n}`, courseId: 'c1', date: '2026-03-02', minutes: 60, type: 'independent', topics: '', notes: '', completed: true, ...p })
export const event = (p: Partial<CalEvent> = {}): CalEvent => ({ id: `e${++n}`, courseId: 'c1', title: 'Lecture', date: '2026-03-02', start: '10:00', end: '12:00', room: '', instructor: '', type: 'lecture', ...p })
export const task = (p: Partial<Task> = {}): Task => ({ id: `t${++n}`, title: 'Task', description: '', priority: 'medium', status: 'todo', tags: [], notes: '', url: '', createdAt: '2026-03-01T00:00:00Z', ...p })
export const exam = (p: Partial<Exam> = {}): Exam => ({ id: `x${++n}`, courseId: 'c1', title: 'Exam', format: '', topics: [], questions: [], mocks: [], revisions: [], nextAction: '', ...p })
