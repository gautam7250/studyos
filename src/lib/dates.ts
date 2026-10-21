/** All dates are local-calendar keys "YYYY-MM-DD"; times are "HH:mm". No UTC conversion ever shifts a study day. */
export const pad = (n: number) => String(n).padStart(2, '0')
export const localDateKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayKey = () => localDateKey(new Date())
export const localTime = (d: Date = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export function parseKey(k: string): Date { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export function isValidKey(k: unknown): k is string {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false
  return localDateKey(parseKey(k)) === k
}
export function addDays(k: string, n: number): string { const d = parseKey(k); d.setDate(d.getDate() + n); return localDateKey(d) }
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 864e5)
}
export const weekday = (k: string) => parseKey(k).getDay() // 0 = Sunday
export function weekStart(k: string): string { const wd = (weekday(k) + 6) % 7; return addDays(k, -wd) } // Monday
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []; for (let d = from; d <= to && out.length < 4000; d = addDays(d, 1)) out.push(d); return out
}
export const timeToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const minToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
export const durationMin = (start: string, end: string) => timeToMin(end) - timeToMin(start)
export function monthWeeks(year: number, month0: number): string[][] {
  const first = localDateKey(new Date(year, month0, 1)); const last = localDateKey(new Date(year, month0 + 1, 0))
  const weeks: string[][] = []
  for (let s = weekStart(first); s <= last; s = addDays(s, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(s, i)))
  return weeks
}
export const daysUntil = (k: string, today = todayKey()) => diffDays(k, today)
export const fmtDate = (k?: string) => k ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(parseKey(k)) : '—'
export const fmtShort = (k: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parseKey(k))
export const fmtStamp = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
export const fmtHours = (min: number) => `${(min / 60).toFixed(1)} h`
