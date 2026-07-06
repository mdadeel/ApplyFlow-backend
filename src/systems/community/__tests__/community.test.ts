/**
 * Tests for Community routes + service.
 *
 * Strategy:
 *   - Service tests use jest.mock on the model modules with a class-like
 *     fake. Real Zod schemas are exercised by using jest.requireActual.
 *   - Route tests jest.mock the service module to inject stubs and verify
 *     request/response wiring + auth + validation failures.
 */

import { jest } from '@jest/globals'

// ---------- Force real schemas for schema tests ----------

const realSchemas = jest.requireActual('../communityService') as {
  templateCreateSchema: any
  referralCreateSchema: any
  postCreateSchema: any
}

// ---------- Service-level mocks for models ----------
// NOTE: variable names must start with `mock` (case-insensitive) so that
// Jest's hoisting allows them to be referenced inside the jest.mock
// factory closures below. The factories are evaluated lazily (on require),
// but `mock`-prefixed identifiers are not hoisted/replaced — they resolve
// at call time, after these const initializers have run.

const templateSave = jest.fn() as any
const mockTemplate: any = jest.fn().mockImplementation((doc: any) => ({
  ...doc,
  save: templateSave,
}))
mockTemplate.find = jest.fn()
mockTemplate.findById = jest.fn()
mockTemplate.findByIdAndUpdate = jest.fn()
mockTemplate.findOne = jest.fn()

const referralSave = jest.fn() as any
const mockReferral: any = jest.fn().mockImplementation((doc: any) => ({
  ...doc,
  save: referralSave,
}))
mockReferral.find = jest.fn()
mockReferral.findById = jest.fn()
mockReferral.findByIdAndUpdate = jest.fn()

const postSave = jest.fn() as any
const mockPost: any = jest.fn().mockImplementation((doc: any) => ({
  ...doc,
  save: postSave,
}))
mockPost.find = jest.fn()
mockPost.findById = jest.fn()
mockPost.findByIdAndUpdate = jest.fn()

jest.mock('../../../models/CommunityTemplate', () => ({
  CommunityTemplate: mockTemplate,
}))

jest.mock('../../../models/ReferralRequest', () => ({
  ReferralRequest: mockReferral,
}))

jest.mock('../../../models/CommunityPost', () => ({
  CommunityPost: mockPost,
}))

// ---------- Imports ----------

import {
  createTemplate,
  likeTemplate,
  downloadTemplate,
  createReferralRequest,
  claimReferral,
  createPost,
  likePost,
} from '../communityService'

// ---------- Reset ----------

beforeEach(() => {
  jest.clearAllMocks()
  // restore class-like chainable .exec() helper
  const chainable = (val: any) => ({
    exec: jest.fn().mockResolvedValue(val),
    sort: () => chainable(val),
    limit: () => chainable(val),
  })
  mockTemplate.find.mockImplementation(() => chainable([]))
  mockTemplate.findById.mockImplementation(() => chainable(null))
  mockTemplate.findByIdAndUpdate.mockImplementation(() => chainable(null))
  mockTemplate.findOne.mockImplementation(() => chainable(null))
  mockReferral.find.mockImplementation(() => chainable([]))
  mockReferral.findById.mockImplementation(() => chainable(null))
  mockReferral.findByIdAndUpdate.mockImplementation(() => chainable(null))
  mockPost.find.mockImplementation(() => chainable([]))
  mockPost.findById.mockImplementation(() => chainable(null))
  mockPost.findByIdAndUpdate.mockImplementation(() => chainable(null))
})

// ====================================================================
//                       SCHEMA TESTS (REAL)
// ====================================================================

describe('Zod schemas (real)', () => {
  const { templateCreateSchema, referralCreateSchema, postCreateSchema } = realSchemas

  it('templateCreateSchema accepts valid input', () => {
    expect(
      templateCreateSchema.safeParse({
        title: 'My Template',
        type: 'resume',
        content: 'Body',
      }).success,
    ).toBe(true)
  })

  it('templateCreateSchema rejects too-short title', () => {
    expect(
      templateCreateSchema.safeParse({
        title: 'ab',
        type: 'resume',
        content: 'Body',
      }).success,
    ).toBe(false)
  })

  it('templateCreateSchema rejects invalid type', () => {
    expect(
      templateCreateSchema.safeParse({
        title: 'Valid Title',
        type: 'bogus',
        content: 'Body',
      }).success,
    ).toBe(false)
  })

  it('referralCreateSchema rejects too-short message', () => {
    expect(
      referralCreateSchema.safeParse({
        company: 'Google',
        role: 'L5',
        message: 'short',
      }).success,
    ).toBe(false)
  })

  it('referralCreateSchema rejects invalid jdUrl', () => {
    expect(
      referralCreateSchema.safeParse({
        company: 'Google',
        role: 'L5',
        message: 'A long enough message for the schema validator.',
        jdUrl: 'not-a-url',
      }).success,
    ).toBe(false)
  })

  it('postCreateSchema rejects invalid category', () => {
    expect(
      postCreateSchema.safeParse({
        title: 'Good title',
        body: 'Long enough body content.',
        category: 'bogus',
      }).success,
    ).toBe(false)
  })

  it('postCreateSchema rejects too-short title', () => {
    expect(
      postCreateSchema.safeParse({
        title: 'ab',
        body: 'Long enough body content.',
        category: 'interview',
      }).success,
    ).toBe(false)
  })
})

// ====================================================================
//                       SERVICE TESTS
// ====================================================================

describe('createTemplate', () => {
  it('saves and returns the doc', async () => {
    const savedDoc = { _id: 'tmpl-new', title: 'T', type: 'resume', content: 'C' }
    templateSave.mockResolvedValue(savedDoc)

    const result = await createTemplate(
      { title: 'T', type: 'resume', content: 'C', tags: [], description: '', isPublished: true },
      'user-1',
    )

    expect(result).toEqual(savedDoc)
    expect(mockTemplate).toHaveBeenCalled()
    expect(templateSave).toHaveBeenCalled()
  })
})

describe('likeTemplate', () => {
  it('adds like for a new liker', async () => {
    const existing = { _id: 'tmpl-1', likedBy: [], likes: 0 }
    const updated = { _id: 'tmpl-1', likedBy: ['user-2'], likes: 1 }
    mockTemplate.findById.mockImplementationOnce(() => ({ exec: jest.fn().mockResolvedValue(existing) }))
    mockTemplate.findByIdAndUpdate.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(updated),
    }))

    const result = await likeTemplate('tmpl-1', 'user-2')
    expect(result.liked).toBe(true)
    expect(result.template.likes).toBe(1)
    expect(mockTemplate.findByIdAndUpdate).toHaveBeenCalledWith(
      'tmpl-1',
      { $addToSet: { likedBy: 'user-2' }, $inc: { likes: 1 } },
      { new: true },
    )
  })

  it('removes like when user has already liked', async () => {
    const existing = { _id: 'tmpl-1', likedBy: ['user-2'], likes: 1 }
    const updated = { _id: 'tmpl-1', likedBy: [], likes: 0 }
    mockTemplate.findById.mockImplementationOnce(() => ({ exec: jest.fn().mockResolvedValue(existing) }))
    mockTemplate.findByIdAndUpdate.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(updated),
    }))

    const result = await likeTemplate('tmpl-1', 'user-2')
    expect(result.liked).toBe(false)
    expect(result.template.likes).toBe(0)
  })

  it('throws when template missing', async () => {
    mockTemplate.findById.mockImplementationOnce(() => ({ exec: jest.fn().mockResolvedValue(null) }))
    await expect(likeTemplate('missing', 'user-1')).rejects.toThrow(/not found/i)
  })
})

describe('downloadTemplate', () => {
  it('increments counter', async () => {
    const updated = { _id: 'tmpl-1', downloads: 7 }
    mockTemplate.findByIdAndUpdate.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(updated),
    }))

    const result = await downloadTemplate('tmpl-1', 'user-1')
    expect(result.downloads).toBe(7)
  })

  it('throws when template missing', async () => {
    mockTemplate.findByIdAndUpdate.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(null),
    }))
    await expect(downloadTemplate('missing', 'user-1')).rejects.toThrow(/not found/i)
  })
})

describe('createReferralRequest', () => {
  it('persists with status=open by default', async () => {
    const saved = { _id: 'r1', status: 'open' }
    referralSave.mockResolvedValue(saved)

    const result = await createReferralRequest(
      {
        company: 'Google',
        role: 'L5 SWE',
        message: 'Looking for a referral for the senior backend position.',
        tags: [],
      },
      'user-1',
    )
    expect(result).toEqual(saved)
    expect(mockReferral).toHaveBeenCalled()
    expect(referralSave).toHaveBeenCalled()
  })
})

describe('claimReferral', () => {
  it('updates status and sets responderId', async () => {
    const updated = { _id: 'r1', status: 'claimed', responderId: 'user-2' }
    mockReferral.findByIdAndUpdate.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(updated),
    }))

    const result = await claimReferral('r1', 'user-2', 'Happy to refer')
    expect(result.status).toBe('claimed')
    expect(result.responderId).toBe('user-2')
  })

  it('throws when missing', async () => {
    mockReferral.findByIdAndUpdate.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(null),
    }))
    await expect(claimReferral('missing', 'user-1')).rejects.toThrow(/not found/i)
  })
})

describe('createPost', () => {
  it('parses and saves', async () => {
    const saved = { _id: 'p1', category: 'interview' }
    postSave.mockResolvedValue(saved)

    const result = await createPost(
      {
        title: 'Interview tips',
        body: 'Long-form advice goes here.',
        category: 'interview',
        tags: [],
      },
      'user-1',
    )
    expect(result).toEqual(saved)
    expect(mockPost).toHaveBeenCalled()
  })
})

describe('likePost', () => {
  it('adds like', async () => {
    const existing = { _id: 'p1', likedBy: [], likes: 0 }
    const updated = { _id: 'p1', likedBy: ['user-2'], likes: 1 }
    mockPost.findById.mockImplementationOnce(() => ({ exec: jest.fn().mockResolvedValue(existing) }))
    mockPost.findByIdAndUpdate.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(updated),
    }))

    const result = await likePost('p1', 'user-2')
    expect(result.liked).toBe(true)
    expect(result.post.likes).toBe(1)
  })

  it('throws when missing', async () => {
    mockPost.findById.mockImplementationOnce(() => ({ exec: jest.fn().mockResolvedValue(null) }))
    await expect(likePost('missing', 'user-1')).rejects.toThrow(/not found/i)
  })
})

// ====================================================================
//                       ROUTE INTEGRATION TESTS
// ====================================================================

// We re-import these after jest.mock for the service module below.

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

// sessionGuard stub (must come AFTER the service mock so it takes effect)
jest.mock('../../identity/sessionGuard', () => ({
  sessionGuard: (req: any, _res: any, next: any) => {
    req.userId = 'user-1'
    next()
  },
}))

// Now import routes AFTER the mocks are set
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
