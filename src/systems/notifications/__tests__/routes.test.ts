import { jest } from '@jest/globals'

const mockFind = jest.fn() as any
const mockFindOneAndUpdate = jest.fn() as any
const mockCountDocuments = jest.fn() as any
const mockCreate = jest.fn() as any
const mockUpdateMany = jest.fn() as any

jest.mock('../../../models/Notification', () => ({
  Notification: {
    find: (...a: unknown[]) => mockFind(...a),
    findOneAndUpdate: (...a: unknown[]) => mockFindOneAndUpdate(...a),
    countDocuments: (...a: unknown[]) => mockCountDocuments(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    updateMany: (...a: unknown[]) => mockUpdateMany(...a),
  },
}))

jest.mock('../../identity/sessionGuard', () => ({
  sessionGuard: (req: any, _res: any, next: any) => {
    req.userId = 'user-1'
    next()
  },
}))

const express = require('express')
const request = require('supertest')
const notificationRoutes = require('../routes').default

function makeApp(): import('express').Express {
  const app = express()
  app.use(express.json())
  app.use('/api/notifications', notificationRoutes)
  const { errorHandler } = require('../../../middleware/errorHandler')
  app.use(errorHandler)
  return app
}

const sampleNotification = {
  _id: 'notif-1',
  userId: 'user-1',
  type: 'status_change',
  title: 'Application Updated',
  message: 'Your application has moved to the next stage.',
  read: false,
  dismissed: false,
  link: '/applications/app-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  jest.clearAllMocks()
  const chainable = (val: any) => ({
    sort: () => chainable(val),
    limit: () => chainable(val),
    lean: jest.fn().mockResolvedValue(val),
  })
  mockFind.mockReturnValue(chainable([]))
  mockFindOneAndUpdate.mockResolvedValue(null)
  mockCountDocuments.mockResolvedValue(0)
  mockCreate.mockResolvedValue(null)
  mockUpdateMany.mockResolvedValue({ modifiedCount: 0 })
})

describe('GET /api/notifications', () => {
  it('returns 200 with notification list and unread count', async () => {
    mockFind.mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: jest.fn().mockResolvedValue([sampleNotification]),
        }),
      }),
    })
    mockCountDocuments.mockResolvedValue(1)

    const app = makeApp()
    const res = await request(app).get('/api/notifications')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].title).toBe('Application Updated')
    expect(res.body.data.unreadCount).toBe(1)
  })

  it('returns empty list when no notifications', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/notifications')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(0)
    expect(res.body.data.unreadCount).toBe(0)
  })
})

describe('PUT /api/notifications/:id/read', () => {
  it('returns 200 with updated notification', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ ...sampleNotification, read: true })

    const app = makeApp()
    const res = await request(app).put('/api/notifications/notif-1/read')

    expect(res.status).toBe(200)
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'notif-1', userId: 'user-1' },
      { $set: { read: true } },
      { new: true },
    )
  })

  it('returns 404 when notification missing', async () => {
    const app = makeApp()
    const res = await request(app).put('/api/notifications/missing/read')

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })
})

describe('PUT /api/notifications/:id/dismiss', () => {
  it('returns 200 with dismissed notification', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ ...sampleNotification, dismissed: true })

    const app = makeApp()
    const res = await request(app).put('/api/notifications/notif-1/dismiss')

    expect(res.status).toBe(200)
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'notif-1', userId: 'user-1' },
      { $set: { dismissed: true } },
      { new: true },
    )
  })

  it('returns 404 when notification missing', async () => {
    const app = makeApp()
    const res = await request(app).put('/api/notifications/missing/dismiss')

    expect(res.status).toBe(404)
  })
})

describe('POST /api/notifications', () => {
  it('returns 201 when created', async () => {
    mockCreate.mockResolvedValue({ ...sampleNotification, _id: 'notif-new' })

    const app = makeApp()
    const res = await request(app)
      .post('/api/notifications')
      .send({
        type: 'feature',
        title: 'New Feature',
        message: 'Check out the new dashboard.',
      })

    expect(res.status).toBe(201)
    expect(res.body.data._id).toBe('notif-new')
  })

  it('returns 400 when missing required fields', async () => {
    const app = makeApp()
    const res = await request(app)
      .post('/api/notifications')
      .send({ type: 'feature' })

    expect(res.status).toBe(400)
  })
})

describe('PUT /api/notifications/read-all', () => {
  it('returns 200 with ok:true', async () => {
    mockUpdateMany.mockResolvedValue({ modifiedCount: 3 })

    const app = makeApp()
    const res = await request(app).put('/api/notifications/read-all')

    expect(res.status).toBe(200)
    expect(res.body.data.ok).toBe(true)
  })
})
