import { ipcMain } from 'electron'
import type { ScheduledTask, TaskExecution, TaskStats } from '../../shared/types/scheduler'
import { TaskScheduler } from './TaskScheduler'
import { getLogger } from '../util'

const logger = getLogger('scheduler-ipc')

let taskScheduler: TaskScheduler | null = null

export function initializeSchedulerIPC() {
  taskScheduler = new TaskScheduler()
  
  // 转发调度器事件到渲染进程
  taskScheduler.on('task-created', (task) => {
    broadcastToRenderers('scheduler:task-created', task)
  })
  
  taskScheduler.on('task-updated', (task) => {
    broadcastToRenderers('scheduler:task-updated', task)
  })
  
  taskScheduler.on('task-deleted', (taskId) => {
    broadcastToRenderers('scheduler:task-deleted', taskId)
  })
  
  taskScheduler.on('task-started', (execution) => {
    broadcastToRenderers('scheduler:task-started', execution)
  })
  
  taskScheduler.on('task-completed', (execution) => {
    broadcastToRenderers('scheduler:task-completed', execution)
  })
  
  taskScheduler.on('task-failed', (execution) => {
    broadcastToRenderers('scheduler:task-failed', execution)
  })
  
  // 初始化调度器
  taskScheduler.initialize().catch(error => {
    logger.error('Failed to initialize task scheduler:', error)
  })
  
  logger.info('Task scheduler IPC handlers initialized')
}

export function shutdownSchedulerIPC() {
  if (taskScheduler) {
    taskScheduler.shutdown()
    taskScheduler = null
  }
}

function broadcastToRenderers(channel: string, ...args: any[]) {
  // TODO: 获取所有渲染进程窗口并广播
  // 这里需要根据现有的窗口管理逻辑来实现
}

// IPC 处理器
ipcMain.handle('scheduler:create-task', async (event, taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'successCount'>) => {
  if (!taskScheduler) {
    throw new Error('Task scheduler not initialized')
  }
  
  try {
    const task = await taskScheduler.createTask(taskData)
    logger.info(`Created task via IPC: ${task.name}`)
    return task
  } catch (error) {
    logger.error('Failed to create task via IPC:', error)
    throw error
  }
})

ipcMain.handle('scheduler:update-task', async (event, taskId: string, updates: Partial<ScheduledTask>) => {
  if (!taskScheduler) {
    throw new Error('Task scheduler not initialized')
  }
  
  try {
    const task = await taskScheduler.updateTask(taskId, updates)
    logger.info(`Updated task via IPC: ${task.name}`)
    return task
  } catch (error) {
    logger.error('Failed to update task via IPC:', error)
    throw error
  }
})

ipcMain.handle('scheduler:delete-task', async (event, taskId: string) => {
  if (!taskScheduler) {
    throw new Error('Task scheduler not initialized')
  }
  
  try {
    await taskScheduler.deleteTask(taskId)
    logger.info(`Deleted task via IPC: ${taskId}`)
  } catch (error) {
    logger.error('Failed to delete task via IPC:', error)
    throw error
  }
})

ipcMain.handle('scheduler:toggle-task', async (event, taskId: string) => {
  if (!taskScheduler) {
    throw new Error('Task scheduler not initialized')
  }
  
  try {
    const task = await taskScheduler.toggleTask(taskId)
    logger.info(`Toggled task via IPC: ${task.name} -> ${task.enabled ? 'enabled' : 'disabled'}`)
    return task
  } catch (error) {
    logger.error('Failed to toggle task via IPC:', error)
    throw error
  }
})

ipcMain.handle('scheduler:get-tasks', async (event) => {
  if (!taskScheduler) {
    throw new Error('Task scheduler not initialized')
  }
  
  try {
    const tasks = taskScheduler.getTasks()
    return tasks
  } catch (error) {
    logger.error('Failed to get tasks via IPC:', error)
    throw error
  }
})

ipcMain.handle('scheduler:get-task', async (event, taskId: string) => {
  if (!taskScheduler) {
    throw new Error('Task scheduler not initialized')
  }
  
  try {
    const task = taskScheduler.getTask(taskId)
    return task || null
  } catch (error) {
    logger.error('Failed to get task via IPC:', error)
    throw error
  }
})

ipcMain.handle('scheduler:get-executions', async (event, taskId?: string) => {
  if (!taskScheduler) {
    throw new Error('Task scheduler not initialized')
  }
  
  try {
    const executions = await taskScheduler.getExecutions(taskId)
    return executions
  } catch (error) {
    logger.error('Failed to get executions via IPC:', error)
    throw error
  }
})

ipcMain.handle('scheduler:get-stats', async (event) => {
  if (!taskScheduler) {
    throw new Error('Task scheduler not initialized')
  }
  
  try {
    const tasks = taskScheduler.getTasks()
    const executions = await taskScheduler.getExecutions()
    
    const stats: TaskStats = {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.enabled).length,
      totalExecutions: executions.length,
      successRate: executions.length > 0 
        ? executions.filter(e => e.status === 'completed').length / executions.length 
        : 0,
      avgDuration: executions.length > 0
        ? executions
            .filter(e => e.duration)
            .reduce((sum, e) => sum + (e.duration || 0), 0) / executions.filter(e => e.duration).length
        : 0
    }
    
    return stats
  } catch (error) {
    logger.error('Failed to get stats via IPC:', error)
    throw error
  }
})