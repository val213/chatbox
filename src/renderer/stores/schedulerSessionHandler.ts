import { getDefaultStore } from 'jotai'
import { v4 as uuidv4 } from 'uuid'
import type { Message, Session } from '../../shared/types'
import { createMessage } from '../../shared/types'
import { getLogger } from '@/lib/utils'
import platform from '../platform'
import * as sessionActions from './sessionActions'
import { saveSession } from './sessionStorageMutations'
import * as atoms from './atoms'

const logger = getLogger('scheduler-session-handler')
const store = getDefaultStore()

interface TaskExecutionData {
  taskId: string
  taskName: string
  executionId: string
  prompt: string
  settings: {
    provider: string
    modelId: string
    mcpServers: string[]
  }
  executionTime: string
}

/**
 * 通过创建真实会话来执行定时任务
 * 这样可以完全复用现有的AI调用、MCP工具、流式输出等能力
 */
export async function executeTaskViaSession(taskData: TaskExecutionData): Promise<void> {
  try {
    logger.info(`Executing task via session: ${taskData.taskName}`)
    
    // 1. 创建会话名称
    const sessionName = `🤖 ${taskData.taskName} - ${new Date(taskData.executionTime).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit', 
      hour: '2-digit',
      minute: '2-digit'
    })}`
    
    // 2. 创建系统消息说明这是定时任务
    const systemPrompt = `这是定时任务"${taskData.taskName}"的自动执行。\n` +
      `执行时间: ${new Date(taskData.executionTime).toLocaleString()}\n` +
      `任务ID: ${taskData.taskId}\n` +
      `执行ID: ${taskData.executionId}`
    
    // 3. 使用现有的会话创建逻辑，但不自动切换
    const newSession = await sessionActions.createEmpty('chat')
    const sessionId = newSession.id
    
    logger.info(`Created base session ${sessionId} for task ${taskData.taskName}`)
    
    // 4. 等待一小段时间确保会话原子初始化完成
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 5. 获取会话原子并更新会话属性
    const sessionAtom = atoms.createSessionAtom(sessionId)
    
    // 等待会话原子加载完成
    let session = store.get(sessionAtom)
    if (!session) {
      // 如果会话还没加载，等待加载完成
      await new Promise<void>((resolve) => {
        const unsubscribe = store.sub(sessionAtom, () => {
          const loadedSession = store.get(sessionAtom)
          if (loadedSession) {
            unsubscribe()
            resolve()
          }
        })
        // 超时保护
        setTimeout(() => {
          unsubscribe()
          resolve()
        }, 1000)
      })
      session = store.get(sessionAtom)
    }
    
    if (!session) {
      throw new Error(`Failed to load session ${sessionId}`)
    }
    
    // 6. 更新会话属性
    const updatedSession: Session = {
      ...session,
      name: sessionName, // 设置会话名称
      settings: {
        ...session.settings,
        provider: taskData.settings.provider,
        modelId: taskData.settings.modelId,
        // 注意：MCP服务器配置需要通过其他方式设置，因为不在SessionSettings类型中
      },
      // 添加系统消息
      messages: [
        createMessage('system', systemPrompt),
        ...session.messages
      ]
      // 注意：移除了metadata和updatedAt，因为它们不在Session接口中
    }
    
    // 7. 保存更新后的会话
    store.set(sessionAtom, updatedSession)
    saveSession(updatedSession)
    
    logger.info(`Updated session ${sessionId} with task properties`)
    
    // 8. 创建并添加用户消息
    const userMessage = createMessage('user', taskData.prompt)
    
    const finalSession: Session = {
      ...updatedSession,
      messages: [...updatedSession.messages, userMessage]
    }
    
    // 9. 保存包含用户消息的会话
    store.set(sessionAtom, finalSession)
    saveSession(finalSession)
    
    logger.info(`Added user message to session ${sessionId}`)
    
    // 10. 触发AI响应 - 使用现有的消息提交流程
    await sessionActions.submitNewUserMessage({
      currentSessionId: sessionId,
      newUserMsg: userMessage,
      needGenerating: true,
      attachments: [],
      links: []
    })
    
    logger.info(`Task message sent to session ${sessionId}`)
    
    logger.info(`Task execution completed: ${taskData.taskName}`)
    
  } catch (error) {
    logger.error('Failed to execute task via session:', error)
    throw error
  }
}

/**
 * 初始化定时任务会话处理器
 */
export function initializeSchedulerSessionHandler(): void {
  if (platform.type !== 'desktop') {
    return
  }
  
  // 监听来自主进程的任务执行请求
  if ('ipc' in platform) {
    (platform as any).ipc.onSchedulerExecuteTaskViaSession((taskData: TaskExecutionData) => {
      executeTaskViaSession(taskData).catch(error => {
        logger.error('Failed to handle task execution via session:', error)
      })
    })
  }
  
  logger.info('Scheduler session handler initialized')
}

/**
 * 清理定时任务会话处理器
 */
export function cleanupSchedulerSessionHandler(): void {
  // TODO: 移除事件监听器
  logger.info('Scheduler session handler cleaned up')
}