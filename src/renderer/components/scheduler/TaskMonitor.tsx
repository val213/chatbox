import React, { useEffect, useState } from 'react'
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material'
import {
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as RunningIcon,
  Cancel as CancelledIcon
} from '@mui/icons-material'
import { useAtom } from 'jotai'
import type { TaskExecution } from '../../../shared/types/scheduler'
import * as atoms from '../../stores/atoms/schedulerAtoms'
import * as actions from '../../stores/schedulerActions'

interface TaskMonitorProps {
  taskId?: string
  onClose: () => void
}

export function TaskMonitor({ taskId, onClose }: TaskMonitorProps) {
  const [executions] = useAtom(atoms.taskExecutionsAtom)
  const [tasks] = useAtom(atoms.scheduledTasksAtom)
  const [loading, setLoading] = useState(false)
  
  const task = taskId ? tasks.find(t => t.id === taskId) : null
  const taskExecutions = taskId 
    ? executions.filter(e => e.taskId === taskId).slice(0, 20)
    : executions.slice(0, 20)
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        await actions.loadExecutions(taskId)
      } catch (error) {
        console.error('Failed to load executions:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [taskId])
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RunningIcon color="info" />
      case 'completed':
        return <SuccessIcon color="success" />
      case 'failed':
        return <ErrorIcon color="error" />
      case 'cancelled':
        return <CancelledIcon color="disabled" />
      default:
        return <RunningIcon />
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'info'
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'cancelled': return 'default'
      default: return 'default'
    }
  }
  
  const formatDuration = (duration?: number) => {
    if (!duration) return '-'
    
    if (duration < 1000) return `${Math.round(duration)}ms`
    if (duration < 60000) return `${Math.round(duration / 1000)}s`
    return `${Math.round(duration / 60000)}min`
  }
  
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }
  
  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {task ? `任务监控: ${task.name}` : '执行监控'}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        
        {task && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {task.description || '无描述'}
          </Typography>
        )}
      </Box>
      
      {/* 执行历史列表 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : taskExecutions.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              暂无执行记录
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {taskExecutions.map((execution, index) => (
              <React.Fragment key={execution.id}>
                <ListItem sx={{ py: 2 }}>
                  <ListItemIcon>
                    {getStatusIcon(execution.status)}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={execution.status === 'completed' ? '成功' : 
                                execution.status === 'failed' ? '失败' :
                                execution.status === 'running' ? '运行中' : '已取消'}
                          size="small"
                          color={getStatusColor(execution.status) as any}
                          variant="outlined"
                        />
                        <Typography variant="body2" color="text.secondary">
                          {formatTime(execution.startTime)}
                        </Typography>
                        {execution.duration && (
                          <Typography variant="body2" color="text.secondary">
                            • {formatDuration(execution.duration)}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        {execution.error ? (
                          <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                            {execution.error}
                          </Alert>
                        ) : execution.messages && execution.messages.length > 0 ? (
                          <Typography
                            variant="body2"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}
                          >
                            {execution.messages
                              .filter(m => m.role === 'assistant')
                              .map(m => m.contentParts
                                ?.filter(p => p.type === 'text')
                                .map(p => (p as any).text)
                                .join('')
                              )
                              .join('')
                              .slice(0, 100)}
                          </Typography>
                        ) : null}
                        
                        {execution.tokenUsage && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            Token 使用: {execution.tokenUsage.promptTokens || 0} + {execution.tokenUsage.completionTokens || 0} = {execution.tokenUsage.totalTokens || 0}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
                
                {index < taskExecutions.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  )
}