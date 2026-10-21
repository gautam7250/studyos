import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface Series { key: string; name: string; color: string }
const tick = { fontSize: 11, fill: 'var(--ink-soft)' }
/** Thin wrapper around Recharts so every chart shares axes, units and accessibility labelling. */
export default function Chart({ kind, data, xKey = 'label', series, unit = 'h', stacked, label, height = 240 }: { kind: 'bar' | 'line'; data: Record<string, string | number>[]; xKey?: string; series: Series[]; unit?: string; stacked?: boolean; label: string; height?: number }) {
  const common = { data, margin: { top: 8, right: 12, bottom: 0, left: -8 } }
  const axes = <>
    <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
    <XAxis dataKey={xKey} tick={tick} minTickGap={16} /><YAxis tick={tick} unit={` ${unit}`} width={52} allowDecimals />
    <Tooltip formatter={(v) => `${Number(v).toFixed(2)} ${unit}`} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--ink)' }} />
    {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
  </>
  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {kind === 'bar'
          ? <BarChart {...common}>{axes}{series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined} isAnimationActive={false} />)}</BarChart>
          : <LineChart {...common}>{axes}{series.map((s) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={2} type="monotone" isAnimationActive={false} />)}</LineChart>}
      </ResponsiveContainer>
    </div>
  )
}
export const hoursRows = (rows: { date: string; minutes: number; cumulative?: number }[]) => rows.map((r) => ({ label: r.date.slice(5), daily: +(r.minutes / 60).toFixed(2), cumulative: +((r.cumulative ?? 0) / 60).toFixed(2) }))
