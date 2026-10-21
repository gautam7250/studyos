import { NextTaskCard, TasksPanel } from '../components/Tasks'
import { PageHeader } from '../components/ui'
export default function TasksPage() {
  return <><PageHeader title="Homework & Tasks" subtitle="Tasks are only ever completed when you tick them yourself." /><div className="mb-5"><NextTaskCard /></div><TasksPanel /></>
}
