/**
 * Tests for the Settings-related identity endpoints added in Chunk 3:
 *   - PUT  /api/auth/password     (changePasswordSchema + verifyPassword + hashPassword)
 *   - DELETE /api/auth/account    (cascade delete across all user-owned collections)
 *   - GET /api/auth/api-keys      (returns provider names only — never key values)
 *
 * Mirrors the route-test strategy used in
 * `src/systems/community/__tests__/community.test.ts` and
 * `src/systems/smart-application/__tests__/routes.test.ts`:
 *   - Mock all model modules with class-like fakes.
 *   - Mock preferenceStore so we control what `getPreferences` returns.
 *   - Mock `credentialManager` so we observe hash/verify calls and stub bcrypt.
 *   - Mock `sessionGuard` to inject a fake `req.userId`.
 *   - Use real Zod schemas for schema tests, and exercise the route via supertest.
 */

import { jest } from '@jest/globals'

// ---------- Real schemas (used in schema tests) ----------
const realSchemas = jest.requireActual('../../../utils/validation') as {
  changePasswordSchema: any
  preferencesSchema: any
}

// ---------- sessionGuard stub ----------
jest.mock('../sessionGuard', () => ({
  sessionGuard: (req: any, _res: any, next: any) => {
    req.userId = 'user-1'
    next()
  },
}))

// ---------- credentialManager stub ----------
// We control what verifyPassword returns and observe hashPassword calls.
const mockHashPassword = jest.fn(async (pw: string) => `hashed:${pw}`) as any
const mockVerifyPassword = jest.fn(async () => true) as any

jest.mock('../credentialManager', () => ({
  hashPassword: (pw: string) => mockHashPassword(pw),
  verifyPassword: (pw: string, hash: string) => mockVerifyPassword(pw, hash),
  generateToken: (id: string) => `token:${id}`,
  SESSION_COOKIE: 'af_session',
  sessionCookieOptions: { httpOnly: true, path: '/' },
}))

// ---------- preferenceStore stub ----------
const mockGetPreferences = jest.fn(async () => ({ apiKeys: {} })) as any
const mockUpdatePreferences = jest.fn(async (_id: string, updates: any) => updates) as any
const mockRedactApiKeys = jest.fn((prefs: any) => {
  const { apiKeys: _omit, ...rest } = prefs
  return rest
}) as any

jest.mock('../preferenceStore', () => ({
  getPreferences: (id: string) => mockGetPreferences(id),
  updatePreferences: (id: string, updates: any) => mockUpdatePreferences(id, updates),
  redactApiKeys: (prefs: any) => mockRedactApiKeys(prefs),
}))

// ---------- OAuth gateway stub (avoid network calls) ----------
jest.mock('../oauthGateway', () => ({
  verifyGoogleToken: jest.fn(),
  verifyGithubCode: jest.fn(),
  verifyLinkedInCode: jest.fn(),
}))

// ---------- Model stubs ----------
// Generic helper to build a model mock with the static methods used by routes.
function makeModelMock() {
  const m: any = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    deleteMany: jest.fn(async () => ({ deletedCount: 0 })),
    create: jest.fn(),
  }
  return m
}

const UserMock = makeModelMock()
const ApplicationMock = makeModelMock()
const JDAnalysisMock = makeModelMock()
const ResumeVersionMock = makeModelMock()
const InterviewPrepMock = makeModelMock()
const UploadedResumeMock = makeModelMock()
const ValidationReportMock = makeModelMock()
const ExportRecordMock = makeModelMock()
const NotificationMock = makeModelMock()

// User.create needs to return a document with .save() and .toJSON().
UserMock.create = jest.fn(async (doc: any) => ({
  ...doc,
  _id: 'user-created-id',
  save: jest.fn(async function (this: any) { return this }),
  toJSON() {
    return { _id: this._id, ...this }
  },
}))

jest.mock('../../../models/User', () => ({
  User: UserMock,
  __esModule: true,
}))
jest.mock('../../../models/Notification', () => ({ Notification: NotificationMock, __esModule: true }))
jest.mock('../../../models/Application', () => ({ Application: ApplicationMock, __esModule: true }))
jest.mock('../../../models/JDAnalysis', () => ({ JDAnalysis: JDAnalysisMock, __esModule: true }))
jest.mock('../../../models/ResumeVersion', () => ({ ResumeVersion: ResumeVersionMock, __esModule: true }))
jest.mock('../../../models/InterviewPrep', () => ({ InterviewPrep: InterviewPrepMock, __esModule: true }))
jest.mock('../../../models/UploadedResume', () => ({ UploadedResume: UploadedResumeMock, __esModule: true }))
jest.mock('../../../models/ValidationReport', () => ({ ValidationReport: ValidationReportMock, __esModule: true }))
jest.mock('../../../models/ExportRecord', () => ({ ExportRecord: ExportRecordMock, __esModule: true }))

// ---------- Imports (must be after mocks) ----------
import express from 'express'
import type { Express } from 'express'
import request from 'supertest'
import identityRoutes from '../routes'

function makeApp(): Express {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', identityRoutes)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorHandler } = require('../../../middleware/errorHandler')
  app.use(errorHandler)
  return app
}

// ---------- Reset between tests ----------
beforeEach(() => {
  jest.clearAllMocks()
  // restore default happy-path behaviors
  mockHashPassword.mockImplementation(async (pw: string) => `hashed:${pw}`)
  mockVerifyPassword.mockResolvedValue(true)
  mockGetPreferences.mockResolvedValue({ apiKeys: {} })
  mockUpdatePreferences.mockImplementation(async (_id, updates) => updates)
  UserMock.findById.mockResolvedValue({
    _id: 'user-1',
    email: 'user@example.com',
    password: 'hashed:old-password',
    save: jest.fn(async function (this: any) { return this }),
    toJSON() { return { _id: this._id, email: this.email } },
  })
  UserMock.findByIdAndDelete.mockResolvedValue({ _id: 'user-1' })
  for (const m of [
    ApplicationMock,
    JDAnalysisMock,
    ResumeVersionMock,
    InterviewPrepMock,
    UploadedResumeMock,
    ValidationReportMock,
    ExportRecordMock,
    NotificationMock,
  ]) {
    m.deleteMany.mockResolvedValue({ deletedCount: 0 })
  }
})

// =====================================================================
//                              SCHEMA TESTS
// =====================================================================

describe('changePasswordSchema (real)', () => {
  const { changePasswordSchema } = realSchemas

  it('accepts valid input', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'oldpass1',
      newPassword: 'newpass123',
    })
    expect(r.success).toBe(true)
  })

  it('rejects when currentPassword is missing', () => {
    const r = changePasswordSchema.safeParse({ newPassword: 'newpass123' })
    expect(r.success).toBe(false)
  })

  it('rejects when currentPassword is empty string', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'newpass123' })
    expect(r.success).toBe(false)
  })

  it('rejects when newPassword is missing', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'oldpass1' })
    expect(r.success).toBe(false)
  })

  it('rejects when newPassword is shorter than 8 chars', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'oldpass1', newPassword: 'short' })
    expect(r.success).toBe(false)
  })

  it('accepts newPassword that is exactly 8 chars', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'oldpass1', newPassword: '12345678' })
    expect(r.success).toBe(true)
  })
})

describe('preferencesSchema.twoFactorEnabled (real)', () => {
  const { preferencesSchema } = realSchemas

  it('accepts boolean true', () => {
    expect(preferencesSchema.safeParse({ twoFactorEnabled: true }).success).toBe(true)
  })

  it('accepts boolean false', () => {
    expect(preferencesSchema.safeParse({ twoFactorEnabled: false }).success).toBe(true)
  })

  it('accepts undefined (omitted)', () => {
    expect(preferencesSchema.safeParse({}).success).toBe(true)
  })

  it('rejects non-boolean values', () => {
    expect(preferencesSchema.safeParse({ twoFactorEnabled: 'yes' }).success).toBe(false)
    expect(preferencesSchema.safeParse({ twoFactorEnabled: 1 }).success).toBe(false)
  })
})

// =====================================================================
//                     PUT /api/auth/password
// =====================================================================

describe('PUT /api/auth/password', () => {
  it('hashes and saves the new password when the current one is valid', async () => {
    const app = makeApp()
    const saveSpy = jest.fn(async function (this: any) { return this })
    UserMock.findById.mockResolvedValue({
      _id: 'user-1',
      password: 'hashed:old-password',
      save: saveSpy,
    })

    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'oldpass1', newPassword: 'newpass123' })

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ ok: true })
    expect(mockVerifyPassword).toHaveBeenCalledWith('oldpass1', 'hashed:old-password')
    expect(mockHashPassword).toHaveBeenCalledWith('newpass123')
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })

  it('returns 401 when the current password is wrong', async () => {
    mockVerifyPassword.mockResolvedValueOnce(false)
    const app = makeApp()
    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'wrong', newPassword: 'newpass123' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/incorrect/i)
    expect(mockHashPassword).not.toHaveBeenCalled()
  })

  it('returns 400 when currentPassword is missing', async () => {
    const app = makeApp()
    const res = await request(app)
      .put('/api/auth/password')
      .send({ newPassword: 'newpass123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/validation/i)
    expect(mockVerifyPassword).not.toHaveBeenCalled()
  })

  it('returns 400 when newPassword is shorter than 8 chars', async () => {
    const app = makeApp()
    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'oldpass1', newPassword: 'short' })
    expect(res.status).toBe(400)
    expect(mockVerifyPassword).not.toHaveBeenCalled()
  })

  it('returns 400 when newPassword equals currentPassword', async () => {
    const app = makeApp()
    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'samepass1', newPassword: 'samepass1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/different/i)
    expect(mockVerifyPassword).not.toHaveBeenCalled()
    expect(mockHashPassword).not.toHaveBeenCalled()
  })

  it('returns 404 when the user record no longer exists', async () => {
    UserMock.findById.mockResolvedValueOnce(null)
    const app = makeApp()
    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'oldpass1', newPassword: 'newpass123' })
    expect(res.status).toBe(404)
  })

  it('returns 400 when the account has no password set (OAuth-only account)', async () => {
    UserMock.findById.mockResolvedValueOnce({ _id: 'user-1', password: undefined })
    const app = makeApp()
    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'oldpass1', newPassword: 'newpass123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/password login is not enabled/i)
  })
})

// =====================================================================
//                     DELETE /api/auth/account
// =====================================================================

describe('DELETE /api/auth/account', () => {
  it('cascades delete across all user-owned collections', async () => {
    const app = makeApp()
    const res = await request(app).delete('/api/auth/account')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ ok: true })

    expect(ApplicationMock.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(JDAnalysisMock.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(ResumeVersionMock.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(InterviewPrepMock.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(UploadedResumeMock.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(ValidationReportMock.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(ExportRecordMock.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(NotificationMock.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(UserMock.findByIdAndDelete).toHaveBeenCalledWith('user-1')
  })

  it('clears the session cookie', async () => {
    const app = makeApp()
    const res = await request(app).delete('/api/auth/account')
    expect(res.status).toBe(200)
    const cleared = res.headers['set-cookie']?.some(
      (c: string) => c.includes('af_session=;') || c.endsWith('af_session='),
    )
    expect(cleared).toBe(true)
  })
})

// =====================================================================
//                     GET /api/auth/api-keys
// =====================================================================

describe('GET /api/auth/api-keys', () => {
  it('returns the list of configured provider names', async () => {
    mockGetPreferences.mockResolvedValueOnce({
      apiKeys: { openai: 'sk-xxx', anthropic: 'sk-yyy' },
    })
    const app = makeApp()
    const res = await request(app).get('/api/auth/api-keys')

    expect(res.status).toBe(200)
    expect(res.body.data.providers.sort()).toEqual(['anthropic', 'openai'])
  })

  it('returns an empty array when no keys are configured', async () => {
    mockGetPreferences.mockResolvedValueOnce({ apiKeys: {} })
    const app = makeApp()
    const res = await request(app).get('/api/auth/api-keys')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ providers: [] })
  })

  it('returns an empty array when apiKeys is missing entirely', async () => {
    mockGetPreferences.mockResolvedValueOnce({} as any)
    const app = makeApp()
    const res = await request(app).get('/api/auth/api-keys')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ providers: [] })
  })

  it('NEVER returns the actual key values in the response body or headers', async () => {
    mockGetPreferences.mockResolvedValueOnce({
      apiKeys: { openai: 'sk-very-secret-key-value' },
    })
    const app = makeApp()
    const res = await request(app).get('/api/auth/api-keys')
    const serialized = JSON.stringify(res.body) + JSON.stringify(res.headers)
    expect(serialized).not.toContain('sk-very-secret-key-value')
  })
})
