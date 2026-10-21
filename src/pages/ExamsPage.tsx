import { ExamsPanel } from '../components/Exams'
import { PageHeader } from '../components/ui'
export default function ExamsPage() {
  return <><PageHeader title="Exams & Revision" subtitle="Dates are only shown when you enter them. Progress counts topics you have ticked as revised." /><ExamsPanel /></>
}
