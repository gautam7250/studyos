import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '../lib/util'
import type { Course } from '../types'
import { useData } from '../store'

export const inputCls = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-soft'
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'default' | 'danger' | 'ghost' }
export function Button({ variant = 'default', className, type = 'button', ...p }: BtnProps) {
  const v = { primary: 'bg-accent text-accent-ink border-accent hover:opacity-90', default: 'border-line bg-surface hover:bg-surface2', danger: 'border-danger text-danger hover:bg-surface2', ghost: 'border-transparent text-soft hover:bg-surface2 hover:text-ink' }[variant]
  return <button type={type} {...p} className={cx('rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50', v, className)} />
}
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={cx('block text-sm', className)}><span className="mb-1 block font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-soft">{hint}</span>}</label>
}
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; ref.current?.focus()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k); return () => { window.removeEventListener('keydown', k); prev?.focus?.() }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cx('w-full rounded-lg border border-line bg-bg p-5 shadow-xl outline-none', wide ? 'max-w-3xl' : 'max-w-xl')}>
        <div className="mb-4 flex items-start justify-between gap-4"><h2 className="font-display text-xl">{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Close dialog">Close</Button></div>
        {children}
      </div>
    </div>
  )
}
export function Confirm({ title, children, confirmLabel, onConfirm, onCancel, danger = true }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="text-sm text-soft">{children}</div>
      <div className="mt-5 flex justify-end gap-2"><Button onClick={onCancel}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button></div>
    </Modal>
  )
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line bg-surface p-6 text-center"><p className="font-medium">{title}</p>{hint && <p className="mx-auto mt-1 max-w-md text-sm text-soft">{hint}</p>}{action && <div className="mt-3">{action}</div>}</div>
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-3xl tracking-tight">{title}</h1>{subtitle && <p className="mt-1 max-w-prose text-sm text-soft">{subtitle}</p>}</div><div className="flex flex-wrap gap-2">{actions}</div></div>
}
export const Card = ({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) => (
  <section className={cx('rounded-lg border border-line bg-surface p-4', className)}>{(title || action) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-display text-lg">{title}</h2>{action}</div>}{children}</section>
)
export const Dot = ({ color }: { color: string }) => <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
export function CourseTag({ course }: { course?: Course }) {
  return <span className="inline-flex items-center gap-1.5 text-sm"><Dot color={course?.color ?? '#999'} />{course ? course.name : <em className="text-soft">Deleted course</em>}</span>
}
export function Progress({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value))
  return <div role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-surface2"><div className="h-full bg-accent" style={{ width: `${v}%` }} /></div>
}
export const Stat = ({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) => (
  <div className="rounded-lg border border-line bg-surface p-4"><div className="text-sm text-soft">{label}</div><div className="mt-1 font-display text-3xl">{value}</div>{sub && <div className="mt-0.5 text-xs text-soft">{sub}</div>}</div>
)
export function CourseSelect({ value, onChange, includeAll, label = 'Course', id }: { value: string; onChange: (v: string) => void; includeAll?: string; label?: string; id?: string }) {
  const { data } = useData()
  const list = data.courses.filter((c) => !c.archived || c.id === value).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <select id={id} aria-label={label} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll !== undefined && <option value="">{includeAll}</option>}
      {!includeAll && !value && <option value="">Choose a course…</option>}
      {list.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (archived)' : ''}</option>)}
    </select>
  )
}
export function ErrorBanner() {
  const { error, clearError } = useData()
  if (!error) return null
  return <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-danger bg-surface px-4 py-2 text-sm text-danger">{error}<Button variant="ghost" onClick={clearError}>Dismiss</Button></div>
}
