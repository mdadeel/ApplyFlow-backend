import { jest } from '@jest/globals'
import {
  NotFoundError,
  TaskNotFoundError,
  TaskLimitError,
} from '../taskService'

const mockGetTasks = jest.fn() as any
const mockCreateTaskSvc = jest.fn() as any
const mockUpdateTaskSvc = jest.fn() as any
const mockDeleteTaskSvc = jest.fn() as any

jest.mock('../taskService', () => {
  const actual = jest.requireActual('../taskService') as any
  return {
    __esModule: true,
    NotFoundError: actual.NotFoundError,
    TaskNotFoundError: actual.TaskNotFoundError,
    TaskLimitError: actual.TaskLimitError,
    MAX_TRACKER_TASKS_PER_APPLICATION: actual.MAX_TRACKER_TASKS_PER_APPLICATION,
    getTasks: (...a: unknown[]) => mockGetTasks(...a),
    createTask: (...a: unknown[]) => mockCreateTaskSvc(...a),
    updateTask: (...a: unknown[]) => mockUpdateTaskSvc(...a),
    deleteTask: (...a: unknown[]) => mockDeleteTaskSvc(...a),
  }
})

jest.mock('../../identity/sessionGuard', () => ({
  sessionGuard: (req: any, _res: any, next: any) => {
    req.userId = 'user-1'
    next()
  },
}))

const express = require('express')
const request = require('supertest')
const applicationRoutes = require('../routes').default

function makeApp(): import('express').Express {
  const app = express()
  app.use(express.json())
  app.use('/api/applications', applicationRoutes)
  const { errorHandler } = require('../../../middleware/errorHandler')
  app.use(errorHandler)
  return app
}

const sampleTask = {
  _id: '64b000000000000000000001',
  title: 'Send follow-up email',
  description: 'Wait 5 days then ping recruiter',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-08-01T00:00:00.000Z',
  completedAt: null,
}

const appId = '64b0000000000000000000aa'
const taskId = '64b000000000000000000001'

describe('GET /api/applications/:id/tasks', () => {
  it('returns 200 with tasks', async () => {
    mockGetTasks.mockResolvedValue([sampleTask])
    const app = makeApp()
    const res = await request(app).get(`/api/applications/${appId}/tasks`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([sampleTask])
    expect(mockGetTasks).toHaveBeenCalledWith(appId, 'user-1')
  })

  it('returns 404 when application is missing', async () => {
    mockGetTasks.mockRejectedValue(new NotFoundError('Application not found'))
    const app = makeApp()
    const res = await request(app).get(`/api/applications/${appId}/tasks`)
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })
})

describe('POST /api/applications/:id/tasks', () => {
  it('returns 201 on success', async () => {
    mockCreateTaskSvc.mockResolvedValue({ ...sampleTask, _id: '64b000000000000000000099' })
    const app = makeApp()
    const res = await request(app)
      .post(`/api/applications/${appId}/tasks`)
      .send({ title: 'New task' })
    expect(res.status).toBe(201)
    expect(res.body.data._id).toBe('64b000000000000000000099')
  })

  it('returns 400 on validation failure (missing title)', async () => {
    const app = makeApp()
    const res = await request(app)
      .post(`/api/applications/${appId}/tasks`)
      .send({})
    expect(res.status).toBe(400)
    expect(mockCreateTaskSvc).not.toHaveBeenCalled()
  })

  it('returns 400 on validation failure (invalid status)', async () => {
    const app = makeApp()
    const res = await request(app)
      .post(`/api/applications/${appId}/tasks`)
      .send({ title: 'x', status: 'archived' })
    expect(res.status).toBe(400)
    expect(mockCreateTaskSvc).not.toHaveBeenCalled()
  })

  it('returns 400 when the 200-task limit is reached', async () => {
    mockCreateTaskSvc.mockRejectedValue(new TaskLimitError(200))
    const app = makeApp()
    const res = await request(app)
      .post(`/api/applications/${appId}/tasks`)
      .send({ title: 'one too many' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/limit/i)
  })

  it('returns 404 when application is missing', async () => {
    mockCreateTaskSvc.mockRejectedValue(new NotFoundError())
    const app = makeApp()
    const res = await request(app)
      .post(`/api/applications/${appId}/tasks`)
      .send({ title: 'x' })
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/applications/:id/tasks/:taskId', () => {
  it('returns 200 on success', async () => {
    mockUpdateTaskSvc.mockResolvedValue({ ...sampleTask, status: 'done', completedAt: new Date().toISOString() })
    const app = makeApp()
    const res = await request(app)
      .put(`/api/applications/${appId}/tasks/${taskId}`)
      .send({ status: 'done' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('done')
  })

  it('returns 400 when body is empty (business rule)', async () => {
    const app = makeApp()
    const res = await request(app)
      .put(`/api/applications/${appId}/tasks/${taskId}`)
      .send({})
    expect(res.status).toBe(400)
    expect(mockUpdateTaskSvc).not.toHaveBeenCalled()
  })

  it('returns 404 when application missing', async () => {
    mockUpdateTaskSvc.mockRejectedValue(new NotFoundError())
    const app = makeApp()
    const res = await request(app)
      .put(`/api/applications/${appId}/tasks/${taskId}`)
      .send({ title: 'x' })
    expect(res.status).toBe(404)
  })

  it('returns 404 when task missing', async () => {
    mockUpdateTaskSvc.mockRejectedValue(new TaskNotFoundError())
    const app = makeApp()
    const res = await request(app)
      .put(`/api/applications/${appId}/tasks/${taskId}`)
      .send({ title: 'x' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/applications/:id/tasks/:taskId', () => {
  it('returns 200 on success', async () => {
    mockDeleteTaskSvc.mockResolvedValue({ ok: true })
    const app = makeApp()
    const res = await request(app).delete(`/api/applications/${appId}/tasks/${taskId}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ ok: true })
  })

  it('returns 404 when task missing', async () => {
    mockDeleteTaskSvc.mockRejectedValue(new TaskNotFoundError())
    const app = makeApp()
    const res = await request(app).delete(`/api/applications/${appId}/tasks/${taskId}`)
    expect(res.status).toBe(404)
  })

  it('returns 404 when application missing', async () => {
    mockDeleteTaskSvc.mockRejectedValue(new NotFoundError())
    const app = makeApp()
    const res = await request(app).delete(`/api/applications/${appId}/tasks/${taskId}`)
    expect(res.status).toBe(404)
  })
})
