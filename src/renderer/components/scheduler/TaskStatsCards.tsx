import React from 'react'
import { Grid, Card, CardContent, Typography, Box, LinearProgress } from '@mui/material'
import {
  Assignment as TaskIcon,
  PlayArrow as ActiveIcon,
  History as ExecutionIcon,
  TrendingUp as SuccessIcon
} from '@mui/icons-material'
import type { TaskStats } from '../../../shared/types/scheduler'

interface TaskStatsCardsProps {
  stats: TaskStats
  sx?: any
}

export function TaskStatsCards({ stats, sx }: TaskStatsCardsProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}min`
  }
  
  const cards = [
    {
      title: '总任务数',
      value: stats.totalTasks,
      icon: <TaskIcon />,
      color: 'primary.main'
    },
    {
      title: '活跃任务',
      value: stats.activeTasks,
      icon: <ActiveIcon />,
      color: 'success.main'
    },
    {
      title: '总执行次数',
      value: stats.totalExecutions,
      icon: <ExecutionIcon />,
      color: 'info.main'
    },
    {
      title: '成功率',
      value: `${Math.round(stats.successRate * 100)}%`,
      icon: <SuccessIcon />,
      color: 'warning.main',
      progress: stats.successRate
    }
  ]
  
  return (
    <Grid container spacing={3} sx={sx}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    bgcolor: card.color,
                    color: 'white',
                    mr: 2
                  }}
                >
                  {card.icon}
                </Box>
                <Box>
                  <Typography variant="h4" component="div">
                    {card.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.title}
                  </Typography>
                </Box>
              </Box>
              
              {card.progress !== undefined && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={card.progress * 100}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              )}
              
              {card.title === '总执行次数' && stats.avgDuration > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  平均耗时: {formatDuration(stats.avgDuration)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}