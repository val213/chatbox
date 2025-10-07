import type { ScheduledTask, TaskExecution, TaskStats } from './types/scheduler'

export interface ElectronIPC {
  // 通用 invoke 方法
  invoke: (channel: string, ...args: any[]) => Promise<any>
  
  // 系统事件监听器
  onSystemThemeChange: (callback: () => void) => () => void
  onWindowShow: (callback: () => void) => () => void
  onUpdateDownloaded: (callback: () => void) => () => void
  onNavigate: (callback: (path: string) => void) => () => void
  
  // MCP 相关
  addMcpStdioTransportEventListener: (transportId: string, event: string, callback?: (...args: any[]) => void) => void
  
  // 调度器事件监听器
  onSchedulerTaskCreated: (callback: (task: ScheduledTask) => void) => () => void
  onSchedulerTaskUpdated: (callback: (task: ScheduledTask) => void) => () => void
  onSchedulerTaskDeleted: (callback: (taskId: string) => void) => () => void
  onSchedulerTaskStarted: (callback: (execution: TaskExecution) => void) => () => void
  onSchedulerTaskCompleted: (callback: (execution: TaskExecution) => void) => () => void
  onSchedulerTaskFailed: (callback: (execution: TaskExecution) => void) => () => void
  onSchedulerCreateSession: (callback: (sessionData: any) => void) => () => void
  onSchedulerExecuteTaskViaSession: (callback: (taskData: any) => void) => () => void
}