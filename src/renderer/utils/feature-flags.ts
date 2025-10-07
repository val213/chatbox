import platform from '../platform'

export const featureFlags = {
  mcp: platform.type === 'desktop',
  knowledgeBase: platform.type === 'desktop',
  scheduler: platform.type === 'desktop', // 添加调度器功能标志
}