// S4 Task Tracker Service
//
// Per-application free-form tasks (distinct from the workflow `tasks`
// array on the Application schema). Tasks live as sub-documents on the
// owning Application document so authorization, ownership and limits
// are all enforced at the parent boundary.

import mongoose from 'mongoose'
import { Application, ITrackerTask, TrackerTaskStatus, TrackerTaskPriority } from '../../models/Application'

export const MAX_TRACKER_TASKS_PER_APPLICATION = 200

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TrackerTaskStatus
  priority?: TrackerTaskPriority
  dueDate?: Date
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TrackerTaskStatus
  priority?: TrackerTaskPriority
  dueDate?: Date
}

export class NotFoundError extends Error {
  constructor(message = 'Application not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class TaskNotFoundError extends Error {
  constructor(message = 'Task not found') {
    super(message)
    this.name = 'TaskNotFoundError'
  }
}

export class TaskLimitError extends Error {
  limit: number
  constructor(limit: number) {
    super(`Task limit reached: max ${limit} tasks per application`)
    this.name = 'TaskLimitError'
    this.limit = limit
  }
}

/**
 * Load the owned application. Returns `null` if it does not exist OR if
 * it belongs to a different user — callers map that to 404 to avoid
 * leaking the existence of other users' records.
 */
async function loadOwnedApplication(
  applicationId: string,
  userId: string,
) {
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    throw new NotFoundError()
  }
  return Application.findOne({ _id: applicationId, userId })
}

export async function getTasks(
  applicationId: string,
  userId: string,
): Promise<ITrackerTask[]> {
  const app = await loadOwnedApplication(applicationId, userId)
  if (!app) throw new NotFoundError()
  // `trackerTasks` is defined as optional on the interface; return [] when absent.
  return (app.trackerTasks ?? []) as ITrackerTask[]
}

export async function createTask(
  applicationId: string,
  userId: string,
  input: CreateTaskInput,
): Promise<ITrackerTask> {
  const app = await loadOwnedApplication(applicationId, userId)
  if (!app) throw new NotFoundError()

  const existing = app.trackerTasks ?? []
  if (existing.length >= MAX_TRACKER_TASKS_PER_APPLICATION) {
    throw new TaskLimitError(MAX_TRACKER_TASKS_PER_APPLICATION)
  }

  const status: TrackerTaskStatus = input.status ?? 'todo'
  const now = new Date()
  const newTask = {
    title: input.title,
    description: input.description,
    status,
    priority: input.priority ?? 'medium',
    dueDate: input.dueDate,
    completedAt: status === 'done' ? now : undefined,
  } as ITrackerTask

  // Push directly to the sub-doc array; mongoose will assign _id.
  app.trackerTasks = [...existing, newTask as any]
  await app.save()

  // Return the last entry (the one we just pushed) so the caller gets the
  // assigned _id + timestamps.
  const created = app.trackerTasks![app.trackerTasks!.length - 1]
  return created as ITrackerTask
}

export async function updateTask(
  applicationId: string,
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<ITrackerTask> {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new TaskNotFoundError()
  }

  const app = await loadOwnedApplication(applicationId, userId)
  if (!app) throw new NotFoundError()

  const tasks = app.trackerTasks ?? []
  const idx = tasks.findIndex((t: any) => t._id?.toString() === taskId)
  if (idx === -1) throw new TaskNotFoundError()

  const current = tasks[idx] as any
  const next: any = { ...current }

  if (input.title !== undefined) next.title = input.title
  if (input.description !== undefined) next.description = input.description
  if (input.priority !== undefined) next.priority = input.priority
  if (input.dueDate !== undefined) next.dueDate = input.dueDate
  if (input.status !== undefined) {
    next.status = input.status
    // Business rule: completedAt auto-sets when status becomes 'done',
    // clears when status leaves 'done'.
    if (input.status === 'done') {
      next.completedAt = current.completedAt ?? new Date()
    } else {
      next.completedAt = undefined
    }
  }

  tasks[idx] = next
  app.trackerTasks = tasks as any
  await app.save()

  return app.trackerTasks![idx] as ITrackerTask
}

export async function deleteTask(
  applicationId: string,
  userId: string,
  taskId: string,
): Promise<{ ok: true }> {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new TaskNotFoundError()
  }

  const app = await loadOwnedApplication(applicationId, userId)
  if (!app) throw new NotFoundError()

  const tasks = app.trackerTasks ?? []
  const next = tasks.filter((t: any) => t._id?.toString() !== taskId)
  if (next.length === tasks.length) throw new TaskNotFoundError()

  app.trackerTasks = next as any
  await app.save()
  return { ok: true }
}
