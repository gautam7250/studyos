import type { SessionType } from '../types'

/**
 * Timer rule: elapsed = accumulated + (now - resumedAt) while running. A running or paused timer is NOT study time.
 * Time only becomes a Session when you press Stop and confirm the (editable) minutes. That makes a forgotten timer harmless.
 */
export interface TimerState {
  id: string; courseId: string; type: SessionType; topics: string; lectureId?: string; taskId?: string
  startedAt: string; accumulatedMs: number; resumedAt: number | null
}
export const elapsedMs = (t: TimerState, now: number) => t.accumulatedMs + (t.resumedAt != null ? Math.max(0, now - t.resumedAt) : 0)
export const pauseTimer = (t: TimerState, now: number): TimerState => ({ ...t, accumulatedMs: elapsedMs(t, now), resumedAt: null })
export const resumeTimer = (t: TimerState, now: number): TimerState => (t.resumedAt != null ? t : { ...t, resumedAt: now })
export const startTimer = (init: Omit<TimerState, 'accumulatedMs' | 'resumedAt' | 'startedAt'>, now: number): TimerState =>
  ({ ...init, startedAt: new Date(now).toISOString(), accumulatedMs: 0, resumedAt: now })
export const msToMinutes = (ms: number) => Math.round(ms / 60000)
export const fmtClock = (ms: number) => { const s = Math.floor(ms / 1000); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':') }
