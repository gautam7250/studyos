import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from './test/render'
import { NAV_ITEMS } from './nav'
import { addDays, todayKey } from './lib/dates'

const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })
const dialog = () => screen.getByRole('dialog')

describe('shell', () => {
  it('shows all 8 sections and each route renders', async () => {
    const { unmount } = renderApp('/'); await h1('Dashboard')
    expect(screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('a')).toHaveLength(8)
    unmount()
    for (const n of NAV_ITEMS.slice(1)) { const r = renderApp(n.path); await h1(n.label); r.unmount() }
  })
  it('mobile menu opens and closes with Escape', async () => {
    const { u } = renderApp('/'); await h1('Dashboard')
    await u.click(screen.getByRole('button', { name: 'Menu' })); expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true')
    await u.keyboard('{Escape}'); expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('dashboard shows no invented numbers on an empty database', async () => {
    renderApp('/'); await h1('Dashboard')
    expect(await screen.findByText('Nothing recorded yet')).toBeInTheDocument()
    expect(screen.getByText('Lectures today').nextSibling).toHaveTextContent('0'); expect(screen.getByText('Attendance rate').nextSibling).toHaveTextContent('—')
  })
})

describe('courses', () => {
  it('starts with the 8 editable example courses; create, edit, archive, restore, delete with a confirmation', async () => {
    const { u } = renderApp('/courses'); await h1('Courses')
    expect(await screen.findByRole('link', { name: 'Reinforcement Learning for Science' })).toBeInTheDocument()
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/courses/'))).toHaveLength(8)
    await u.click(screen.getByRole('button', { name: 'Add course' }))
    await u.type(within(dialog()).getByLabelText('Course name'), 'Philosophy of Mind'); await u.click(within(dialog()).getByRole('button', { name: 'Add course' }))
    const card = () => screen.getByRole('link', { name: /Philosophy of Mind/ }).closest('section')!
    await screen.findByRole('link', { name: 'Philosophy of Mind' })
    await u.click(within(card()).getByRole('button', { name: 'Edit' })); const name = within(dialog()).getByLabelText('Course name')
    await u.clear(name); await u.type(name, 'Philosophy of Mind II'); await u.click(within(dialog()).getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('link', { name: 'Philosophy of Mind II' })
    await u.click(within(card()).getByRole('button', { name: 'Archive' })); await waitFor(() => expect(screen.queryByRole('link', { name: 'Philosophy of Mind II' })).toBeNull())
    await u.click(screen.getByLabelText('Show archived')); await u.click(within(card()).getByRole('button', { name: 'Restore' }))
    await u.click(screen.getByLabelText('Show archived')); await screen.findByRole('link', { name: 'Philosophy of Mind II' })
    await u.click(within(card()).getByRole('button', { name: 'Delete…' }))
    expect(within(dialog()).getByText(/everything attached to it/)).toBeInTheDocument()
    await u.click(within(dialog()).getByRole('button', { name: 'Delete course and its data' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Philosophy of Mind II' })).toBeNull())
  })
  it('validates the course name', async () => {
    const { u } = renderApp('/courses'); await h1('Courses'); await u.click(screen.getByRole('button', { name: 'Add course' }))
    await u.click(within(dialog()).getByRole('button', { name: 'Add course' })); expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Enter a course name')
  })
})

describe('timetable, lectures and notes', () => {
  async function createWeeklyLecture() {
    const ctx = renderApp('/timetable'); const { u } = ctx; await h1('Timetable')
    await u.click(await screen.findByRole('button', { name: 'New event' })); const d = dialog()
    await u.selectOptions(within(d).getByLabelText('Course'), 'Ethics (MA)')
    const date = within(d).getByLabelText('Date'); await u.clear(date); await u.type(date, todayKey())
    await u.click(within(d).getByLabelText('Repeat weekly')); await u.click(within(d).getByRole('button', { name: 'Add event' }))
    return ctx
  }
  it('creates a recurring lecture, marks attendance, saves a lecture record and a note, and keeps them after a reload', async () => {
    const { u, db, unmount } = await createWeeklyLecture()
    const link = await screen.findByRole('link', { name: /Ethics \(MA\)/ }); await u.click(link)
    await h1('Ethics (MA)'); await u.click(screen.getByRole('button', { name: 'Attended' }))
    await u.type(screen.getByLabelText('Topics covered'), 'Kantian deontology'); await u.type(screen.getByLabelText('Questions for the professor'), 'What about lying to a murderer?')
    await u.click(screen.getByRole('button', { name: 'Save lecture record' })); await screen.findByText(/^Saved /)
    await u.click(screen.getByRole('button', { name: 'New note' })); await u.type(within(dialog()).getByLabelText('Title'), 'Categorical imperative'); await u.type(within(dialog()).getByLabelText(/^Note/), 'Act only on that maxim…'); await u.click(within(dialog()).getByRole('button', { name: 'Save note' }))
    await screen.findByText('Categorical imperative'); unmount()
    renderApp('/timetable', db); await h1('Timetable')
    await u.click(await screen.findByRole('link', { name: /Ethics \(MA\)/ })); await h1('Ethics (MA)')
    expect(screen.getByRole('button', { name: 'Attended' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Topics covered')).toHaveValue('Kantian deontology'); expect(screen.getByText('Categorical imperative')).toBeInTheDocument()
  })
  it('warns about overlapping events but still allows saving', async () => {
    const { u } = await createWeeklyLecture(); await screen.findByRole('link', { name: /Ethics \(MA\)/ })
    await u.click(screen.getByRole('button', { name: 'New event' })); const d = dialog()
    await u.selectOptions(within(d).getByLabelText('Course'), 'Mathematical Foundations'); const date = within(d).getByLabelText('Date'); await u.clear(date); await u.type(date, todayKey())
    expect(await within(d).findByRole('status')).toHaveTextContent(/Time conflict/)
    await u.click(within(d).getByRole('button', { name: 'Add event' })); await waitFor(() => expect(screen.getAllByRole('link', { name: /(Ethics|Mathematical)/ })).toHaveLength(2))
  })
  it('editing one occurrence of a series does not change the others', async () => {
    const { u } = await createWeeklyLecture(); await u.click(await screen.findByRole('link', { name: /Ethics \(MA\)/ })); await h1('Ethics (MA)')
    await u.click(screen.getByRole('button', { name: 'Edit or move' })); const d = dialog()
    await u.type(within(d).getByLabelText('Room'), 'Room X'); await u.click(within(d).getByRole('button', { name: 'Save changes' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await u.click(screen.getByRole('link', { name: 'Open course' })); await u.click(await screen.findByRole('tab', { name: 'Lecture history' }))
    await u.click(await screen.findByLabelText('Include upcoming lectures'))
    expect((await screen.findAllByRole('link', { name: /· 10:00–12:00/ })).length).toBeGreaterThan(5)
  })
})

describe('tasks', () => {
  it('creates a task, never completes it silently, completes it on click, and shows it under Completed', async () => {
    const { u } = renderApp('/tasks'); await h1('Homework & Tasks')
    await u.click((await screen.findAllByRole('button', { name: 'New task' }))[0]); const d = dialog()
    await u.type(within(d).getByLabelText('Title'), 'Exercise sheet 3'); const due = within(d).getByLabelText('Due date'); await u.type(due, addDays(todayKey(), -1))
    await u.click(within(d).getByRole('button', { name: 'Add task' }))
    const box = await screen.findAllByRole('checkbox', { name: 'Mark complete: Exercise sheet 3' }); expect(box[0]).not.toBeChecked()
    expect(screen.getAllByText(/Overdue/).length).toBeGreaterThan(0); expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0)
    await u.click(box[0]); await u.click(screen.getByRole('button', { name: 'Completed' }))
    expect(await screen.findByRole('checkbox', { name: 'Reopen: Exercise sheet 3' })).toBeChecked()
  })
})

describe('study log', () => {
  it('logs, edits and deletes a session; rejects invalid durations', async () => {
    const { u } = renderApp('/study-log'); await h1('Study Log')
    await u.click(await screen.findByRole('button', { name: 'Log session' })); let d = dialog()
    await u.selectOptions(within(d).getByLabelText('Course'), 'Ethics (MA)'); const m = within(d).getByLabelText(/Duration/); await u.clear(m); await u.type(m, '0')
    await u.click(within(d).getByRole('button', { name: 'Save session' })); expect(await within(d).findByRole('alert')).toHaveTextContent('at least 1 minute')
    await u.clear(m); await u.type(m, '90'); await u.click(within(d).getByRole('button', { name: 'Save session' }))
    expect(await screen.findByText('90 min')).toBeInTheDocument(); expect(screen.getAllByText('1.5 h').length).toBeGreaterThan(0)
    await u.click(screen.getByRole('button', { name: /Edit session on/ })); d = dialog(); const m2 = within(d).getByLabelText(/Duration/); await u.clear(m2); await u.type(m2, '120'); await u.click(within(d).getByRole('button', { name: 'Save session' }))
    expect(await screen.findByText('120 min')).toBeInTheDocument(); expect(screen.getAllByText('2.0 h').length).toBeGreaterThan(0)
    await u.click(screen.getByRole('button', { name: /Delete session on/ })); await u.click(within(dialog()).getByRole('button', { name: 'Delete session' }))
    await waitFor(() => expect(screen.queryByText('120 min')).toBeNull()); expect(screen.getByText('No study sessions yet')).toBeInTheDocument()
  })
  it('warns before saving an identical duplicate session', async () => {
    const { u } = renderApp('/study-log'); await h1('Study Log')
    for (let i = 0; i < 2; i++) { await u.click(await screen.findByRole('button', { name: 'Log session' })); const d = dialog(); await u.selectOptions(within(d).getByLabelText('Course'), 'Ethics (MA)'); await u.click(within(d).getByRole('button', { name: 'Save session' })); if (i === 0) await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()) }
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(/identical session/); expect(within(dialog()).getByRole('button', { name: 'Save anyway' })).toBeInTheDocument()
  })
  it('timer: start, pause, recover after a reload, stop and save once', async () => {
    const { u, db, unmount } = renderApp('/study-log'); await h1('Study Log')
    await u.selectOptions(await screen.findByLabelText('Course', { selector: 'select' }), 'Logic and Argumentation Theory'); await u.click(screen.getByRole('button', { name: 'Start timer' }))
    await screen.findByRole('timer'); await u.click(screen.getByRole('button', { name: 'Pause' })); await screen.findByText(/Paused/); unmount()
    const again = renderApp('/study-log', db); await h1('Study Log'); await screen.findByRole('timer'); expect(screen.getByText(/Paused/)).toBeInTheDocument()
    await again.u.click(screen.getByRole('button', { name: 'Stop and save…' })); const d = dialog(); const m = within(d).getByLabelText(/Duration/); await again.u.clear(m); await again.u.type(m, '25')
    await again.u.click(within(d).getByRole('button', { name: 'Save session' })); await waitFor(() => expect(screen.queryByRole('timer')).toBeNull())
    expect(await screen.findByText('25 min')).toBeInTheDocument(); expect(screen.getAllByText('25 min')).toHaveLength(1)
  })
})

describe('exams', () => {
  it('creates an exam without inventing a date, and derives progress from ticked topics', async () => {
    const { u } = renderApp('/exams'); await h1('Exams & Revision')
    await u.click((await screen.findAllByRole('button', { name: 'New exam' }))[0]); const d = dialog()
    await u.selectOptions(within(d).getByLabelText('Course'), 'Ethics (MA)'); await u.type(within(d).getByLabelText('Title'), 'Final exam'); await u.click(within(d).getByRole('button', { name: 'Create exam' }))
    await screen.findByText('Final exam'); expect(screen.getByText(/Date not announced yet/)).toBeInTheDocument(); expect(screen.queryByLabelText('Countdown')).toBeNull()
    for (const t of ['Utilitarianism', 'Virtue ethics']) { await u.type(screen.getByLabelText('New topic'), t); await u.click(screen.getByRole('button', { name: 'Add topic' })) }
    expect(await screen.findByText(/0 of 2 topics revised \(0%\)/)).toBeInTheDocument()
    await u.click(screen.getByLabelText('Revised: Utilitarianism')); expect(await screen.findByText(/1 of 2 topics revised \(50%\)/)).toBeInTheDocument()
    await u.selectOptions(screen.getByLabelText('Confidence for Virtue ethics'), '2'); expect(await screen.findByText(/Virtue ethics \(confidence 2\/5\)/)).toBeInTheDocument()
  })
})

describe('settings, backup and demo data', () => {
  it('loads demo data into the dashboard, then removes it again', async () => {
    const { u } = renderApp('/settings'); await h1('Settings & Backup')
    await u.click(await screen.findByRole('button', { name: 'Load demo data' })); await screen.findByText('Demo data loaded.')
    await u.click(screen.getByRole('button', { name: 'Remove demo data' })); await screen.findByText('Demo data removed.')
    expect(screen.getByRole('button', { name: 'Load demo data' })).toBeEnabled()
  })
  it('rejects an invalid file without changing data, then restores a valid backup', async () => {
    const { u } = renderApp('/settings'); await h1('Settings & Backup'); const input = await screen.findByLabelText(/Choose a StudyOS backup file/)
    await u.upload(input, new File(['{"app":"nope"}'], 'bad.json', { type: 'application/json' })); expect(await screen.findByText(/cannot be imported/)).toBeInTheDocument(); expect(screen.getByText(/not a StudyOS backup/)).toBeInTheDocument()
    const good = { app: 'studyos', schemaVersion: 1, exportedAt: '2026-01-01T00:00:00Z', data: { courses: [{ id: 'c-x', name: 'Restored Course', archived: false }], notes: [{ id: 'n-x', courseId: 'c-x', title: 'Restored note', body: 'b', tags: [], pinned: false, createdAt: '', updatedAt: '' }] } }
    await u.upload(input, new File([JSON.stringify(good)], 'good.json', { type: 'application/json' })); expect(await screen.findByText(/Preview of good.json/)).toBeInTheDocument()
    await u.click(screen.getByLabelText(/Replace everything/)); await u.click(screen.getByRole('button', { name: 'Import' })); expect(within(dialog()).getByText(/cannot be undone/)).toBeInTheDocument()
    await u.click(within(dialog()).getByRole('button', { name: 'Replace everything' })); expect(await screen.findByText(/Backup restored/)).toBeInTheDocument()
  })
})

describe('dashboard is calculated from records', () => {
  it('with demo data the metrics become non-zero, and they disappear again when the demo data is removed', async () => {
    const { u, db, unmount } = renderApp('/settings'); await h1('Settings & Backup')
    await u.click(await screen.findByRole('button', { name: 'Load demo data' })); await screen.findByText('Demo data loaded.'); unmount()
    const dash = renderApp('/', db); await h1('Dashboard')
    await waitFor(() => expect(screen.getByText('Pending / overdue tasks').nextSibling).toHaveTextContent('3 / 1'))
    expect(screen.queryByText('Nothing recorded yet')).toBeNull(); expect(screen.getByText('Attendance rate').nextSibling).not.toHaveTextContent('—')
    dash.unmount()
    const s = renderApp('/settings', db); await h1('Settings & Backup'); await s.u.click(await screen.findByRole('button', { name: 'Remove demo data' })); await screen.findByText('Demo data removed.'); s.unmount()
    renderApp('/', db); await h1('Dashboard'); expect(await screen.findByText('Nothing recorded yet')).toBeInTheDocument()
  })
})

describe('file uploads', () => {
  it('uploads files to a course, lists them, keeps them after a reload, and deletes with confirmation', async () => {
    const { u, db, unmount } = renderApp('/courses', 'files-' + Math.random()); await h1('Courses')
    await u.click(await screen.findByRole('link', { name: 'Ethics (MA)' })); await u.click(await screen.findByRole('tab', { name: 'Files' }))
    await u.upload(screen.getByLabelText('Upload files'), [new File(['hello'], 'slides-week1.pdf', { type: 'application/pdf' }), new File(['x = 1'], 'notes.py', { type: 'text/x-python' })])
    expect(await screen.findByText('slides-week1.pdf')).toBeInTheDocument(); expect(screen.getByText('notes.py')).toBeInTheDocument(); unmount()
    const again = renderApp('/courses', db); await h1('Courses'); await again.u.click(await screen.findByRole('link', { name: 'Ethics (MA)' })); await again.u.click(await screen.findByRole('tab', { name: 'Files' }))
    expect(await screen.findByText('slides-week1.pdf')).toBeInTheDocument()
    await again.u.click(screen.getByRole('button', { name: 'Delete notes.py' })); await again.u.click(within(dialog()).getByRole('button', { name: 'Delete file' }))
    await waitFor(() => expect(screen.queryByText('notes.py')).toBeNull()); expect(screen.getByText('slides-week1.pdf')).toBeInTheDocument()
  })
})
