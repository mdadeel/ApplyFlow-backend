/**
 * Tests for Community routes.
 *
 * Strategy: jest.mock the service module to inject stubs and verify
 * request/response wiring + auth + validation failures.
 */

import { jest } from '@jest/globals'

// Service stub for routes tests
const mockListTemplates = jest.fn() as any
const mockGetTemplate = jest.fn() as any
const mockCreateTemplateSvc = jest.fn() as any
const mockLikeTemplateSvc = jest.fn() as any
const mockDownloadTemplateSvc = jest.fn() as any
const mockListReferrals = jest.fn() as any
const mockCreateReferral = jest.fn() as any
const mockClaimReferralSvc = jest.fn() as any
const mockListPosts = jest.fn() as any
const mockCreatePostSvc = jest.fn() as any
const mockLikePostSvc = jest.fn() as any

jest.mock('../communityService', () => ({
  __esModule: true,
  templateCreateSchema: {
    safeParse: (x: any) => ({ success: true, data: x }),
  },
  referralCreateSchema: {
    safeParse: (x: any) => ({ success: true, data: x }),
  },
  postCreateSchema: {
    safeParse: (x: any) => ({ success: true, data: x }),
  },
  listTemplates: (...a: unknown[]) => mockListTemplates(...a),
  getTemplate: (...a: unknown[]) => mockGetTemplate(...a),
  createTemplate: (...a: unknown[]) => mockCreateTemplateSvc(...a),
  likeTemplate: (...a: unknown[]) => mockLikeTemplateSvc(...a),
  downloadTemplate: (...a: unknown[]) => mockDownloadTemplateSvc(...a),
  listReferrals: (...a: unknown[]) => mockListReferrals(...a),
  createReferralRequest: (...a: unknown[]) => mockCreateReferral(...a),
  claimReferral: (...a: unknown[]) => mockClaimReferralSvc(...a),
  listPosts: (...a: unknown[]) => mockListPosts(...a),
  createPost: (...a: unknown[]) => mockCreatePostSvc(...a),
  likePost: (...a: unknown[]) => mockLikePostSvc(...a),
}))

jest.mock('../../identity/sessionGuard', () => ({
  sessionGuard: (req: any, _res: any, next: any) => {
    req.userId = 'user-1'
    next()
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express')
const request = require('supertest')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const communityRoutes = require('../routes').default

function makeApp(): import('express').Express {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/community', communityRoutes)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorHandler } = require('../../../middleware/errorHandler')
  app.use(errorHandler)
  return app
}

const sampleTemplate = {
  _id: 'tmpl-1',
  userId: 'user-1',
  title: 'Senior Frontend Resume',
  description: 'A solid resume for senior frontend roles.',
  type: 'resume',
  content: '## Summary\nProactive engineer.',
  tags: ['frontend', 'senior'],
  likes: 5,
  downloads: 12,
  likedBy: ['user-2'],
  isPublished: true,
}

const sampleReferral = {
  _id: 'ref-1',
  userId: 'user-1',
  company: 'Google',
  role: 'Senior SWE',
  message: 'I would appreciate a referral for the L5 role.',
  tags: ['remote'],
  status: 'open',
}

const samplePost = {
  _id: 'post-1',
  userId: 'user-1',
  title: 'How to prep for Stripe interviews',
  body: 'Long body content here...',
  category: 'interview',
  tags: ['stripe'],
  likes: 3,
  replies: 0,
}

describe('GET /api/v1/community/templates', () => {
  it('returns 200 with template list', async () => {
    mockListTemplates.mockResolvedValue([sampleTemplate])
    const app = makeApp()
    const res = await request(app).get('/api/v1/community/templates')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].title).toBe('Senior Frontend Resume')
  })
})

describe('GET /api/v1/community/templates/:id', () => {
  it('returns 200 with single template', async () => {
    mockGetTemplate.mockResolvedValue(sampleTemplate)
    const app = makeApp()
    const res = await request(app).get('/api/v1/community/templates/tmpl-1')
    expect(res.status).toBe(200)
    expect(res.body.data._id).toBe('tmpl-1')
  })

  it('returns 404 when missing', async () => {
    mockGetTemplate.mockRejectedValue(new Error('Template not found'))
    const app = makeApp()
    const res = await request(app).get('/api/v1/community/templates/missing')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/v1/community/templates', () => {
  it('returns 201 on success', async () => {
    mockCreateTemplateSvc.mockResolvedValue({ ...sampleTemplate, _id: 'tmpl-new' })
    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/community/templates')
      .send({
        title: 'New Resume',
        type: 'resume',
        content: 'A polished resume body.',
        tags: ['backend'],
      })
    expect(res.status).toBe(201)
    expect(res.body.data._id).toBe('tmpl-new')
  })
})

describe('POST /api/v1/community/templates/:id/like', () => {
  it('returns 200 with toggled state', async () => {
    mockLikeTemplateSvc.mockResolvedValue({ template: sampleTemplate, liked: true })
    const app = makeApp()
    const res = await request(app).post('/api/v1/community/templates/tmpl-1/like')
    expect(res.status).toBe(200)
    expect(res.body.data.liked).toBe(true)
  })

  it('returns 404 when template missing', async () => {
    mockLikeTemplateSvc.mockRejectedValue(new Error('Template not found'))
    const app = makeApp()
    const res = await request(app).post('/api/v1/community/templates/missing/like')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/v1/community/templates/:id/download', () => {
  it('returns 200 with updated counter', async () => {
    mockDownloadTemplateSvc.mockResolvedValue({ ...sampleTemplate, downloads: 13 })
    const app = makeApp()
    const res = await request(app).post('/api/v1/community/templates/tmpl-1/download')
    expect(res.status).toBe(200)
    expect(res.body.data.downloads).toBe(13)
  })
})

describe('GET /api/v1/community/referrals', () => {
  it('returns 200 with list', async () => {
    mockListReferrals.mockResolvedValue([sampleReferral])
    const app = makeApp()
    const res = await request(app).get('/api/v1/community/referrals')
    expect(res.status).toBe(200)
    expect(res.body.data[0].company).toBe('Google')
  })
})

describe('POST /api/v1/community/referrals', () => {
  it('returns 201 on success', async () => {
    mockCreateReferral.mockResolvedValue({ ...sampleReferral, _id: 'ref-new' })
    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/community/referrals')
      .send({
        company: 'Google',
        role: 'L5 SWE',
        message: 'Looking for a referral for the senior backend position.',
      })
    expect(res.status).toBe(201)
    expect(res.body.data._id).toBe('ref-new')
  })
})

describe('POST /api/v1/community/referrals/:id/claim', () => {
  it('returns 200 on success', async () => {
    mockClaimReferralSvc.mockResolvedValue({
      ...sampleReferral,
      status: 'claimed',
      responderId: 'user-2',
    })
    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/community/referrals/ref-1/claim')
      .send({ note: 'Happy to refer' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('claimed')
  })

  it('returns 404 when missing', async () => {
    mockClaimReferralSvc.mockRejectedValue(new Error('Referral not found'))
    const app = makeApp()
    const res = await request(app).post('/api/v1/community/referrals/missing/claim').send({})
    expect(res.status).toBe(404)
  })
})

describe('GET /api/v1/community/posts', () => {
  it('returns 200 with list', async () => {
    mockListPosts.mockResolvedValue([samplePost])
    const app = makeApp()
    const res = await request(app).get('/api/v1/community/posts')
    expect(res.status).toBe(200)
    expect(res.body.data[0].title).toBe('How to prep for Stripe interviews')
  })
})

describe('POST /api/v1/community/posts', () => {
  it('returns 201 on success', async () => {
    mockCreatePostSvc.mockResolvedValue({ ...samplePost, _id: 'post-new' })
    const app = makeApp()
    const res = await request(app)
      .post('/api/v1/community/posts')
      .send({
        title: 'Tips for negotiating',
        body: 'Long-form content about negotiation tactics.',
        category: 'salary',
      })
    expect(res.status).toBe(201)
    expect(res.body.data._id).toBe('post-new')
  })
})

describe('POST /api/v1/community/posts/:id/like', () => {
  it('returns 200 on success', async () => {
    mockLikePostSvc.mockResolvedValue({ post: samplePost, liked: true })
    const app = makeApp()
    const res = await request(app).post('/api/v1/community/posts/post-1/like')
    expect(res.status).toBe(200)
    expect(res.body.data.liked).toBe(true)
  })
})
