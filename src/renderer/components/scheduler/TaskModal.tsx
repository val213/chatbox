import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Chip,
  Autocomplete,
  Alert
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import type { ScheduledTask, TaskSchedule } from '../../../shared/types/scheduler'
import type { ModelProvider } from '../../../shared/types'
import { useProviders } from '../../hooks/useProviders'
import { useSettings } from '../../hooks/useSettings'
import { mcpController } from '../../packages/mcp/controller'

interface TaskModalProps {
  open: boolean
  mode: 'create' | 'edit'
  task?: ScheduledTask
  onClose: () => void
  onSubmit: (taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'successCount'>) => Promise<void>
}

interface TaskFormData {
  name: string
  description: string
  prompt: string
  aiProvider: ModelProvider
  model: string
  mcpServers: string[]
  scheduleType: 'interval' | 'cron' | 'once'
  intervalValue: number
  intervalUnit: 'minutes' | 'hours' | 'days' | 'weeks'
  cronExpression: string
  executeAt: string
  timezone: string
  enabled: boolean
}

const getDefaultValues = (availableModels: Array<{ provider: string; providerId: string; modelId: string; displayName: string }>): TaskFormData => {
  const firstModel = availableModels[0]
  return {
    name: '',
    description: '',
    prompt: '',
    aiProvider: (firstModel?.providerId as ModelProvider) || 'openai',
    model: firstModel?.modelId || 'gpt-4',
    mcpServers: [],
    scheduleType: 'interval',
    intervalValue: 1,
    intervalUnit: 'hours',
    cronExpression: '0 0 9 * * *',
    executeAt: '',
    timezone: 'Asia/Shanghai',
    enabled: true
  }
}

export function TaskModal({ open, mode, task, onClose, onSubmit }: TaskModalProps) {
  const [loading, setLoading] = useState(false)
  const { providers } = useProviders()
  const { settings } = useSettings()
  
  // 获取可用的 AI 模型
  const availableModels = useMemo(() => {
    const models: Array<{ provider: string; providerId: string; modelId: string; displayName: string }> = []
    providers.forEach(provider => {
      provider.models?.forEach(model => {
        models.push({
          provider: provider.name,
          providerId: provider.id,
          modelId: model.modelId,
          displayName: `${provider.name} / ${model.nickname || model.modelId}`
        })
      })
    })
    return models
  }, [providers])
  
  // 获取可用的 MCP 服务器
  const availableMCPServers = useMemo(() => {
    const servers: string[] = []
    
    // 添加内置服务器
    settings.mcp?.enabledBuiltinServers?.forEach(serverId => {
      servers.push(serverId)
    })
    
    // 添加自定义服务器
    settings.mcp?.servers?.forEach(server => {
      if (server.enabled) {
        servers.push(server.name || server.id)
      }
    })
    
    return servers
  }, [settings.mcp])
  
  const defaultValues = useMemo(() => getDefaultValues(availableModels), [availableModels])
  
  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TaskFormData>({
    defaultValues
  })
  
  const scheduleType = watch('scheduleType')
  
  useEffect(() => {
    if (task && mode === 'edit') {
      // 填充编辑数据
      const formData: TaskFormData = {
        name: task.name,
        description: task.description || '',
        prompt: task.prompt,
        aiProvider: task.aiProvider,
        model: task.model,
        mcpServers: task.mcpServers,
        scheduleType: task.schedule.type,
        intervalValue: task.schedule.interval?.value || 1,
        intervalUnit: task.schedule.interval?.unit || 'hours',
        cronExpression: task.schedule.cron || '0 0 9 * * *',
        executeAt: task.schedule.executeAt ? new Date(task.schedule.executeAt).toISOString().slice(0, 16) : '',
        timezone: task.schedule.timezone || 'Asia/Shanghai',
        enabled: task.enabled
      }
      reset(formData)
    } else {
      reset(getDefaultValues(availableModels))
    }
  }, [task, mode, reset])
  
  const onFormSubmit = async (data: TaskFormData) => {
    setLoading(true)
    try {
      const schedule: TaskSchedule = {
        type: data.scheduleType,
        timezone: data.timezone
      }
      
      switch (data.scheduleType) {
        case 'interval':
          schedule.interval = {
            value: data.intervalValue,
            unit: data.intervalUnit
          }
          break
        case 'cron':
          schedule.cron = data.cronExpression
          break
        case 'once':
          schedule.executeAt = new Date(data.executeAt)
          break
      }
      
      const taskData = {
        name: data.name,
        description: data.description,
        prompt: data.prompt,
        aiProvider: data.aiProvider,
        model: data.model,
        mcpServers: data.mcpServers,
        schedule,
        enabled: data.enabled
      }
      
      await onSubmit(taskData)
    } catch (error) {
      console.error('Failed to save task:', error)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === 'create' ? '创建定时任务' : '编辑定时任务'}
      </DialogTitle>
      
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogContent>
          <Grid container spacing={3}>
            {/* 基本信息 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                基本信息
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="name"
                control={control}
                rules={{ required: '任务名称不能为空' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="任务名称"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="enabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="启用任务"
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="任务描述"
                    fullWidth
                    multiline
                    rows={2}
                  />
                )}
              />
            </Grid>
            
            {/* AI 配置 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                AI 配置
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Controller
                name="model"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>AI 模型</InputLabel>
                    <Select 
                      {...field} 
                      label="AI 模型"
                      value={field.value ? `${watch('aiProvider')}/${field.value}` : ''}
                      onChange={(e) => {
                        const [providerId, modelId] = e.target.value.split('/')
                        setValue('aiProvider', providerId as ModelProvider)
                        field.onChange(modelId)
                      }}
                    >
                      {availableModels.map((model) => (
                        <MenuItem 
                          key={`${model.providerId}/${model.modelId}`} 
                          value={`${model.providerId}/${model.modelId}`}
                        >
                          {model.displayName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Controller
                name="prompt"
                control={control}
                rules={{ required: '提示词不能为空' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="提示词"
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="输入要执行的提示词..."
                    error={!!errors.prompt}
                    helperText={errors.prompt?.message}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Controller
                name="mcpServers"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    multiple
                    options={availableMCPServers}
                    value={field.value}
                    onChange={(_, value) => field.onChange(value)}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="MCP 服务器"
                        placeholder="选择要使用的 MCP 服务器"
                      />
                    )}
                  />
                )}
              />
            </Grid>
            
            {/* 调度配置 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                调度配置
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Controller
                name="scheduleType"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>调度类型</InputLabel>
                    <Select {...field} label="调度类型">
                      <MenuItem value="interval">间隔执行</MenuItem>
                      <MenuItem value="cron">Cron 表达式</MenuItem>
                      <MenuItem value="once">一次性任务</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            
            {scheduleType === 'interval' && (
              <>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="intervalValue"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="间隔数值"
                        type="number"
                        fullWidth
                        inputProps={{ min: 1 }}
                      />
                    )}
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="intervalUnit"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>时间单位</InputLabel>
                        <Select {...field} label="时间单位">
                          <MenuItem value="minutes">分钟</MenuItem>
                          <MenuItem value="hours">小时</MenuItem>
                          <MenuItem value="days">天</MenuItem>
                          <MenuItem value="weeks">周</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              </>
            )}
            
            {scheduleType === 'cron' && (
              <Grid item xs={12} sm={8}>
                <Controller
                  name="cronExpression"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Cron 表达式"
                      fullWidth
                      placeholder="例如: 0 0 9 * * * (每天9点)"
                      helperText="格式: 秒 分 时 日 月 周年"
                    />
                  )}
                />
              </Grid>
            )}
            
            {scheduleType === 'once' && (
              <Grid item xs={12} sm={8}>
                <Controller
                  name="executeAt"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="执行时间"
                      type="datetime-local"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
            )}
            

          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose}>
            取消
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            {loading ? '保存中...' : mode === 'create' ? '创建' : '保存'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}