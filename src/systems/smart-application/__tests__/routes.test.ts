/**
 * Integration tests for smart-application routes.
 *
 * Spins up an Express app with only the smart-application router,
 * mocks the sessionGuard middleware to inject a fake user,
 * and mocks the service + downstream dependencies.
 */

import { jest } from '@jest/globals'
import express, { Express } from 'express'
import request from 'supertest'

// ---------- Mocks ----------

// Inject a fake user into req.user so the routes that read (req as any).user.id work.
jest.mock('../../identity/sessionGuard', () => ({
  sessionGuard: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1' }
    next()
  },
}))

// Mock the service module's factory so getSmartApplicationService() returns a stub.
const mockService = {
  createApplication: jest.fn() as any,
  createBulkApplications: jest.fn() as any,
}

jest.mock('../index', () => {
  return {
    SmartApplicationService: jest.fn(),
    getSmartApplicationService: () => mockService,
  }
})

jest.mock('../../../models/Application', () => {
  const findOne = jest.fn()
  function ApplicationMock(this: any, doc: any) {
    Object.assign(this, doc)
    this._id = { toString: () => 'app-record-id' }
    this.save = jest.fn().mockResolvedValue(this)
  }
  ;(ApplicationMock as any).findOne = findOne
  return { Application: ApplicationMock }
})

jest.mock('../../career-data/profileService', () => ({
  getFullProfile: jest.fn(),
}))

jest.mock('../exportManager', () => ({
  exportManager: {
    exportApplication: jest.fn(),
    getExportFolder: jest.fn((c: string) => `/tmp/applications/${c}`),
  },
}))

jest.mock('../responseParser', () => ({
  ResponseParser: { parseSingle: jest.fn(), parseBulk: jest.fn(), calculateScores: jest.fn() },
}))

// ---------- Imports (after mocks) ----------

import smartAppRoutes from '../routes'
import { Application } from '../../../models/Application'
import { getFullProfile } from '../../career-data/profileService'
import { exportManager } from '../exportManager'

// ---------- Test app factory ----------

function makeApp(): Express {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/applications', smartAppRoutes)
  // Mirror the production error handler so AppError → proper HTTP status.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorHandler } = require('../../../middleware/errorHandler')
  app.use(errorHandler)
  return app
}

// ---------- Helpers ----------

const sampleSmartResult = {
  applicationId: 'app-1',
  output: {
    analysis: { company: 'Acme', role: 'Engineer' },
    resume: { markdown: 'md' },
    email: { subject: 's', body: 'b', tone: 'professional' },
    coverLetter: 'cl',
    validationHints: { atsKeywordsToInclude: [], truthFlags: [], humanizationTips: [] },
  },
  exportPath: '/tmp/applications/Acme/x.pdf',
  scores: { ats: 90, match: 80, overall: 84 },
}

// ---------- Tests ----------

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/v1/applications/smart-create', () => {
  it('returns 201 with applicationId on success', async () => {
    mockService.createApplication.mockResolvedValue(sampleSmartResult)
    const app = makeApp()

    const res = await request(app)
      .post('/api/v1/applications/smart-create')
      .send({ jdText: 'A JD with plenty of text to pass the min(50) validator in the schema.' })

    expect(res.status).toBe(201)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.applicationId).toBe('app-1')
    expect(res.body.data.scores.overall).toBe(84)
    expect(mockService.createApplication).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when jdText is missing', async () => {
    const app = makeApp()

    const res = await request(app)
      .post('/api/v1/applications/smart-create')
      .send({})

    expect(res.status).toBe(400)
    expect(mockService.createApplication).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/applications/bulk-create', () => {
  it('returns 201 with results array', async () => {
    mockService.createBulkApplications.mockResolvedValue({
      jobId: 'bulk-1',
      results: [sampleSmartResult, sampleSmartResult],
    })
    const app = makeApp()

    const jds = [
      {
        company: 'Acme',
        role: 'Engineer',
        jdText: 'A JD with plenty of text to pass the min(50) validator in the schema.',
      },
      {
        company: 'Beta',
        role: 'Senior Engineer',
        jdText: 'Another JD with plenty of text to pass the min(50) validator in the schema.',
      },
    ]

    const res = await request(app)
      .post('/api/v1/applications/bulk-create')
      .send({ jds })

    expect(res.status).toBe(201)
    expect(res.body.data.results).toHaveLength(2)
    expect(mockService.createBulkApplications).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when jds is missing', async () => {
    const app = makeApp()

    const res = await request(app)
      .post('/api/v1/applications/bulk-create')
      .send({})

    expect(res.status).toBe(400)
    expect(mockService.createBulkApplications).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/applications/:id/export-all', () => {
  it('returns 200 with files array', async () => {
    const appRecord: any = {
      _id: { toString: () => 'app-record-id' },
      company: 'Acme',
      role: 'Engineer',
      emailContent: { subject: 's', body: 'b', tone: 'professional' },
      coverLetterContent: 'cl',
      scores: { ats: 90, match: 80, overall: 84 },
      exportHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    }
    ;(Application.findOne as jest.Mock).mockResolvedValue(appRecord)
    ;(getFullProfile as jest.Mock).mockResolvedValue({
      personal: { name: 'Test User' },
      experiences: [],
      projects: [],
      skills: [],
      education: [],
      certificates: [],
    })
    ;(exportManager.exportApplication as jest.Mock).mockResolvedValue([
      { format: 'pdf', path: '/tmp/applications/Acme/x.pdf', filename: 'x.pdf' },
      { format: 'docx', path: '/tmp/applications/Acme/x.docx', filename: 'x.docx' },
    ])

    const app = makeApp()
    const res = await request(app).get('/api/v1/applications/app-record-id/export-all')

    expect(res.status).toBe(200)
    expect(res.body.data.files).toHaveLength(2)
    expect(res.body.data.files[0].format).toBe('pdf')
    expect(exportManager.exportApplication).toHaveBeenCalledTimes(1)
  })

  it('returns 404 when application not found', async () => {
    ;(Application.findOne as jest.Mock).mockResolvedValue(null)
    const app = makeApp()

    const res = await request(app).get('/api/v1/applications/missing-id/export-all')

    expect(res.status).toBe(404)
  })
})
