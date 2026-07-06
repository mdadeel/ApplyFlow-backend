import { jest } from '@jest/globals'

jest.mock('../../../models/ApplicationWorkspace', () => ({
  ApplicationWorkspace: {
    find: jest.fn(),
  },
}))

jest.mock('../../../models/Opportunity', () => ({
  Opportunity: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}))

jest.mock('../../../models/Contribution', () => ({
  Contribution: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}))

jest.mock('../../../models/MatchResult', () => ({
  MatchResult: {
    aggregate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}))

jest.mock('../../../models/User', () => ({
  User: {
    countDocuments: jest.fn(),
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
const analyticsRoutes = require('../routes').default

function makeApp(): import('express').Express {
  const app = express()
  app.use(express.json())
  app.use('/api/analytics/community', analyticsRoutes)
  const { errorHandler } = require('../../../middleware/errorHandler')
  app.use(errorHandler)
  return app
}

const mockAppWorkspaceFind = require('../../../models/ApplicationWorkspace').ApplicationWorkspace.find
const mockOppCount = require('../../../models/Opportunity').Opportunity.countDocuments
const mockOppFind = require('../../../models/Opportunity').Opportunity.find
const mockContribCount = require('../../../models/Contribution').Contribution.countDocuments
const mockContribFind = require('../../../models/Contribution').Contribution.find
const mockMatchAggregate = require('../../../models/MatchResult').MatchResult.aggregate
const mockUserCount = require('../../../models/User').User.countDocuments

beforeEach(() => {
  jest.clearAllMocks()

  const leanChainable = (val: any) => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(val),
  })

  mockAppWorkspaceFind.mockReturnValue(leanChainable([]))
  mockOppCount.mockResolvedValue(0)
  mockOppFind.mockReturnValue(leanChainable([]))
  mockContribCount.mockResolvedValue(0)
  mockContribFind.mockReturnValue(leanChainable([]))
  mockMatchAggregate.mockResolvedValue([])
  mockUserCount.mockResolvedValue(0)
})

describe('GET /api/analytics/community/dashboard', () => {
  it('returns 200 with dashboard data', async () => {
    mockOppCount.mockResolvedValue(42)
    mockContribCount.mockResolvedValue(17)
    mockUserCount.mockResolvedValue(8)
    mockMatchAggregate.mockResolvedValue([{ avg: 0.75 }])
    mockOppFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { company: 'Google', requiredSkills: ['TypeScript'], preferredSkills: ['AWS'] },
        { company: 'Meta', requiredSkills: ['React'], preferredSkills: ['GraphQL'] },
      ]),
    })

    const app = makeApp()
    const res = await request(app).get('/api/analytics/community/dashboard')

    expect(res.status).toBe(200)
    expect(res.body.data.totalOpportunities).toBe(42)
    expect(res.body.data.totalContributions).toBe(17)
    expect(res.body.data.activeUsers).toBe(8)
    expect(res.body.data.averageMatchScore).toBe(0.75)
    expect(res.body.data.topCompanies).toHaveLength(2)
  })
})

describe('GET /api/analytics/community/success-rate', () => {
  it('returns 200 with aggregated data', async () => {
    const workspace = {
      _id: 'ws-1',
      status: 'submitted',
      opportunityId: {
        _id: 'opp-1',
        roleLevel: 'senior',
        company: 'Google',
        title: 'Senior Engineer',
      },
    }
    mockAppWorkspaceFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([workspace]),
    })

    const app = makeApp()
    const res = await request(app).get('/api/analytics/community/success-rate')

    expect(res.status).toBe(200)
    expect(res.body.data.totalApplications).toBe(1)
    expect(res.body.data.byRoleLevel.senior.count).toBe(1)
    expect(res.body.data.byCompany.Google.count).toBe(1)
  })
})

describe('GET /api/analytics/community/success-rate with filters', () => {
  it('passes query params to service', async () => {
    mockAppWorkspaceFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    })

    const app = makeApp()
    const res = await request(app)
      .get('/api/analytics/community/success-rate')
      .query({ roleLevel: 'senior', company: 'Google', days: '30' })

    expect(res.status).toBe(200)
  })
})

describe('GET /api/analytics/community/skill-trends', () => {
  it('returns 200 with skill data', async () => {
    mockOppFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: 'opp-1', requiredSkills: ['React', 'Node'], company: 'C1', roleLevel: 'senior' },
        { _id: 'opp-2', requiredSkills: ['React', 'Python'], company: 'C2', roleLevel: 'mid' },
      ]),
    })

    const app = makeApp()
    const res = await request(app).get('/api/analytics/community/skill-trends')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.topSkills)).toBe(true)
    expect(res.body.data.totalOpportunities).toBe(2)
  })
})

describe('GET /api/analytics/community/community-impact', () => {
  it('returns 200 with impact data', async () => {
    mockContribFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: 'c1', type: 'resume_template' },
        { _id: 'c2', type: 'cover_letter_template' },
      ]),
    })

    const app = makeApp()
    const res = await request(app).get('/api/analytics/community/community-impact')

    expect(res.status).toBe(200)
    expect(res.body.data.totalContributions).toBe(2)
  })
})
