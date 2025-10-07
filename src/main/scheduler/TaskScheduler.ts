import { EventEmitter } from 'events'
import { CronJob } from 'cron'
import { v4 as uuidv4 } from 'uuid'
import type { ScheduledTask, TaskExecution, TaskSchedule } from '../../shared/types/scheduler'
import type { Message } from '../../shared/types'
import { getLogger } from '../util'
import { TaskExecutor } from './TaskExecutor'
import { TaskStorage } from './TaskStorage'

const logger = getLogger('scheduler')

export class TaskScheduler extends EventEmitter {
  private tasks = new Map<string, ScheduledTask>()
  private jobs = new Map<string, CronJob>()
  private intervals = new Map<string, NodeJS.Timeout>()
  private timeouts = new Map<string, NodeJS.Timeout>()
  
  private executor: TaskExecutor
  private storage: TaskStorage
  
  constructor() {
    super()
    this.executor = new TaskExecutor()
    this.storage = new TaskStorage()
    
    // 监听执行器事件
    this.executor.on('execution-started', (execution: TaskExecution) => {
      this.emit('task-started', execution)
    })
    
    this.executor.on('execution-completed', (execution: TaskExecution) => {
      this.updateTaskStats(execution.taskId, true)
      this.emit('task-completed', execution)
    })
    
    this.executor.on('execution-failed', (execution: TaskExecution) => {
      this.updateTaskStats(execution.taskId, false)
      this.emit('task-failed', execution)
    })
  }
  
  async initialize() {
    // 从存储加载任务
    const tasks = await this.storage.loadTasks()
    for (const task of tasks) {
      this.tasks.set(task.id, task)
      if (task.enabled) {
        await this.scheduleTask(task)
      }
    }
    logger.info(`Loaded ${tasks.length} tasks`)
  }
  
  async createTask(taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'successCount'>): Promise<ScheduledTask> {
    const task: ScheduledTask = {
      ...taskData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0,
      successCount: 0
    }
    
    this.tasks.set(task.id, task)
    await this.storage.saveTask(task)
    
    if (task.enabled) {
      await this.scheduleTask(task)
    }
    
    this.emit('task-created', task)
    logger.info(`Created task: ${task.name} (${task.id})`)
    
    return task
  }
  
  async updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }
    
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    }
    
    this.tasks.set(taskId, updatedTask)
    await this.storage.saveTask(updatedTask)
    
    // 重新调度
    this.unscheduleTask(taskId)
    if (updatedTask.enabled) {
      await this.scheduleTask(updatedTask)
    }
    
    this.emit('task-updated', updatedTask)
    logger.info(`Updated task: ${updatedTask.name} (${taskId})`)
    
    return updatedTask
  }
  
  async deleteTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }
    
    this.unscheduleTask(taskId)
    this.tasks.delete(taskId)
    await this.storage.deleteTask(taskId)
    
    this.emit('task-deleted', taskId)
    logger.info(`Deleted task: ${task.name} (${taskId})`)
  }
  
  async toggleTask(taskId: string): Promise<ScheduledTask> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }
    
    return this.updateTask(taskId, { enabled: !task.enabled })
  }
  
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values())
  }
  
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId)
  }
  
  async getExecutions(taskId?: string): Promise<TaskExecution[]> {
    return this.storage.loadExecutions(taskId)
  }
  
  private async scheduleTask(task: ScheduledTask) {
    this.unscheduleTask(task.id) // 清理旧的调度
    
    switch (task.schedule.type) {
      case 'cron':
        this.scheduleCronTask(task)
        break
      case 'interval':
        this.scheduleIntervalTask(task)
        break
      case 'once':
        this.scheduleOnceTask(task)
        break
    }
    
    // 更新下次执行时间
    task.nextRun = this.calculateNextRun(task.schedule)
    await this.storage.saveTask(task)
  }
  
  private scheduleCronTask(task: ScheduledTask) {
    try {
      // 确保cron表达式是6字段格式 (秒 分 时 日 月 周)
      let cronExpression = task.schedule.cron!
      
      // 如果是5字段格式，转换为6字段格式
      const fields = cronExpression.trim().split(/\s+/)
      if (fields.length === 5) {
        cronExpression = '0 ' + cronExpression // 在前面添加秒字段
      }
      
      const job = new CronJob(
        cronExpression,
        () => this.executeTask(task.id),
        null,
        true,
        task.schedule.timezone || 'Asia/Shanghai'
      )
      this.jobs.set(task.id, job)
      logger.info(`Scheduled cron task: ${task.name} with pattern: ${cronExpression}`)
    } catch (error) {
      logger.error(`Failed to schedule cron task ${task.name}:`, error)
    }
  }
  
  private scheduleIntervalTask(task: ScheduledTask) {
    const { value, unit } = task.schedule.interval!
    const ms = this.convertToMilliseconds(value, unit)
    
    const interval = setInterval(() => {
      this.executeTask(task.id)
    }, ms)
    
    this.intervals.set(task.id, interval)
    logger.info(`Scheduled interval task: ${task.name} every ${value} ${unit}`)
  }
  
  private scheduleOnceTask(task: ScheduledTask) {
    const executeAt = new Date(task.schedule.executeAt!)
    const now = new Date()
    const delay = executeAt.getTime() - now.getTime()
    
    if (delay > 0) {
      const timeout = setTimeout(() => {
        this.executeTask(task.id)
        // 一次性任务执行后自动禁用
        this.updateTask(task.id, { enabled: false })
      }, delay)
      
      this.timeouts.set(task.id, timeout)
      logger.info(`Scheduled once task: ${task.name} at ${executeAt.toISOString()}`)
    } else {
      logger.warn(`Once task ${task.name} scheduled time is in the past`)
    }
  }
  
  private unscheduleTask(taskId: string) {
    // 清理 cron job
    const job = this.jobs.get(taskId)
    if (job) {
      job.stop()
      this.jobs.delete(taskId)
    }
    
    // 清理 interval
    const interval = this.intervals.get(taskId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(taskId)
    }
    
    // 清理 timeout
    const timeout = this.timeouts.get(taskId)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(taskId)
    }
  }
  
  private async executeTask(taskId: string) {
    const task = this.tasks.get(taskId)
    if (!task || !task.enabled) {
      return
    }
    
    try {
      await this.executor.executeTask(task)
    } catch (error) {
      logger.error(`Failed to execute task ${task.name}:`, error)
    }
  }
  
  private async updateTaskStats(taskId: string, success: boolean) {
    const task = this.tasks.get(taskId)
    if (!task) return
    
    const updates: Partial<ScheduledTask> = {
      runCount: task.runCount + 1,
      lastRun: new Date()
    }
    
    if (success) {
      updates.successCount = task.successCount + 1
    }
    
    await this.updateTask(taskId, updates)
  }
  
  private convertToMilliseconds(value: number, unit: string): number {
    const multipliers = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000
    }
    return value * multipliers[unit as keyof typeof multipliers]
  }
  
  private calculateNextRun(schedule: TaskSchedule): Date | undefined {
    const now = new Date()
    
    switch (schedule.type) {
      case 'cron':
        try {
          // 确保cron表达式是6字段格式
          let cronExpression = schedule.cron!
          const fields = cronExpression.trim().split(/\s+/)
          if (fields.length === 5) {
            cronExpression = '0 ' + cronExpression
          }
          
          const job = new CronJob(cronExpression, () => {}, null, false, schedule.timezone)
          return job.nextDate().toJSDate()
        } catch {
          return undefined
        }
      
      case 'interval':
        const ms = this.convertToMilliseconds(schedule.interval!.value, schedule.interval!.unit)
        return new Date(now.getTime() + ms)
      
      case 'once':
        return schedule.executeAt ? new Date(schedule.executeAt) : undefined
      
      default:
        return undefined
    }
  }
  
  async shutdown() {
    // 清理所有调度
    for (const taskId of this.tasks.keys()) {
      this.unscheduleTask(taskId)
    }
    
    // 停止执行器
    await this.executor.shutdown()
    
    logger.info('Task scheduler shutdown')
  }
}