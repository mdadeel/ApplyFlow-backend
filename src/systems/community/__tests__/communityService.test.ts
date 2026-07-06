import { jest } from '@jest/globals'

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

const realSchemas = jest.requireActual('../communityService') as {
  templateCreateSchema: any
  referralCreateSchema: any
  postCreateSchema: any
}

import {
  createTemplate,
  likeTemplate,
  downloadTemplate,
  createReferralRequest,
  claimReferral,
  createPost,
  likePost,
} from '../communityService'

beforeEach(() => {
  jest.clearAllMocks()
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
