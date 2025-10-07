import { initSessionsIfNeeded } from '../stores/sessionStorageMutations'
import { initializeSchedulerSessionHandler } from '../stores/schedulerSessionHandler'

export async function initData() {
  await initSessionsIfNeeded()
  
  // 初始化定时任务会话处理器 - 复用现有会话流程
  initializeSchedulerSessionHandler()
}
