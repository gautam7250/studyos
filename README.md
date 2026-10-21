# StudyOS

A personal, local-first study planner: timetable, courses, lecture records, notes, homework, study timer,
running study-hour totals, exams and revision, analytics, and backup/restore. No account, backend or paid service.

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, React Router (hash routing), IndexedDB, Recharts, Vitest.

## Run locally (macOS)

Requires Node.js 20 or newer (`brew install node` if needed).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | Purpose |
| --- | --- |
| `npm test` | Run all automated tests |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Where your data lives (important)

All data is stored in your browser's IndexedDB, private to **one browser + one web address**.
`localhost:5173` and a GitHub Pages address are different origins and **do not share data**; neither do two devices.
Clearing site data or using a private window erases it. Use **Settings & Backup** regularly:

1. *Download full backup (JSON)* and keep the file outside the browser (iCloud Drive, external disk).
2. To move data between localhost and GitHub Pages or between devices: export on one side, then *Restore from a backup* on the other.
3. Import validates the file first, shows a preview, and offers *merge (keep mine)*, *merge (use backup)* or *replace*. Nothing is overwritten silently.
4. CSV export of study sessions, a CSV daily-hours report (Analytics page) and per-course notes as Markdown are also available.

Backups contain your private notes. They are git-ignored by default (`studyos-backup-*.json`); never commit them.
The code is public website code; your study data is private browser data. They are separate.

## How things are calculated

- **Dates** are local calendar dates (`YYYY-MM-DD`), never shifted by UTC.
- **Running totals** are computed on demand from individual sessions: sum per day, zero-fill empty days, then a running sum. Nothing cumulative is stored, so edits and deletions are always reflected.
- **Independent study** = study sessions. **Lecture time** = duration of lectures marked *attended*. They are always shown separately; analytics can optionally include lecture time.
- **Timer:** a running or paused timer is not study time. Time is only recorded when you press *Stop and save* and confirm the minutes. The timer survives a refresh and keeps counting while the tab is closed.
- **Attendance rate** = attended / (attended + missed). Cancelled and not-yet-recorded lectures do not count against you.
- **Revision progress** = topics ticked as revised / all topics. Confidence is shown separately. Exam dates are never invented.
- **Next task** is a suggestion (overdue, then priority, then deadline). Tasks are only completed when you tick them.

## Recurring lectures

A weekly series creates one stored event per week (id `series_date`), so regenerating can never duplicate. Editing one occurrence
detaches it from the series; editing the series skips detached occurrences. Deleting one occurrence adds it to the series skip list.
Occurrences that already have a lecture record are never removed by a series edit.

## Data model and migrations

IndexedDB database `studyos`, version 1; stores: `courses, series, events, lectures, notes, sessions, tasks, exams, prefs`.
Exam topics, practice questions, mock scores and revision sessions are embedded (with their own IDs) inside their exam.
Relationships use stable IDs, never names. To change the schema: bump `DB_VERSION` in `src/db.ts` and append one additive function to `MIGRATIONS`.
Backups carry `schemaVersion`; a backup from a newer version is refused.

## Project layout

```
src/lib/        pure logic with tests: dates, stats (running totals), tasks, exams, recurrence, timer, backup, cascade, demo
src/db.ts       IndexedDB layer, migrations, seed of the 8 example courses
src/store.tsx   React context: writes to IndexedDB first, then updates the screen
src/pages/      Dashboard, Timetable, Courses, CourseWorkspace, LecturePage, StudyLog, TasksPage, ExamsPage, Analytics, Settings, Search
src/components/ shared UI, forms, charts
```

## Sample data

*Settings → Load demo data* adds labelled sample lectures, sessions and tasks (no exam dates). *Remove demo data* deletes exactly those records.
The 8 starter courses are ordinary editable records; deleting them does not bring them back.

## Attached files

Each course (Files tab) and each lecture can hold any files (slides, PDFs, images, code), up to 50 MB each. They are stored in the browser's IndexedDB,
so they are private and offline, but they are **not** part of the JSON backup. Keep your originals. Deleting a course deletes its files.

## Deploying to GitHub Pages

The workflow `.github/workflows/deploy.yml` runs typecheck, tests and the build on every push to `main`, then publishes `dist/`.
The base path is set automatically from the repository name, and hash routing means refreshes work on a static host. Nothing is hard-coded.

### One-time setup

1. **Create a GitHub account / sign in** at https://github.com.
2. **Install the GitHub CLI** (easiest login) and sign in:
   ```bash
   brew install gh
   gh auth login        # choose GitHub.com, HTTPS, "Login with a web browser"
   ```
3. **Create the repository and push** (run inside the `studyos` folder; use any repository name):
   ```bash
   git init -b main
   git add .
   git commit -m "StudyOS"
   gh repo create studyos --public --source=. --push
   ```
   Free GitHub accounts need a **public** repository for Pages. This only publishes the app's code.
   Your study data never leaves your browser, and `.gitignore` already blocks backup and CSV files.
4. **Turn on Pages with Actions:** on GitHub open the repository, then **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. **Watch the deploy:** open the **Actions** tab. When "Deploy StudyOS to GitHub Pages" shows a green tick, the site is live.
   The address appears in the `deploy` job and under Settings → Pages. It normally looks like `https://<your-username>.github.io/<repository-name>/`.
   If the first run happened before you enabled Pages, open Actions and click **Re-run all jobs** (or push any small change).

### Moving your data to the live site

The live site and `localhost:5173` are different origins, so the live site starts empty.
On localhost go to **Settings & Backup → Download full backup**, open the live site, then **Restore from a backup** (choose merge or replace). Attached files must be re-uploaded.
Data does not sync between devices; repeat export/import whenever you want to move it.

### Updating the live site

```bash
git add . && git commit -m "Update" && git push
```

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank page or 404 for `assets/…` | The build ran without the base path. Use the workflow (not a manual upload) and keep `VITE_BASE` in it. |
| Workflow fails at "Setup Pages" | Pages is not set to *GitHub Actions* yet (step 4). |
| Workflow fails at `npm ci` | Commit `package-lock.json`; it must be in the repository. |
| Site works but is empty | Expected: browser data is per address. Restore a backup (above). |
