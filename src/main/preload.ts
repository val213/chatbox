// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronIPC } from 'src/shared/electron-types'

// export type Channels = 'ipc-example';

const electronHandler: ElectronIPC = {
  // ipcRenderer: {
  //     sendMessage(channel: Channels, ...args: unknown[]) {
  //         ipcRenderer.send(channel, ...args);
  //     },
  //     on(channel: Channels, func: (...args: unknown[]) => void) {
  //         const subscription = (
  //             _event: IpcRendererEvent,
  //             ...args: unknown[]
  //         ) => func(...args);
  //         ipcRenderer.on(channel, subscription);

  //         return () => {
  //             ipcRenderer.removeListener(channel, subscription);
  //         };
  //     },
  //     once(channel: Channels, func: (...args: unknown[]) => void) {
  //         ipcRenderer.once(channel, (_event, ...args) => func(...args));
  //     },
  // },
  invoke: ipcRenderer.invoke,
  onSystemThemeChange: (callback: () => void) => {
    ipcRenderer.on('system-theme-updated', callback)
    return () => ipcRenderer.off('system-theme-updated', callback)
  },
  onWindowShow: (callback: () => void) => {
    ipcRenderer.on('window-show', callback)
    return () => ipcRenderer.off('window-show', callback)
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback)
    return () => ipcRenderer.off('update-downloaded', callback)
  },
  addMcpStdioTransportEventListener: (transportId: string, event: string, callback?: (...args: any[]) => void) => {
    ipcRenderer.on(`mcp:stdio-transport:${transportId}:${event}`, (_event, ...args) => {
      callback?.(...args)
    })
  },
  onNavigate: (callback: (path: string) => void) => {
    const listener = (_event: unknown, path: string) => {
      callback(path)
    }
    ipcRenderer.on('navigate-to', listener)
    return () => ipcRenderer.off('navigate-to', listener)
  },
  // 调度器事件监听器
  onSchedulerTaskCreated: (callback: (task: any) => void) => {
    const listener = (_event: unknown, task: any) => callback(task)
    ipcRenderer.on('scheduler:task-created', listener)
    return () => ipcRenderer.off('scheduler:task-created', listener)
  },
  onSchedulerTaskUpdated: (callback: (task: any) => void) => {
    const listener = (_event: unknown, task: any) => callback(task)
    ipcRenderer.on('scheduler:task-updated', listener)
    return () => ipcRenderer.off('scheduler:task-updated', listener)
  },
  onSchedulerTaskDeleted: (callback: (taskId: string) => void) => {
    const listener = (_event: unknown, taskId: string) => callback(taskId)
    ipcRenderer.on('scheduler:task-deleted', listener)
    return () => ipcRenderer.off('scheduler:task-deleted', listener)
  },
  onSchedulerTaskStarted: (callback: (execution: any) => void) => {
    const listener = (_event: unknown, execution: any) => callback(execution)
    ipcRenderer.on('scheduler:task-started', listener)
    return () => ipcRenderer.off('scheduler:task-started', listener)
  },
  onSchedulerTaskCompleted: (callback: (execution: any) => void) => {
    const listener = (_event: unknown, execution: any) => callback(execution)
    ipcRenderer.on('scheduler:task-completed', listener)
    return () => ipcRenderer.off('scheduler:task-completed', listener)
  },
  onSchedulerTaskFailed: (callback: (execution: any) => void) => {
    const listener = (_event: unknown, execution: any) => callback(execution)
    ipcRenderer.on('scheduler:task-failed', listener)
    return () => ipcRenderer.off('scheduler:task-failed', listener)
  },
  onSchedulerCreateSession: (callback: (sessionData: any) => void) => {
    const listener = (_event: unknown, sessionData: any) => callback(sessionData)
    ipcRenderer.on('scheduler:create-session', listener)
    return () => ipcRenderer.off('scheduler:create-session', listener)
  },
  onSchedulerExecuteTaskViaSession: (callback: (taskData: any) => void) => {
    const listener = (_event: unknown, taskData: any) => callback(taskData)
    ipcRenderer.on('scheduler:execute-task-via-session', listener)
    return () => ipcRenderer.off('scheduler:execute-task-via-session', listener)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronHandler)
