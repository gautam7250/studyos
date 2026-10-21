import { describe, expect, it } from 'vitest'
import { studyStreak, attendanceStats, cumulative, dailyRows, fillZero, lectureRows, mergeRows, monthlyTotals, weeklyTotals } from './stats'
import { localDateKey } from './dates'
import { event, session } from '../test/factories'
import type { LectureRecord } from '../types'

const mon = '2026-03-02', tue = '2026-03-03', wed = '2026-03-04'
const cum = (ss: ReturnType<typeof session>[]) => cumulative(fillZero(dailyRows(ss))).map((r) => r.cumulative / 60)

describe('running totals', () => {
  const base = [session({ date: mon, minutes: 120 }), session({ id: 'tue', date: tue, minutes: 90 }), session({ date: wed, minutes: 180 })]
  it('2h, 1.5h, 3h gives cumulative 2, 3.5, 6.5 (the brief says 6, but 2+1.5+3 = 6.5)', () => expect(cum(base)).toEqual([2, 3.5, 6.5]))
  it('recalculates when Tuesday becomes 2h: 2, 4, 7', () => expect(cum(base.map((s) => (s.id === 'tue' ? { ...s, minutes: 120 } : s)))).toEqual([2, 4, 7]))
  it('recalculates after a deletion; the empty Tuesday stays as a zero day', () => expect(cum(base.filter((s) => s.id !== 'tue'))).toEqual([2, 2, 5]))
  it('sums several sessions on one day exactly once', () => {
    const r = dailyRows([session({ date: mon, minutes: 30 }), session({ date: mon, minutes: 45 })])
    expect(r).toEqual([{ date: mon, minutes: 75 }])
  })
  it('orders chronologically regardless of input order', () => {
    expect(cumulative(dailyRows([session({ date: wed, minutes: 60 }), session({ date: mon, minutes: 60 })])).map((r) => r.date)).toEqual([mon, wed])
  })
  it('includes zero-hour days and carries the total across them', () => {
    const rows = fillZero(dailyRows([session({ date: mon, minutes: 60 }), session({ date: wed, minutes: 60 })]))
    expect(rows.map((r) => r.minutes)).toEqual([60, 0, 60])
    expect(cumulative(rows).map((r) => r.cumulative)).toEqual([60, 60, 120])
  })
  it('zero-fills an explicit range even with no sessions', () => expect(fillZero([], mon, wed)).toHaveLength(3))
  it('filters by course and date range', () => {
    const s = [session({ date: mon, courseId: 'a' }), session({ date: tue, courseId: 'b' }), session({ date: wed, courseId: 'a' })]
    expect(dailyRows(s, { courseId: 'a' })).toHaveLength(2)
    expect(dailyRows(s, { from: tue, to: tue })).toHaveLength(1)
  })
  it('weekly and monthly totals group correctly', () => {
    const rows = dailyRows([session({ date: '2026-03-01', minutes: 60 }), session({ date: mon, minutes: 60 }), session({ date: '2026-04-01', minutes: 30 })])
    expect(weeklyTotals(rows)).toEqual([{ date: '2026-02-23', minutes: 60 }, { date: mon, minutes: 60 }, { date: '2026-03-30', minutes: 30 }])
    expect(monthlyTotals(rows)).toEqual([{ date: '2026-03', minutes: 120 }, { date: '2026-04', minutes: 30 }])
  })
})

describe('local calendar dates', () => {
  it('uses the local day, not the UTC day (Berlin, summer)', () => {
    expect(localDateKey(new Date('2026-06-14T22:30:00Z'))).toBe('2026-06-15') // 00:30 local
    expect(localDateKey(new Date('2026-06-14T21:59:00Z'))).toBe('2026-06-14') // 23:59 local
  })
  it('handles the winter offset and year boundary', () => expect(localDateKey(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01'))
})

describe('lecture time vs independent study', () => {
  const e = event({ id: 'e-a', date: mon, start: '10:00', end: '11:30' })
  const rec = (attendance: LectureRecord['attendance'], extra: Partial<LectureRecord> = {}): LectureRecord => ({ id: e.id, eventId: e.id, courseId: 'c1', attendance, topics: '', concepts: '', examples: '', notes: '', questions: '', homework: '', summary: '', followUps: '', updatedAt: '', ...extra })
  it('counts only attended lectures, by actual attendance date', () => {
    expect(lectureRows([e], [rec('attended')])).toEqual([{ date: mon, minutes: 90 }])
    expect(lectureRows([e], [rec('attended', { attendedDate: tue })])).toEqual([{ date: tue, minutes: 90 }])
    expect(lectureRows([e], [rec('missed')])).toEqual([])
  })
  it('keeps independent study separate and merges only on request', () => {
    const study = dailyRows([session({ date: mon, minutes: 60 })])
    expect(study).toEqual([{ date: mon, minutes: 60 }])
    expect(mergeRows(study, lectureRows([e], [rec('attended')]))).toEqual([{ date: mon, minutes: 150 }])
  })
  it('attendance rate ignores cancelled and unrecorded, and future events', () => {
    const evs = [event({ id: 'a' }), event({ id: 'b' }), event({ id: 'c' }), event({ id: 'd' }), event({ id: 'f', date: '2026-12-01' })]
    const recs = [rec('attended', { id: 'a', eventId: 'a' }), rec('missed', { id: 'b', eventId: 'b' }), rec('cancelled', { id: 'c', eventId: 'c' })]
    expect(attendanceStats(evs, recs, '2026-03-10')).toMatchObject({ attended: 1, missed: 1, cancelled: 1, unrecorded: 1, rate: 0.5 })
  })
})

describe('study streak', () => {
  const rows = (...d: string[]) => d.map((date) => ({ date, minutes: 30 }))
  it('counts consecutive days ending today', () => expect(studyStreak(rows('2026-03-02', '2026-03-03', '2026-03-04'), '2026-03-04')).toBe(3))
  it('keeps the streak alive until the end of today', () => expect(studyStreak(rows('2026-03-02', '2026-03-03'), '2026-03-04')).toBe(2))
  it('breaks on a gap and ignores zero-minute days', () => { expect(studyStreak(rows('2026-03-01', '2026-03-03'), '2026-03-04')).toBe(1); expect(studyStreak([{ date: '2026-03-04', minutes: 0 }], '2026-03-04')).toBe(0) })
})
