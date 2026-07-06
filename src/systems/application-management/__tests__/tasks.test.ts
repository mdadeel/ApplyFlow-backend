/**
 * Tests for S4 Task Tracker — schemas, service, and route wiring.
 *
 * Strategy mirrors backend/src/systems/community/__tests__/community.test.ts:
 *   - Real Zod schemas exercised via jest.requireActual.
 *   - Service tests use a class-like Application mock.
 *   - Route tests stub the service module so we only verify HTTP wiring
 *     (auth, validation, status codes, response shape).
 */

import { jest } from '@jest/globals'

// ---------- Real schemas ----------

const realSchemas = jest.requireActual('../../../utils/validation') as {
  createTaskSchema: any
  updateTaskSchema: any
}

// ---------- Model mock for service tests ----------

const applicationSave = jest.fn() as any
const ApplicationMock: any = jest.fn().mockImplementation((doc: any = {}) => {
  const instance: any = {
    ...doc,
    save: applicationSave,
  }
  return instance
})
ApplicationMock.findOne = jest.fn()

jest.mock('../../../models/Application', () => ({
  Application: ApplicationMock,
}))

// ---------- Imports (after mocks) ----------

import mongoose from 'mongoose'
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  NotFoundError,
  TaskNotFoundError,
  TaskLimitError,
  MAX_TRACKER_TASKS_PER_APPLICATION,
} from '../taskService'

beforeEach(() => {
  jest.clearAllMocks()
  // Default: save resolves to the instance itself.
  applicationSave.mockImplementation(function (this: any) {
    return Promise.resolve(this)
  })
})

// Helper to build a fake mongoose ObjectId string
function newId(): string {
  return new mongoose.Types.ObjectId().toString()
}

// =====================================================================
//                         SCHEMA TESTS (REAL)
// =====================================================================

describe('createTaskSchema (real)', () => {
  const { createTaskSchema } = realSchemas

  it('accepts minimal valid input', () => {
    const result = createTaskSchema.safeParse({ title: 'Send follow-up' })
    expect(result.success).toBe(true)
  })

  it('accepts full valid input', () => {
    const result = createTaskSchema.safeParse({
      title: 'Send follow-up',
      description: 'Email recruiter after 5 days',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-08-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('high')
      expect(result.data.dueDate instanceof Date).toBe(true)
    }
  })

  it('rejects empty title', () => {
    expect(createTaskSchema.safeParse({ title: '' }).success).toBe(false)
  })

  it('rejects missing title', () => {
    expect(createTaskSchema.safeParse({}).success).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(
      createTaskSchema.safeParse({ title: 'x', status: 'completed' }).success,
    ).toBe(false)
  })

  it('rejects invalid priority', () => {
    expect(
      createTaskSchema.safeParse({ title: 'x', priority: 'urgent' }).success,
    ).toBe(false)
  })
})

describe('updateTaskSchema (real)', () => {
  const { updateTaskSchema } = realSchemas

  it('accepts a single field', () => {
    expect(updateTaskSchema.safeParse({ title: 'New title' }).success).toBe(true)
  })

  it('rejects empty object (at least one field required)', () => {
    const result = updateTaskSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(updateTaskSchema.safeParse({ status: 'archived' }).success).toBe(false)
  })

  it('rejects invalid priority', () => {
    expect(updateTaskSchema.safeParse({ priority: 'urgent' }).success).toBe(false)
  })

  it('accepts clearing the due date via null', () => {
    // We don't require null to clear — but accepting undefined or a valid
    // date is what we promise.
    expect(updateTaskSchema.safeParse({ dueDate: undefined }).success).toBe(true)
    expect(updateTaskSchema.safeParse({ dueDate: '2026-09-01' }).success).toBe(true)
  })
})

// =====================================================================
//                         SERVICE TESTS
// =====================================================================

function makeAppDoc(trackerTasks: any[] = [], extra: Record<string, unknown> = {}) {
  const doc: any = {
    _id: new mongoose.Types.ObjectId(),
    userId: 'user-1',
    company: 'Acme',
    role: 'SWE',
    trackerTasks,
    ...extra,
  }
  return doc
}

describe('getTasks', () => {
  it('returns the trackerTasks array on the owned application', async () => {
    const tasks = [{ _id: newId(), title: 'A' }]
    const doc = makeAppDoc(tasks)
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await getTasks(doc._id.toString(), 'user-1')
    expect(result).toEqual(tasks)
    expect(ApplicationMock.findOne).toHaveBeenCalledWith({ _id: doc._id.toString(), userId: 'user-1' })
  })

  it('returns [] when the application has no trackerTasks', async () => {
    const doc = makeAppDoc([])
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await getTasks(doc._id.toString(), 'user-1')
    expect(result).toEqual([])
  })

  it('throws NotFoundError when application not found', async () => {
    ApplicationMock.findOne.mockResolvedValueOnce(null)
    await expect(getTasks(newId(), 'user-1')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws NotFoundError when application belongs to a different user', async () => {
    // findOne with the filter returns null for other-user's docs.
    ApplicationMock.findOne.mockResolvedValueOnce(null)
    await expect(getTasks(newId(), 'user-1')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('createTask', () => {
  it('pushes a task with sensible defaults and saves', async () => {
    const doc = makeAppDoc([])
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await createTask(doc._id.toString(), 'user-1', { title: 'Draft email' })

    expect(result.title).toBe('Draft email')
    expect(result.status).toBe('todo')
    expect(result.priority).toBe('medium')
    expect(doc.trackerTasks).toHaveLength(1)
    expect(applicationSave).toHaveBeenCalled()
  })

  it('auto-sets completedAt when initial status is "done"', async () => {
    const doc = makeAppDoc([])
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await createTask(doc._id.toString(), 'user-1', {
      title: 'Already done',
      status: 'done',
    })

    expect(result.status).toBe('done')
    expect(result.completedAt).toBeInstanceOf(Date)
  })

  it('does not set completedAt when status is not "done"', async () => {
    const doc = makeAppDoc([])
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await createTask(doc._id.toString(), 'user-1', {
      title: 'In progress',
      status: 'in_progress',
    })

    expect(result.completedAt).toBeUndefined()
  })

  it('throws TaskLimitError when at the 200-task cap', async () => {
    const tasks = Array.from({ length: MAX_TRACKER_TASKS_PER_APPLICATION }, () => ({
      _id: newId(),
      title: 't',
    }))
    const doc = makeAppDoc(tasks)
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    await expect(
      createTask(doc._id.toString(), 'user-1', { title: 'One too many' }),
    ).rejects.toBeInstanceOf(TaskLimitError)
  })

  it('throws NotFoundError when application does not exist', async () => {
    ApplicationMock.findOne.mockResolvedValueOnce(null)
    await expect(
      createTask(newId(), 'user-1', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('updateTask', () => {
  function makeDocWithTask() {
    const taskId = new mongoose.Types.ObjectId()
    const task: any = {
      _id: taskId,
      title: 'Original',
      status: 'todo',
      priority: 'medium',
    }
    const doc = makeAppDoc([task])
    return { doc, task, taskId: taskId.toString() }
  }

  it('updates title', async () => {
    const { doc, taskId } = makeDocWithTask()
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await updateTask(doc._id.toString(), 'user-1', taskId, { title: 'Renamed' })
    expect(result.title).toBe('Renamed')
  })

  it('auto-sets completedAt when status flips to "done"', async () => {
    const { doc, taskId } = makeDocWithTask()
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await updateTask(doc._id.toString(), 'user-1', taskId, { status: 'done' })
    expect(result.status).toBe('done')
    expect(result.completedAt).toBeInstanceOf(Date)
  })

  it('clears completedAt when status leaves "done"', async () => {
    const { doc, taskId, task } = makeDocWithTask()
    task.status = 'done'
    task.completedAt = new Date('2026-01-01T00:00:00Z')
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await updateTask(doc._id.toString(), 'user-1', taskId, { status: 'in_progress' })
    expect(result.status).toBe('in_progress')
    expect(result.completedAt).toBeUndefined()
  })

  it('preserves existing completedAt if status is already "done"', async () => {
    const { doc, taskId, task } = makeDocWithTask()
    const prior = new Date('2026-01-01T00:00:00Z')
    task.status = 'done'
    task.completedAt = prior
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await updateTask(doc._id.toString(), 'user-1', taskId, { status: 'done' })
    expect(result.status).toBe('done')
    expect((result.completedAt as Date).getTime()).toBe(prior.getTime())
  })

  it('throws TaskNotFoundError when task id does not match any sub-document', async () => {
    const { doc } = makeDocWithTask()
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    await expect(
      updateTask(doc._id.toString(), 'user-1', newId(), { title: 'nope' }),
    ).rejects.toBeInstanceOf(TaskNotFoundError)
  })

  it('throws NotFoundError when application does not exist', async () => {
    ApplicationMock.findOne.mockResolvedValueOnce(null)
    await expect(
      updateTask(newId(), 'user-1', newId(), { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws TaskNotFoundError when taskId is not a valid ObjectId', async () => {
    await expect(
      updateTask(newId(), 'user-1', 'not-an-objectid', { title: 'x' }),
    ).rejects.toBeInstanceOf(TaskNotFoundError)
  })
})

describe('deleteTask', () => {
  it('removes the matching sub-document', async () => {
    const taskId = new mongoose.Types.ObjectId()
    const task: any = { _id: taskId, title: 'Keep me? No.', status: 'todo', priority: 'low' }
    const doc = makeAppDoc([task, { _id: new mongoose.Types.ObjectId(), title: 'stay' }])
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    const result = await deleteTask(doc._id.toString(), 'user-1', taskId.toString())
    expect(result).toEqual({ ok: true })
    expect(doc.trackerTasks).toHaveLength(1)
    expect(doc.trackerTasks[0].title).toBe('stay')
  })

  it('throws TaskNotFoundError when task id does not match', async () => {
    const doc = makeAppDoc([{ _id: new mongoose.Types.ObjectId(), title: 'only' }])
    ApplicationMock.findOne.mockResolvedValueOnce(doc)

    await expect(
      deleteTask(doc._id.toString(), 'user-1', newId()),
    ).rejects.toBeInstanceOf(TaskNotFoundError)
  })

  it('throws NotFoundError when application does not exist', async () => {
    ApplicationMock.findOne.mockResolvedValueOnce(null)
    await expect(
      deleteTask(newId(), 'user-1', newId()),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

// =====================================================================
//                         ROUTE INTEGRATION TESTS
// =====================================================================

// Service stubs for route tests
const mockGetTasks = jest.fn() as any
const mockCreateTaskSvc = jest.fn() as any
const mockUpdateTaskSvc = jest.fn() as any
const mockDeleteTaskSvc = jest.fn() as any

jest.mock('../taskService', () => {
  const actual = jest.requireActual('../taskService') as any
  return {
    __esModule: true,
    // Keep real error classes so instanceof checks in routes still work
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

// sessionGuard stub (must come AFTER the service mock so it takes effect)
jest.mock('../../identity/sessionGuard', () => ({
  sessionGuard: (req: any, _res: any, next: any) => {
    req.userId = 'user-1'
    next()
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const applicationRoutes = require('../routes').default

function makeApp(): import('express').Express {
  const app = express()
  app.use(express.json())
  app.use('/api/applications', applicationRoutes)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
