import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import type { ScheduledTask, TaskExecution } from '../../shared/types/scheduler'
import { getLogger } from '../util'

const logger = getLogger('task-storage')

export class TaskStorage {
  private tasksDir: string
  private executionsDir: string
  
  constructor() {
    const userDataPath = app.getPath('userData')
    this.tasksDir = path.join(userDataPath, 'scheduled-tasks')
    this.executionsDir = path.join(userDataPath, 'task-executions')
  }
  
  async initialize() {
    await fs.mkdir(this.tasksDir, { recursive: true })
    await fs.mkdir(this.executionsDir, { recursive: true })
  }
  
  async saveTask(task: ScheduledTask): Promise<void> {
    try {
      await this.initialize()
      const filePath = path.join(this.tasksDir, `${task.id}.json`)
      await fs.writeFile(filePath, JSON.stringify(task, null, 2), 'utf-8')
    } catch (error) {
      logger.error(`Failed to save task ${task.id}:`, error)
      throw error
    }
  }
  
  async loadTask(taskId: string): Promise<ScheduledTask | null> {
    try {
      const filePath = path.join(this.tasksDir, `${taskId}.json`)
      const content = await fs.readFile(filePath, 'utf-8')
      const task = JSON.parse(content) as ScheduledTask
      
      // 转换日期字段
      task.createdAt = new Date(task.createdAt)
      task.updatedAt = new Date(task.updatedAt)
      if (task.lastRun) task.lastRun = new Date(task.lastRun)
      if (task.nextRun) task.nextRun = new Date(task.nextRun)
      if (task.schedule.executeAt) task.schedule.executeAt = new Date(task.schedule.executeAt)
      
      return task
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null
      }
      logger.error(`Failed to load task ${taskId}:`, error)
      throw error
    }
  }
  
  async loadTasks(): Promise<ScheduledTask[]> {
    try {
      await this.initialize()
      const files = await fs.readdir(this.tasksDir)
      const tasks: ScheduledTask[] = []
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const taskId = file.replace('.json', '')
          const task = await this.loadTask(taskId)
          if (task) {
            tasks.push(task)
          }
        }
      }
      
      return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } catch (error) {
      logger.error('Failed to load tasks:', error)
      return []
    }
  }
  
  async deleteTask(taskId: string): Promise<void> {
    try {
      const filePath = path.join(this.tasksDir, `${taskId}.json`)
      await fs.unlink(filePath)
      
      // 同时删除相关的执行记录
      await this.deleteExecutions(taskId)
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error(`Failed to delete task ${taskId}:`, error)
        throw error
      }
    }
  }
  
  async saveExecution(execution: TaskExecution): Promise<void> {
    try {
      await this.initialize()
      const filePath = path.join(this.executionsDir, `${execution.id}.json`)
      await fs.writeFile(filePath, JSON.stringify(execution, null, 2), 'utf-8')
    } catch (error) {
      logger.error(`Failed to save execution ${execution.id}:`, error)
      throw error
    }
  }
  
  async loadExecution(executionId: string): Promise<TaskExecution | null> {
    try {
      const filePath = path.join(this.executionsDir, `${executionId}.json`)
      const content = await fs.readFile(filePath, 'utf-8')
      const execution = JSON.parse(content) as TaskExecution
      
      // 转换日期字段
      execution.startTime = new Date(execution.startTime)
      if (execution.endTime) execution.endTime = new Date(execution.endTime)
      
      return execution
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null
      }
      logger.error(`Failed to load execution ${executionId}:`, error)
      throw error
    }
  }
  
  async loadExecutions(taskId?: string): Promise<TaskExecution[]> {
    try {
      await this.initialize()
      const files = await fs.readdir(this.executionsDir)
      const executions: TaskExecution[] = []
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const executionId = file.replace('.json', '')
          const execution = await this.loadExecution(executionId)
          if (execution && (!taskId || execution.taskId === taskId)) {
            executions.push(execution)
          }
        }
      }
      
      return executions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    } catch (error) {
      logger.error('Failed to load executions:', error)
      return []
    }
  }
  
  async deleteExecution(executionId: string): Promise<void> {
    try {
      const filePath = path.join(this.executionsDir, `${executionId}.json`)
      await fs.unlink(filePath)
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error(`Failed to delete execution ${executionId}:`, error)
        throw error
      }
    }
  }
  
  async deleteExecutions(taskId: string): Promise<void> {
    try {
      const executions = await this.loadExecutions(taskId)
      await Promise.all(executions.map(e => this.deleteExecution(e.id)))
    } catch (error) {
      logger.error(`Failed to delete executions for task ${taskId}:`, error)
    }
  }
  
  async cleanupOldExecutions(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const executions = await this.loadExecutions()
      const cutoff = new Date(Date.now() - maxAge)
      
      const toDelete = executions.filter(e => e.startTime < cutoff)
      await Promise.all(toDelete.map(e => this.deleteExecution(e.id)))
      
      if (toDelete.length > 0) {
        logger.info(`Cleaned up ${toDelete.length} old executions`)
      }
    } catch (error) {
      logger.error('Failed to cleanup old executions:', error)
    }
  }
}