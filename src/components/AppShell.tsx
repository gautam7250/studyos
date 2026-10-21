import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { NAV_ITEMS } from '../nav'
import ThemeToggle from './ThemeToggle'
import { ErrorBanner } from './ui'

function Brand() {
  return (
    <div className="px-5 py-5">
      <div className="font-display text-2xl tracking-tight text-ink">StudyOS</div>
      <div className="text-xs text-soft">Philosophy &amp; Computer Science, MA</div>
    </div>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            'rounded-md px-3 py-2 text-sm transition-colors ' +
            (isActive
              ? 'bg-accent-soft font-medium text-accent border-l-2 border-accent'
              : 'text-soft hover:bg-surface2 hover:text-ink border-l-2 border-transparent')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function AppShell() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation(); const nav = useNavigate(); const [q, setQ] = useState('')

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <Brand />
        <NavList />
        <div className="mt-auto p-4"><ThemeToggle /></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <span className="font-display text-xl">StudyOS</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md border border-line px-3 py-1.5 text-sm"
          >
            {open ? 'Close menu' : 'Menu'}
          </button>
        </header>

        {open && (
          <div id="mobile-nav" className="fixed inset-x-0 top-[3.25rem] bottom-0 z-10 overflow-y-auto bg-surface pb-6 md:hidden">
            <NavList onNavigate={() => setOpen(false)} />
            <div className="p-4"><ThemeToggle /></div>
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-10 md:py-10">
          <form role="search" className="mb-6" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`) }}>
            <input aria-label="Search everything" type="search" placeholder="Search courses, notes, lectures, tasks…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full max-w-md rounded-md border border-line bg-surface px-3 py-2 text-sm" />
          </form>
          <ErrorBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
