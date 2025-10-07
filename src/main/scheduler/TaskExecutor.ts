import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import type { ScheduledTask, TaskExecution } from '../../shared/types/scheduler'
import { getLogger } from '../util'
import { TaskStorage } from './TaskStorage'
import { BrowserWindow } from 'electron'

const logger = getLogger('task-executor')

export class TaskExecutor extends EventEmitter {
  private storage: TaskStorage
  private runningExecutions = new Map<string, TaskExecution>()
  
  constructor() {
    super()
    this.storage = new TaskStorage()
  }
  
  async executeTask(task: ScheduledTask): Promise<TaskExecution> {
    const execution: TaskExecution = {
      id: uuidv4(),
      taskId: task.id,
      startTime: new Date(),
      status: 'running'
    }
    
    this.runningExecutions.set(execution.id, execution)
    await this.storage.saveExecution(execution)
    this.emit('execution-started', execution)
    
    logger.info(`Starting execution of task: ${task.name} (${task.id})`)
    
    try {
      // 新方案：直接通过IPC触发渲染进程创建会话并发送消息
      await this.triggerSessionBasedExecution(task, execution)
      
      execution.endTime = new Date()
      execution.status = 'completed'
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime()
      
      await this.storage.saveExecution(execution)
      this.emit('execution-completed', execution)
      
      logger.info(`Completed execution of task: ${task.name} in ${execution.duration}ms`)
      
    } catch (error) {
      execution.endTime = new Date()
      execution.status = 'failed'
      execution.error = error instanceof Error ? error.message : String(error)
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime()
      
      await this.storage.saveExecution(execution)
      this.emit('execution-failed', execution)
      
      logger.error(`Failed execution of task: ${task.name}`, error)
    } finally {
      this.runningExecutions.delete(execution.id)
    }
    
    return execution
  }
  
  private async triggerSessionBasedExecution(task: ScheduledTask, execution: TaskExecution): Promise<void> {
    // 准备会话创建数据
    const sessionCreationData = {
      taskId: task.id,
      taskName: task.name,
      executionId: execution.id,
      prompt: task.prompt,
      settings: {
        provider: task.aiProvider,
        modelId: task.model,
        mcpServers: task.mcpServers || []
      },
      executionTime: new Date().toISOString()
    }
    
    // 发送到渲染进程，让它创建会话并自动发送消息
    const allWindows = BrowserWindow.getAllWindows()
    
    for (const window of allWindows) {
      if (!window.isDestroyed()) {
        logger.info(`Triggering session-based execution for task: ${task.name}`)
        window.webContents.send('scheduler:execute-task-via-session', sessionCreationData)
      }
    }
    
    logger.info(`Task execution request sent to renderer process: ${task.name}`)
  }
  
  async shutdown() {
    // 取消所有正在运行的执行
    for (const execution of this.runningExecutions.values()) {
      execution.status = 'cancelled'
      execution.endTime = new Date()
      await this.storage.saveExecution(execution)
      this.emit('execution-cancelled', execution)
    }
    
    this.runningExecutions.clear()
    logger.info('Task executor shutdown')
  }
}