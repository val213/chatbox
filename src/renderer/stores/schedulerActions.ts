import { getDefaultStore } from 'jotai'
import type { ScheduledTask, TaskExecution, TaskStats } from '../../shared/types/scheduler'
import * as atoms from './atoms/schedulerAtoms'
import platform from '../platform'
import { getLogger } from '@/lib/utils'

const logger = getLogger('scheduler-actions')
const store = getDefaultStore()

// 任务管理操作
export async function createTask(taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'successCount'>): Promise<ScheduledTask> {
  try {
    const task = await (platform as any).ipc.invoke('scheduler:create-task', taskData)
    
    // 更新本地状态
    store.set(atoms.scheduledTasksAtom, (tasks) => [...tasks, task])
    
    logger.info(`Created task: ${task.name}`)
    return task
  } catch (error) {
    logger.error('Failed to create task:', error)
    throw error
  }
}

export async function updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask> {
  try {
    const task = await (platform as any).ipc.invoke('scheduler:update-task', taskId, updates)
    
    // 更新本地状态
    store.set(atoms.scheduledTasksAtom, (tasks) => 
      tasks.map(t => t.id === taskId ? task : t)
    )
    
    logger.info(`Updated task: ${task.name}`)
    return task
  } catch (error) {
    logger.error('Failed to update task:', error)
    throw error
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  try {
    await (platform as any).ipc.invoke('scheduler:delete-task', taskId)
    
    // 更新本地状态
    store.set(atoms.scheduledTasksAtom, (tasks) => 
      tasks.filter(t => t.id !== taskId)
    )
    
    // 清理相关执行记录
    store.set(atoms.taskExecutionsAtom, (executions) =>
      executions.filter(e => e.taskId !== taskId)
    )
    
    logger.info(`Deleted task: ${taskId}`)
  } catch (error) {
    logger.error('Failed to delete task:', error)
    throw error
  }
}

export async function toggleTask(taskId: string): Promise<ScheduledTask> {
  try {
    const task = await (platform as any).ipc.invoke('scheduler:toggle-task', taskId)
    
    // 更新本地状态
    store.set(atoms.scheduledTasksAtom, (tasks) => 
      tasks.map(t => t.id === taskId ? task : t)
    )
    
    logger.info(`Toggled task: ${task.name} -> ${task.enabled ? 'enabled' : 'disabled'}`)
    return task
  } catch (error) {
    logger.error('Failed to toggle task:', error)
    throw error
  }
}

// 数据加载操作
export async function loadTasks(): Promise<void> {
  try {
    const tasks = await (platform as any).ipc.invoke('scheduler:get-tasks')
    store.set(atoms.scheduledTasksAtom, tasks)
    logger.info(`Loaded ${tasks.length} tasks`)
  } catch (error) {
    logger.error('Failed to load tasks:', error)
    throw error
  }
}

export async function loadExecutions(taskId?: string): Promise<void> {
  try {
    const executions = await (platform as any).ipc.invoke('scheduler:get-executions', taskId)
    
    if (taskId) {
      // 只更新特定任务的执行记录
      store.set(atoms.taskExecutionsAtom, (current) => {
        const filtered = current.filter(e => e.taskId !== taskId)
        return [...filtered, ...executions].sort((a, b) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )
      })
    } else {
      // 更新所有执行记录
      store.set(atoms.taskExecutionsAtom, executions)
    }
    
    logger.info(`Loaded ${executions.length} executions${taskId ? ` for task ${taskId}` : ''}`)
  } catch (error) {
    logger.error('Failed to load executions:', error)
    throw error
  }
}

export async function loadStats(): Promise<void> {
  try {
    const stats = await (platform as any).ipc.invoke('scheduler:get-stats')
    store.set(atoms.taskStatsAtom, stats)
    logger.info('Loaded task stats')
  } catch (error) {
    logger.error('Failed to load stats:', error)
    throw error
  }
}

// UI 操作
export function openTaskModal(mode: 'create' | 'edit', task?: ScheduledTask): void {
  store.set(atoms.taskModalAtom, {
    open: true,
    mode,
    task
  })
}

export function closeTaskModal(): void {
  store.set(atoms.taskModalAtom, {
    open: false,
    mode: 'create'
  })
}

export function selectTask(task: ScheduledTask | null): void {
  store.set(atoms.selectedTaskAtom, task)
}

export function showTaskMonitor(taskId?: string): void {
  store.set(atoms.taskMonitorAtom, {
    showMonitor: true,
    selectedTaskId: taskId
  })
}

export function hideTaskMonitor(): void {
  store.set(atoms.taskMonitorAtom, {
    showMonitor: false
  })
}

// 实时事件处理
export function initializeSchedulerEvents(): void {
  if (platform.type !== 'desktop') {
    return
  }
  
  // 监听任务事件
  if (platform.type === 'desktop' && (platform as any).ipc) {
    const ipc = (platform as any).ipc
    
    // 监听任务事件
    if (ipc.onSchedulerTaskCreated) {
      ipc.onSchedulerTaskCreated((task: ScheduledTask) => {
        store.set(atoms.scheduledTasksAtom, (tasks) => [...tasks, task])
      })
    }
    
    if (ipc.onSchedulerTaskUpdated) {
      ipc.onSchedulerTaskUpdated((task: ScheduledTask) => {
        store.set(atoms.scheduledTasksAtom, (tasks) => 
          tasks.map(t => t.id === task.id ? task : t)
        )
      })
    }
    
    if (ipc.onSchedulerTaskDeleted) {
      ipc.onSchedulerTaskDeleted((taskId: string) => {
        store.set(atoms.scheduledTasksAtom, (tasks) => 
          tasks.filter(t => t.id !== taskId)
        )
        store.set(atoms.taskExecutionsAtom, (executions) =>
          executions.filter(e => e.taskId !== taskId)
        )
      })
    }
    
    // 监听执行事件
    if (ipc.onSchedulerTaskStarted) {
      ipc.onSchedulerTaskStarted((execution: TaskExecution) => {
        store.set(atoms.taskExecutionsAtom, (executions) => 
          [execution, ...executions]
        )
      })
    }
    
    if (ipc.onSchedulerTaskCompleted) {
      ipc.onSchedulerTaskCompleted((execution: TaskExecution) => {
        store.set(atoms.taskExecutionsAtom, (executions) => 
          executions.map(e => e.id === execution.id ? execution : e)
        )
      })
    }
    
    if (ipc.onSchedulerTaskFailed) {
      ipc.onSchedulerTaskFailed((execution: TaskExecution) => {
        store.set(atoms.taskExecutionsAtom, (executions) => 
          executions.map(e => e.id === execution.id ? execution : e)
        )
      })
    }
  }
  
  logger.info('Scheduler events initialized')
}

// 清理函数
export function cleanupSchedulerEvents(): void {
  // TODO: 移除事件监听器
  logger.info('Scheduler events cleaned up')
}