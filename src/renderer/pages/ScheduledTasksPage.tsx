import React, { useEffect } from 'react'
import { useAtom } from 'jotai'
import { 
  Box, 
  Button, 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  Fab,
  Alert
} from '@mui/material'
import { 
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Visibility as ViewIcon
} from '@mui/icons-material'
import * as atoms from '../stores/atoms/schedulerAtoms'
import * as actions from '../stores/schedulerActions'
import { TaskList } from '../components/scheduler/TaskList'
import { TaskModal } from '../components/scheduler/TaskModal'
import { TaskStatsCards } from '../components/scheduler/TaskStatsCards'
import { TaskMonitor } from '../components/scheduler/TaskMonitor'
import platform from '../platform'

export function ScheduledTasksPage() {
  const [tasks] = useAtom(atoms.scheduledTasksAtom)
  const [stats] = useAtom(atoms.taskStatsAtom)
  const [taskModal] = useAtom(atoms.taskModalAtom)
  const [taskMonitor] = useAtom(atoms.taskMonitorAtom)
  const [selectedTask, setSelectedTask] = useAtom(atoms.selectedTaskAtom)
  
  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([
          actions.loadTasks(),
          actions.loadExecutions(),
          actions.loadStats()
        ])
        
        // 初始化事件监听
        actions.initializeSchedulerEvents()
      } catch (error) {
        console.error('Failed to initialize scheduler data:', error)
      }
    }
    
    initializeData()
    
    return () => {
      actions.cleanupSchedulerEvents()
    }
  }, [])
  
  // 检查平台支持
  if (platform.type !== 'desktop') {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="warning">
          定时任务功能仅在桌面版中可用。请使用桌面应用来访问此功能。
        </Alert>
      </Container>
    )
  }
  
  const handleCreateTask = () => {
    actions.openTaskModal('create')
  }
  
  const handleEditTask = (task: any) => {
    actions.openTaskModal('edit', task)
  }
  
  const handleToggleTask = async (taskId: string) => {
    try {
      await actions.toggleTask(taskId)
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }
  
  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('确定要删除这个任务吗？此操作不可撤销。')) {
      try {
        await actions.deleteTask(taskId)
        if (selectedTask?.id === taskId) {
          setSelectedTask(null)
        }
      } catch (error) {
        console.error('Failed to delete task:', error)
      }
    }
  }
  
  const handleViewTask = (task: any) => {
    setSelectedTask(task)
    actions.showTaskMonitor(task.id)
  }
  
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          定时任务管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          创建和管理自动执行的 AI 对话任务
        </Typography>
      </Box>
      
      {/* 统计卡片 */}
      <TaskStatsCards stats={stats} sx={{ mb: 4 }} />
      
      <Grid container spacing={3}>
        {/* 任务列表 */}
        <Grid item xs={12} lg={taskMonitor.showMonitor ? 8 : 12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">
                任务列表 ({tasks.length})
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateTask}
              >
                创建任务
              </Button>
            </Box>
            
            <TaskList
              tasks={tasks}
              selectedTask={selectedTask}
              onEdit={handleEditTask}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onView={handleViewTask}
              onSelect={setSelectedTask}
            />
          </Paper>
        </Grid>
        
        {/* 任务监控面板 */}
        {taskMonitor.showMonitor && (
          <Grid item xs={12} lg={4}>
            <TaskMonitor
              taskId={taskMonitor.selectedTaskId}
              onClose={() => actions.hideTaskMonitor()}
            />
          </Grid>
        )}
      </Grid>
      
      {/* 创建任务浮动按钮 */}
      <Fab
        color="primary"
        aria-label="创建任务"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
        }}
        onClick={handleCreateTask}
      >
        <AddIcon />
      </Fab>
      
      {/* 任务创建/编辑模态框 */}
      {taskModal.open && (
        <TaskModal
          open={taskModal.open}
          mode={taskModal.mode}
          task={taskModal.task}
          onClose={() => actions.closeTaskModal()}
          onSubmit={async (taskData) => {
            try {
              if (taskModal.mode === 'create') {
                await actions.createTask(taskData)
              } else if (taskModal.task) {
                await actions.updateTask(taskModal.task.id, taskData)
              }
              actions.closeTaskModal()
            } catch (error) {
              console.error('Failed to save task:', error)
              throw error
            }
          }}
        />
      )}
    </Container>
  )
}