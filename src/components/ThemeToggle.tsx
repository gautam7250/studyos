import { useState } from 'react'

type Theme = 'light' | 'dark'

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme as Theme | undefined
  if (set) return set
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme)
  const next: Theme = theme === 'dark' ? 'light' : 'dark'

  function toggle() {
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('studyos-theme', next) } catch { /* storage unavailable: theme still applies for this session */ }
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border border-line px-3 py-1.5 text-sm text-soft hover:text-ink hover:bg-surface2"
    >
      Switch to {next} mode
    </button>
  )
}
