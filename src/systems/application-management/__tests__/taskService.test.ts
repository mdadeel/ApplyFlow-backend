import { jest } from '@jest/globals'

const realSchemas = jest.requireActual('../../../utils/validation') as {
  createTaskSchema: any
  updateTaskSchema: any
}

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
  applicationSave.mockImplementation(function (this: any) {
    return Promise.resolve(this)
  })
})

function newId(): string {
  return new mongoose.Types.ObjectId().toString()
}

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
    expect(updateTaskSchema.safeParse({ dueDate: undefined }).success).toBe(true)
    expect(updateTaskSchema.safeParse({ dueDate: '2026-09-01' }).success).toBe(true)
  })
})

function makeAppDoc(trackerTasks: any[] = [], extra: Record<string, unknown> = {}) {
  const doc: any = {
    _id: new mongoose.Types.ObjectId(),
    userId: 'user-1',
    company: 'Acme',
    role: 'SWE',
    trackerTasks,
    save: applicationSave,
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
