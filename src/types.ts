export type ID = string
export interface Base { id: ID; demo?: boolean }

export interface Course extends Base {
  name: string; code: string; semester: string; instructor: string; room: string
  color: string; description: string; syllabus: string[]; targetHoursPerWeek: number
  notes: string; archived: boolean; example?: boolean; createdAt: string; updatedAt: string
}
export type EventType = 'lecture' | 'seminar' | 'tutorial' | 'lab' | 'exam' | 'other'
export const EVENT_TYPES: EventType[] = ['lecture', 'seminar', 'tutorial', 'lab', 'exam', 'other']
/** A weekly recurring schedule. Concrete occurrences are stored as CalEvents (id = `${series.id}_${date}`). */
export interface Series extends Base {
  courseId: ID; title: string; weekday: number; start: string; end: string; room: string
  instructor: string; type: EventType; startDate: string; endDate: string; skip: string[]
}
export interface CalEvent extends Base {
  seriesId?: ID; courseId: ID; title: string; date: string; start: string; end: string
  room: string; instructor: string; type: EventType; detached?: boolean
}
export type Attendance = 'unrecorded' | 'attended' | 'missed' | 'cancelled'
/** One record per calendar event; `id` equals the event id, so it survives course renames. */
export interface LectureRecord extends Base {
  eventId: ID; courseId: ID; attendance: Attendance; attendedDate?: string
  topics: string; concepts: string; examples: string; notes: string; questions: string
  homework: string; summary: string; followUps: string; updatedAt: string
}
export interface Note extends Base {
  courseId: ID; lectureId?: ID; examTopicId?: ID; title: string; body: string
  tags: string[]; pinned: boolean; createdAt: string; updatedAt: string
}
export type SessionType = 'independent' | 'homework' | 'revision' | 'reading' | 'coding' | 'lecture-review' | 'other'
export const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'independent', label: 'Independent study' }, { value: 'homework', label: 'Homework' },
  { value: 'revision', label: 'Exam revision' }, { value: 'reading', label: 'Reading' },
  { value: 'coding', label: 'Coding / project work' }, { value: 'lecture-review', label: 'Lecture review' },
  { value: 'other', label: 'Other' },
]
export interface Session extends Base {
  courseId: ID; lectureId?: ID; taskId?: ID; date: string; startTime?: string; endTime?: string
  minutes: number; type: SessionType; topics: string; notes: string; completed: boolean
}
export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'todo' | 'doing' | 'done'
export interface Task extends Base {
  courseId?: ID; lectureId?: ID; examId?: ID; title: string; description: string
  assigned?: string; due?: string; priority: Priority; status: TaskStatus
  estMin?: number; actualMin?: number; tags: string[]; notes: string; url: string
  completedDate?: string; createdAt: string
}
export interface ExamTopic { id: ID; title: string; done: boolean; confidence: number } // confidence 0 = unrated, 1-5
export interface PracticeQuestion { id: ID; topicId?: ID; question: string; answer: string; done: boolean }
export interface MockExam { id: ID; date: string; score: number; max: number; notes: string }
export interface RevisionSession { id: ID; date: string; minutes?: number; topicIds: ID[]; note: string; done: boolean }
export interface Exam extends Base {
  courseId: ID; title: string; date?: string; time?: string; format: string
  topics: ExamTopic[]; questions: PracticeQuestion[]; mocks: MockExam[]; revisions: RevisionSession[]
  nextAction: string
}
export interface Pref { key: string; value: unknown }

export interface Snapshot {
  courses: Course[]; series: Series[]; events: CalEvent[]; lectures: LectureRecord[]
  notes: Note[]; sessions: Session[]; tasks: Task[]; exams: Exam[]; prefs: Pref[]
}
export type StoreName = keyof Snapshot
export const STORE_NAMES: StoreName[] = ['courses', 'series', 'events', 'lectures', 'notes', 'sessions', 'tasks', 'exams', 'prefs']
export const STORE_KEY: Record<StoreName, string> = {
  courses: 'id', series: 'id', events: 'id', lectures: 'id', notes: 'id', sessions: 'id', tasks: 'id', exams: 'id', prefs: 'key',
}
export const emptySnapshot = (): Snapshot => ({ courses: [], series: [], events: [], lectures: [], notes: [], sessions: [], tasks: [], exams: [], prefs: [] })
export type Changes = { [K in StoreName]?: { put?: Snapshot[K]; del?: string[] } }
