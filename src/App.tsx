import { Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { Empty } from './components/ui'
import Analytics from './pages/Analytics'
import CourseWorkspace from './pages/CourseWorkspace'
import Courses from './pages/Courses'
import Dashboard from './pages/Dashboard'
import ExamsPage from './pages/ExamsPage'
import LecturePage from './pages/LecturePage'
import Search from './pages/Search'
import Settings from './pages/Settings'
import StudyLog from './pages/StudyLog'
import TasksPage from './pages/TasksPage'
import Timetable from './pages/Timetable'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseWorkspace />} />
        <Route path="lecture/:id" element={<LecturePage />} />
        <Route path="study-log" element={<StudyLog />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="search" element={<Search />} />
        <Route path="*" element={<Empty title="Page not found" hint="Use the navigation to pick a section." />} />
      </Route>
    </Routes>
  )
}
