import { jest } from '@jest/globals'

jest.mock('../../identity/sessionGuard', () => ({
  sessionGuard: (req: any, _res: any, next: any) => {
    req.userId = 'user-1'
    next()
  },
}))

// Schema tests use the real schemas
const realSchemas = jest.requireActual('../workspaceService') as {
  createWorkspaceSchema: any
  generateContentSchema: any
  analyzeSchema: any
}

// Service stubs for route tests
const mockGetWorkspace = jest.fn() as any
const mockCreateWorkspace = jest.fn() as any
const mockUpdateWorkspace = jest.fn() as any
const mockDeleteWorkspace = jest.fn() as any
const mockGenerateContent = jest.fn() as any
const mockAnalyzeWorkspace = jest.fn() as any
const mockSubmitWorkspace = jest.fn() as any
const mockListWorkspaces = jest.fn() as any

jest.mock('../workspaceService', () => ({
  __esModule: true,
  createWorkspaceSchema: {
    safeParse: (x: any) => ({ success: true, data: x }),
  },
  generateContentSchema: {
    safeParse: (x: any) => ({ success: true, data: x }),
  },
  analyzeSchema: {
    safeParse: (x: any) => ({ success: true, data: x }),
  },
  getWorkspace: (...a: unknown[]) => mockGetWorkspace(...a),
  createWorkspace: (...a: unknown[]) => mockCreateWorkspace(...a),
  updateWorkspace: (...a: unknown[]) => mockUpdateWorkspace(...a),
  deleteWorkspace: (...a: unknown[]) => mockDeleteWorkspace(...a),
  generateContent: (...a: unknown[]) => mockGenerateContent(...a),
  analyzeWorkspace: (...a: unknown[]) => mockAnalyzeWorkspace(...a),
  submitWorkspace: (...a: unknown[]) => mockSubmitWorkspace(...a),
  listUserWorkspaces: (...a: unknown[]) => mockListWorkspaces(...a),
}))

const express = require('express')
const request = require('supertest')
const workspaceRoutes = require('../routes').default

function makeApp(): import('express').Express {
  const app = express()
  app.use(express.json())
  app.use('/api/workspaces', workspaceRoutes)
  const { errorHandler } = require('../../../middleware/errorHandler')
  app.use(errorHandler)
  return app
}

const sampleWorkspace = {
  _id: 'ws-1',
  userId: 'user-1',
  opportunityId: 'opp-1',
  status: 'idle',
  isPinned: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Zod schemas (real)', () => {
  const { createWorkspaceSchema, generateContentSchema, analyzeSchema } = realSchemas

  it('createWorkspaceSchema accepts valid input', () => {
    expect(
      createWorkspaceSchema.safeParse({ opportunityId: 'opp-1' }).success,
    ).toBe(true)
  })

  it('createWorkspaceSchema rejects empty opportunityId', () => {
    expect(
      createWorkspaceSchema.safeParse({ opportunityId: '' }).success,
    ).toBe(false)
  })

  it('generateContentSchema accepts valid input', () => {
    expect(
      generateContentSchema.safeParse({ type: 'resume' }).success,
    ).toBe(true)
    expect(
      generateContentSchema.safeParse({ type: 'cover-letter' }).success,
    ).toBe(true)
    expect(
      generateContentSchema.safeParse({ type: 'email' }).success,
    ).toBe(true)
    expect(
      generateContentSchema.safeParse({ type: 'interview-prep' }).success,
    ).toBe(true)
  })

  it('generateContentSchema rejects invalid type', () => {
    expect(
      generateContentSchema.safeParse({ type: 'invalid' }).success,
    ).toBe(false)
  })

  it('analyzeSchema accepts valid input', () => {
    expect(
      analyzeSchema.safeParse({ type: 'ats' }).success,
    ).toBe(true)
    expect(
      analyzeSchema.safeParse({ type: 'skill-gap' }).success,
    ).toBe(true)
  })

  it('analyzeSchema rejects invalid type', () => {
    expect(
      analyzeSchema.safeParse({ type: 'bogus' }).success,
    ).toBe(false)
  })
})

describe('GET /api/workspaces', () => {
  it('returns 200 with workspace list', async () => {
    mockListWorkspaces.mockResolvedValue([sampleWorkspace])

    const app = makeApp()
    const res = await request(app).get('/api/workspaces')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('GET /api/workspaces/:id', () => {
  it('returns 200 when found', async () => {
    mockGetWorkspace.mockResolvedValue(sampleWorkspace)

    const app = makeApp()
    const res = await request(app).get('/api/workspaces/ws-1')

    expect(res.status).toBe(200)
    expect(res.body.data._id).toBe('ws-1')
  })

  it('returns 404 when missing', async () => {
    mockGetWorkspace.mockRejectedValue(new Error('Workspace not found'))

    const app = makeApp()
    const res = await request(app).get('/api/workspaces/missing')

    expect(res.status).toBe(404)
  })
})

describe('POST /api/workspaces', () => {
  it('returns 201 on creation', async () => {
    mockCreateWorkspace.mockResolvedValue({ ...sampleWorkspace, _id: 'ws-new' })

    const app = makeApp()
    const res = await request(app)
      .post('/api/workspaces')
      .send({ opportunityId: 'opp-1' })

    expect(res.status).toBe(201)
    expect(res.body.data._id).toBe('ws-new')
  })

  it('returns 404 when opportunity missing', async () => {
    mockCreateWorkspace.mockRejectedValue(new Error('Opportunity not found'))

    const app = makeApp()
    const res = await request(app)
      .post('/api/workspaces')
      .send({ opportunityId: 'opp-missing' })

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/workspaces/:id', () => {
  it('returns 200 on update', async () => {
    mockUpdateWorkspace.mockResolvedValue({ ...sampleWorkspace, isPinned: true })

    const app = makeApp()
    const res = await request(app)
      .put('/api/workspaces/ws-1')
      .send({ isPinned: true })

    expect(res.status).toBe(200)
    expect(res.body.data.isPinned).toBe(true)
  })

  it('returns 404 when missing', async () => {
    mockUpdateWorkspace.mockRejectedValue(new Error('Workspace not found'))

    const app = makeApp()
    const res = await request(app)
      .put('/api/workspaces/missing')
      .send({ isPinned: true })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/workspaces/:id', () => {
  it('returns 200 on deletion', async () => {
    mockDeleteWorkspace.mockResolvedValue(sampleWorkspace)

    const app = makeApp()
    const res = await request(app).delete('/api/workspaces/ws-1')

    expect(res.status).toBe(200)
  })

  it('returns 404 when missing', async () => {
    mockDeleteWorkspace.mockRejectedValue(new Error('Workspace not found'))

    const app = makeApp()
    const res = await request(app).delete('/api/workspaces/missing')

    expect(res.status).toBe(404)
  })
})

describe('POST /api/workspaces/:id/submit', () => {
  it('returns 200 on submit', async () => {
    mockSubmitWorkspace.mockResolvedValue({ ...sampleWorkspace, status: 'submitted' })

    const app = makeApp()
    const res = await request(app).post('/api/workspaces/ws-1/submit')

    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid transition', async () => {
    mockSubmitWorkspace.mockRejectedValue(new Error('Invalid status transition: idle → submitted'))

    const app = makeApp()
    const res = await request(app).post('/api/workspaces/ws-1/submit')

    expect(res.status).toBe(400)
  })
})
