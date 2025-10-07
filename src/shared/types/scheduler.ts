import type { LanguageModelUsage } from 'ai'
import type { Message, ModelProvider } from '../types'

// 任务调度类型
export interface ScheduledTask {
  id: string
  name: string
  description?: string
  
  // 任务配置
  prompt: string
  mcpServers: string[] // MCP 服务器 ID 列表
  aiProvider: ModelProvider
  model: string
  
  // 调度配置
  schedule: TaskSchedule
  enabled: boolean
  
  // 执行历史统计
  lastRun?: Date
  nextRun?: Date
  runCount: number
  successCount: number
  
  // 元数据
  createdAt: Date
  updatedAt: Date
}

export interface TaskSchedule {
  type: 'interval' | 'cron' | 'once'
  
  // 间隔类型配置
  interval?: {
    value: number
    unit: 'minutes' | 'hours' | 'days' | 'weeks'
  }
  
  // Cron 表达式配置
  cron?: string
  
  // 一次性任务配置
  executeAt?: Date
  
  // 时区
  timezone?: string
}



export interface TaskExecution {
  id: string
  taskId: string
  startTime: Date
  endTime?: Date
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  
  // 执行结果
  messages?: Message[]
  error?: string
  
  // 性能指标
  duration?: number
  tokenUsage?: LanguageModelUsage
}

// 任务统计
export interface TaskStats {
  totalTasks: number
  activeTasks: number
  totalExecutions: number
  successRate: number
  avgDuration: number
}

// IPC 事件类型
export interface TaskSchedulerEvents {
  'task-created': ScheduledTask
  'task-updated': ScheduledTask
  'task-deleted': string
  'task-started': TaskExecution
  'task-completed': TaskExecution
  'task-failed': TaskExecution
  'task-cancelled': TaskExecution
}