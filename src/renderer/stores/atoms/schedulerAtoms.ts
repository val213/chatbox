import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { ScheduledTask, TaskExecution, TaskStats } from '../../../shared/types/scheduler'

// 任务列表原子
export const scheduledTasksAtom = atom<ScheduledTask[]>([])

// 任务执行历史原子
export const taskExecutionsAtom = atom<TaskExecution[]>([])

// 任务统计原子
export const taskStatsAtom = atom<TaskStats>({
  totalTasks: 0,
  activeTasks: 0,
  totalExecutions: 0,
  successRate: 0,
  avgDuration: 0
})

// 选中的任务原子
export const selectedTaskAtom = atom<ScheduledTask | null>(null)

// 任务创建/编辑模态框状态
export const taskModalAtom = atom<{
  open: boolean
  mode: 'create' | 'edit'
  task?: ScheduledTask
}>({
  open: false,
  mode: 'create'
})

// 任务执行监控状态
export const taskMonitorAtom = atom<{
  showMonitor: boolean
  selectedTaskId?: string
}>({
  showMonitor: false
})

// 派生原子：活跃任务
export const activeTasksAtom = atom((get) => {
  const tasks = get(scheduledTasksAtom)
  return tasks.filter(task => task.enabled)
})

// 派生原子：最近执行
export const recentExecutionsAtom = atom((get) => {
  const executions = get(taskExecutionsAtom)
  return executions.slice(0, 10) // 最近10次执行
})

// 派生原子：任务状态映射
export const taskStatusMapAtom = atom((get) => {
  const executions = get(taskExecutionsAtom)
  const statusMap = new Map<string, 'idle' | 'running' | 'success' | 'failed'>()
  
  // 为每个任务找到最近的执行状态
  const taskLatestExecution = new Map<string, TaskExecution>()
  
  for (const execution of executions) {
    const current = taskLatestExecution.get(execution.taskId)
    if (!current || execution.startTime > current.startTime) {
      taskLatestExecution.set(execution.taskId, execution)
    }
  }
  
  for (const [taskId, execution] of taskLatestExecution) {
    switch (execution.status) {
      case 'running':
        statusMap.set(taskId, 'running')
        break
      case 'completed':
        statusMap.set(taskId, 'success')
        break
      case 'failed':
        statusMap.set(taskId, 'failed')
        break
      default:
        statusMap.set(taskId, 'idle')
    }
  }
  
  return statusMap
})