export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
export const nowIso = () => new Date().toISOString()
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
export const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
export const splitTags = (s: string) => [...new Set(s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))]
export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)
