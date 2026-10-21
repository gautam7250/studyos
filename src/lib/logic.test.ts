import { describe, expect, it } from 'vitest'
import { generateEvents, reconcileSeries, findConflicts } from './recurrence'
import { elapsedMs, msToMinutes, pauseTimer, resumeTimer, startTimer } from './timer'
import { matchesView, nextTask } from './tasks'
import { examProgress, mockAverage, weakTopics } from './exams'
import { validateSession } from './validate'
import { event, exam, task } from '../test/factories'
import type { Series } from '../types'

const series: Series = { id: 'ser', courseId: 'c1', title: 'Logic', weekday: 1, start: '10:00', end: '12:00', room: 'A', instructor: 'X', type: 'lecture', startDate: '2026-03-02', endDate: '2026-03-23', skip: [] }

describe('recurring events', () => {
  it('generates one event per week', () => expect(generateEvents(series).map((e) => e.date)).toEqual(['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23']))
  it('moves a start date that is not on the weekday forward', () => expect(generateEvents({ ...series, startDate: '2026-03-03' })[0].date).toBe('2026-03-09'))
  it('reconciling twice creates no duplicates', () => {
    const first = reconcileSeries(series, [], new Set()); const second = reconcileSeries(series, first.put, new Set())
    expect(new Set([...first.put, ...second.put].map((e) => e.id)).size).toBe(4)
    expect(second.remove).toEqual([])
  })
  it('editing the series leaves individually edited (detached) occurrences alone', () => {
    const evs = generateEvents(series).map((e) => (e.date === '2026-03-09' ? { ...e, start: '14:00', end: '16:00', detached: true } : e))
    const r = reconcileSeries({ ...series, room: 'B' }, evs, new Set())
    expect(r.put.find((e) => e.date === '2026-03-09')).toBeUndefined()
    expect(r.put.filter((e) => e.room === 'B')).toHaveLength(3)
  })
  it('shortening a series removes empty future events but protects ones with records', () => {
    const evs = generateEvents(series)
    const r = reconcileSeries({ ...series, endDate: '2026-03-09' }, evs, new Set(['ser_2026-03-23']))
    expect(r.remove).toEqual(['ser_2026-03-16'])
  })
  it('skipped dates are not regenerated', () => expect(generateEvents({ ...series, skip: ['2026-03-09'] })).toHaveLength(3))
})
describe('conflicts', () => {
  const a = event({ id: 'a', start: '10:00', end: '12:00' })
  it('flags overlaps but not back-to-back or other days', () => {
    expect(findConflicts([a], { date: a.date, start: '11:00', end: '13:00' })).toHaveLength(1)
    expect(findConflicts([a], { date: a.date, start: '12:00', end: '13:00' })).toHaveLength(0)
    expect(findConflicts([a], { date: '2026-03-03', start: '10:00', end: '12:00' })).toHaveLength(0)
    expect(findConflicts([a], { id: 'a', date: a.date, start: '10:00', end: '12:00' })).toHaveLength(0)
  })
})
describe('timer', () => {
  const t0 = 1_000_000
  const base = startTimer({ id: 't', courseId: 'c', type: 'independent', topics: '' }, t0)
  it('counts running time', () => expect(elapsedMs(base, t0 + 90_000)).toBe(90_000))
  it('pause freezes and resume continues', () => {
    const p = pauseTimer(base, t0 + 60_000)
    expect(elapsedMs(p, t0 + 600_000)).toBe(60_000)
    expect(elapsedMs(resumeTimer(p, t0 + 700_000), t0 + 730_000)).toBe(90_000)
  })
  it('survives a reload: state is plain JSON and elapsed derives from timestamps', () => {
    const restored = JSON.parse(JSON.stringify(base))
    expect(msToMinutes(elapsedMs(restored, t0 + 25 * 60_000))).toBe(25)
  })
  it('resuming a running timer does not reset it', () => expect(resumeTimer(base, t0 + 5000)).toBe(base))
})
describe('session validation', () => {
  const ok = { courseId: 'c', date: '2026-03-02', minutes: 30 }
  it('accepts valid and rejects bad input', () => {
    expect(validateSession(ok)).toBeNull()
    expect(validateSession({ ...ok, minutes: 0 })).toMatch(/at least 1/)
    expect(validateSession({ ...ok, minutes: -5 })).toBeTruthy()
    expect(validateSession({ ...ok, minutes: 1.5 })).toBeTruthy()
    expect(validateSession({ ...ok, minutes: 2000 })).toMatch(/24 hours/)
    expect(validateSession({ ...ok, date: '2026-02-30' })).toMatch(/valid date/)
    expect(validateSession({ ...ok, startTime: '12:00', endTime: '11:00' })).toMatch(/End time/)
    expect(validateSession({ ...ok, courseId: '' })).toBeTruthy()
  })
})
describe('tasks', () => {
  const today = '2026-03-04' // Wednesday
  const t = { overdue: task({ due: '2026-03-02' }), today: task({ due: today }), week: task({ due: '2026-03-06' }), later: task({ due: '2026-03-20' }), none: task(), done: task({ due: today, status: 'done' }) }
  const ids = (v: Parameters<typeof matchesView>[1]) => Object.entries(t).filter(([, x]) => matchesView(x, v, today)).map(([k]) => k)
  it('filters views', () => {
    expect(ids('overdue')).toEqual(['overdue']); expect(ids('today')).toEqual(['today'])
    expect(ids('week')).toEqual(['overdue', 'today', 'week']); expect(ids('upcoming')).toEqual(['week', 'later'])
    expect(ids('completed')).toEqual(['done'])
  })
  it('suggests overdue first, then priority, and ignores completed tasks', () => {
    expect(nextTask([t.later, t.overdue, t.done], today)?.reason).toBe('Overdue')
    expect(nextTask([task({ id: 'lo', priority: 'low', due: '2026-03-05' }), task({ id: 'hi', priority: 'high', due: '2026-03-30' })], today)?.task.id).toBe('hi')
    expect(nextTask([t.done], today)).toBeNull()
  })
})
describe('exam progress', () => {
  const e = exam({ topics: [{ id: '1', title: 'a', done: true, confidence: 4 }, { id: '2', title: 'b', done: false, confidence: 2 }, { id: '3', title: 'c', done: false, confidence: 0 }], mocks: [{ id: 'm', date: '2026-03-01', score: 30, max: 50, notes: '' }] })
  it('derives progress from the checklist only', () => expect(examProgress(e)).toMatchObject({ total: 3, done: 1, pct: 33, avgConfidence: 3 }))
  it('flags weak topics and averages mocks', () => { expect(weakTopics(e).map((x) => x.id)).toEqual(['2']); expect(mockAverage(e)).toBeCloseTo(0.6) })
  it('handles an empty exam', () => expect(examProgress(exam())).toMatchObject({ total: 0, pct: 0, avgConfidence: null }))
})
