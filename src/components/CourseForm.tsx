import { useState } from 'react'
import { newCourse } from '../db'
import { lines, nowIso } from '../lib/util'
import { useData } from '../store'
import type { Course } from '../types'
import { Button, Field, Modal, inputCls } from './ui'

export default function CourseForm({ course, onClose, onSaved }: { course?: Course; onClose: () => void; onSaved?: (c: Course) => void }) {
  const { put } = useData()
  const [f, setF] = useState({ name: course?.name ?? '', code: course?.code ?? '', semester: course?.semester ?? 'WS 2026/27', instructor: course?.instructor ?? '', room: course?.room ?? '', color: course?.color ?? '#0f5c5c', description: course?.description ?? '', syllabus: (course?.syllabus ?? []).join('\n'), target: String(course?.targetHoursPerWeek ?? 4), notes: course?.notes ?? '' })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  async function save() {
    const target = Number(f.target)
    if (!f.name.trim()) return setErr('Enter a course name.')
    if (!Number.isFinite(target) || target < 0 || target > 100) return setErr('The weekly study target must be between 0 and 100 hours.')
    const base = { name: f.name.trim(), code: f.code.trim(), semester: f.semester.trim(), instructor: f.instructor.trim(), room: f.room.trim(), color: f.color, description: f.description, syllabus: lines(f.syllabus), targetHoursPerWeek: target, notes: f.notes }
    const rec: Course = course ? { ...course, ...base, updatedAt: nowIso() } : newCourse(base)
    if (await put('courses', rec)) { onSaved?.(rec); onClose() }
  }
  return (
    <Modal title={course ? 'Edit course' : 'Add course'} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Course name" className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Short code"><input className={inputCls} value={f.code} onChange={set('code')} /></Field>
        <Field label="Semester"><input className={inputCls} value={f.semester} onChange={set('semester')} /></Field>
        <Field label="Instructor"><input className={inputCls} value={f.instructor} onChange={set('instructor')} /></Field>
        <Field label="Room"><input className={inputCls} value={f.room} onChange={set('room')} /></Field>
        <Field label="Colour"><input type="color" className="h-9 w-full rounded-md border border-line bg-surface" value={f.color} onChange={set('color')} /></Field>
        <Field label="Study target (hours per week)"><input type="number" min={0} max={100} step={0.5} className={inputCls} value={f.target} onChange={set('target')} /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea rows={2} className={inputCls} value={f.description} onChange={set('description')} /></Field>
        <Field label="Syllabus / topic list" hint="One topic per line. You can turn these into exam topics later." className="sm:col-span-2"><textarea rows={4} className={inputCls} value={f.syllabus} onChange={set('syllabus')} /></Field>
        <Field label="Course notes" className="sm:col-span-2"><textarea rows={3} className={inputCls} value={f.notes} onChange={set('notes')} /></Field>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{course ? 'Save changes' : 'Add course'}</Button></div>
    </Modal>
  )
}
