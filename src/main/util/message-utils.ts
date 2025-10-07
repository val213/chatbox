import type { CoreMessage } from 'ai'
import type { Message } from '../../shared/types'

export function convertToCoreMessages(messages: Message[]): CoreMessage[] {
  return messages.map(convertToCoreMessage)
}

export function convertToCoreMessage(message: Message): CoreMessage {
  const content = message.contentParts.map(part => {
    switch (part.type) {
      case 'text':
        return { type: 'text' as const, text: part.text }
      case 'image':
        return { type: 'image' as const, image: part.storageKey }
      default:
        return { type: 'text' as const, text: '' }
    }
  })

  // 简化类型处理
  if (message.role === 'user' || message.role === 'assistant' || message.role === 'system') {
    return {
      role: message.role,
      content
    }
  }
  
  // 默认返回用户消息
  return {
    role: 'user',
    content
  }
}