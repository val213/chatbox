import React from 'react'
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  IconButton,
  Switch,
  Grid,
  Tooltip,
  Avatar
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Pause as PauseIcon
} from '@mui/icons-material'
import { useAtom } from 'jotai'
import type { ScheduledTask } from '../../../shared/types/scheduler'
import * as atoms from '../../stores/atoms/schedulerAtoms'

interface TaskListProps {
  tasks: ScheduledTask[]
  selectedTask?: ScheduledTask | null
  onEdit: (task: ScheduledTask) => void
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onView: (task: ScheduledTask) => void
  onSelect: (task: ScheduledTask | null) => void
}

export function TaskList({
  tasks,
  selectedTask,
  onEdit,
  onToggle,
  onDelete,
  onView,
  onSelect
}: TaskListProps) {
  const [taskStatusMap] = useAtom(atoms.taskStatusMapAtom)
  
  const getStatusColor = (taskId: string, enabled: boolean) => {
    if (!enabled) return 'default'
    
    const status = taskStatusMap.get(taskId) || 'idle'
    switch (status) {
      case 'running': return 'info'
      case 'success': return 'success'
      case 'failed': return 'error'
      default: return 'default'
    }
  }
  
  const getStatusIcon = (taskId: string, enabled: boolean) => {
    if (!enabled) return <PauseIcon />
    
    const status = taskStatusMap.get(taskId) || 'idle'
    switch (status) {
      case 'running': return <ScheduleIcon />
      case 'success': return <SuccessIcon />
      case 'failed': return <ErrorIcon />
      default: return <ScheduleIcon />
    }
  }
  
  const formatSchedule = (task: ScheduledTask) => {
    const { schedule } = task
    
    switch (schedule.type) {
      case 'interval':
        return `每 ${schedule.interval?.value} ${schedule.interval?.unit}`
      case 'cron':
        return `Cron: ${schedule.cron}`
      case 'once':
        return `一次性: ${schedule.executeAt ? new Date(schedule.executeAt).toLocaleString() : '未设置'}`
      default:
        return '未知'
    }
  }
  
  const formatNextRun = (nextRun?: Date) => {
    if (!nextRun) return '未计划'
    
    const now = new Date()
    const diff = new Date(nextRun).getTime() - now.getTime()
    
    if (diff < 0) return '已过期'
    
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days} 天后`
    if (hours > 0) return `${hours} 小时后`
    if (minutes > 0) return `${minutes} 分钟后`
    return '即将执行'
  }
  
  if (tasks.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center'
        }}
      >
        <ScheduleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          还没有任务
        </Typography>
        <Typography variant="body2" color="text.secondary">
          创建你的第一个定时任务来开始自动化 AI 对话
        </Typography>
      </Box>
    )
  }
  
  return (
    <Grid container spacing={2}>
      {tasks.map((task) => (
        <Grid item xs={12} md={6} lg={4} key={task.id}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              border: selectedTask?.id === task.id ? 2 : 1,
              borderColor: selectedTask?.id === task.id ? 'primary.main' : 'divider',
              '&:hover': {
                boxShadow: 2
              }
            }}
            onClick={() => onSelect(task)}
          >
            <CardContent sx={{ flexGrow: 1 }}>
              {/* 任务标题和状态 */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    mr: 1,
                    bgcolor: getStatusColor(task.id, task.enabled) + '.main'
                  }}
                >
                  {getStatusIcon(task.id, task.enabled)}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="h6" noWrap>
                    {task.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {task.aiProvider} / {task.model}
                  </Typography>
                </Box>
                <Switch
                  checked={task.enabled}
                  onChange={(e) => {
                    e.stopPropagation()
                    onToggle(task.id)
                  }}
                  size="small"
                />
              </Box>
              
              {/* 任务描述 */}
              {task.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {task.description}
                </Typography>
              )}
              
              {/* 调度信息 */}
              <Box sx={{ mb: 2 }}>
                <Chip
                  label={formatSchedule(task)}
                  size="small"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
                <Typography variant="caption" display="block" color="text.secondary">
                  下次执行: {formatNextRun(task.nextRun)}
                </Typography>
              </Box>
              
              {/* 统计信息 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  执行次数: {task.runCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  成功率: {task.runCount > 0 ? Math.round((task.successCount / task.runCount) * 100) : 0}%
                </Typography>
              </Box>
            </CardContent>
            
            <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
              <Box>
                <Tooltip title="查看详情">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      onView(task)
                    }}
                  >
                    <ViewIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="编辑任务">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(task)
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              
              <Tooltip title="删除任务">
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(task.id)
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}