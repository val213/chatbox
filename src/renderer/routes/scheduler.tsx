import { createFileRoute } from '@tanstack/react-router'
import { ScheduledTasksPage } from '../pages/ScheduledTasksPage'

export const Route = createFileRoute('/scheduler')({
  component: ScheduledTasksPage,
})