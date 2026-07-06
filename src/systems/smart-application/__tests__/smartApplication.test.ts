/**
 * Unit tests for SmartApplicationService + ResponseParser.
 *
 * Mocks: getFullProfile, Application model save(), exportManager.
 * AIProvider is injected directly (no module mocking required for the service).
 */

import { jest } from '@jest/globals'

// ---------- Mocks (must be declared before importing the SUT) ----------

jest.mock('../../career-data/profileService', () => ({
  getFullProfile: jest.fn(),
}))

jest.mock('../../../models/Application', () => {
  const saveMock = jest.fn()
  // Application is instantiated as `new Application(...)` — return a
  // constructor-like function whose instances expose `.save()`.
  const ApplicationMock: any = jest.fn().mockImplementation((doc: any) => ({
    ...doc,
    _id: { toString: () => 'app-id' },
    save: saveMock,
  }))
  ApplicationMock.saveMock = saveMock
  return { Application: ApplicationMock }
})

jest.mock('../exportManager', () => {
  const exportApplication = jest.fn()
  const getExportFolder = jest.fn((company: string) => `/tmp/applications/${company}`)
  return {
    exportManager: {
      exportApplication,
      getExportFolder,
    },
  }
})

// ---------- Imports (after mocks) ----------

import { SmartApplicationService } from '../index'
import { ResponseParser } from '../responseParser'
import { getFullProfile } from '../../career-data/profileService'
import { exportManager } from '../exportManager'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ApplicationModule = require('../../../models/Application')

// ---------- Types / fixtures ----------

import type {
  SmartApplicationOutput,
  SmartApplicationInput,
} from '../types'
import type { CareerProfile } from '../../career-data/profileService'
import type { AIProvider } from '../../ai/aiProvider'

function buildValidOutput(overrides: Partial<SmartApplicationOutput> = {}): SmartApplicationOutput {
  const base: SmartApplicationOutput = {
    analysis: {
      company: 'Acme Corp',
      role: 'Senior Engineer',
      employmentType: 'full-time',
      experienceLevel: 'senior',
      requiredSkills: ['TypeScript', 'Node.js'],
      preferredSkills: ['GraphQL'],
      responsibilities: ['Build features', 'Mentor juniors'],
      keywords: ['typescript', 'node'],
      atsKeywords: ['TypeScript', 'Node.js'],
      softSkills: ['communication'],
      redFlags: [],
      matchPercent: 80,
      salaryRange: '150k-200k',
      location: 'Remote',
    },
    resume: {
      markdown: 'Senior engineer with TypeScript and Node.js experience.',
      sections: {
        summary: 'Experienced engineer.',
        experience: [
          {
            company: 'Acme',
            role: 'Engineer',
            startDate: '2020-01',
            endDate: '2023-01',
            bullets: ['Built TypeScript services', 'Mentored team'],
          },
        ],
        projects: [
          {
            title: 'Project X',
            description: 'A great project',
            technologies: ['TypeScript'],
            bullets: ['Shipped feature'],
          },
        ],
        skills: [{ category: 'Languages', items: ['TypeScript', 'Node.js'] }],
        education: [{ degree: 'BS CS', institution: 'University', year: '2018' }],
        certifications: [{ name: 'AWS', issuer: 'Amazon', year: '2022' }],
      },
    },
    email: {
      subject: 'Application for Senior Engineer',
      body: 'Dear Hiring Manager, ...',
      tone: 'professional',
    },
    coverLetter: 'I am excited to apply...',
    validationHints: {
      atsKeywordsToInclude: ['TypeScript', 'Node.js'],
      truthFlags: [],
      humanizationTips: ['Add more specifics'],
    },
  }
  return { ...base, ...overrides } as SmartApplicationOutput
}

function buildCareerProfile(): CareerProfile {
  return {
    personal: { name: 'Test User', email: 'test@example.com' },
    experiences: [],
    projects: [],
    skills: [],
    education: [],
    certificates: [],
  }
}

function buildMockAIProvider(responses: string[]): AIProvider {
  let i = 0
  return {
    generateText: jest.fn(async () => {
      const v = responses[i] ?? responses[responses.length - 1]
      i++
      return v
    }),
  } as unknown as AIProvider
}

const sampleInput: SmartApplicationInput = {
  userId: 'user-1',
  jdText: 'We are looking for a Senior Engineer with TypeScript and Node.js experience.',
  company: 'Acme Corp',
  role: 'Senior Engineer',
}

// ---------- Setup ----------

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------- 1. createApplication success ----------

describe('SmartApplicationService.createApplication', () => {
  it('returns applicationId, output, scores, exportPath on success', async () => {
    const validJson = JSON.stringify(buildValidOutput())
    const aiProvider = buildMockAIProvider([validJson])

    ;(getFullProfile as jest.Mock).mockResolvedValue(buildCareerProfile())
    ;(exportManager.exportApplication as jest.Mock).mockResolvedValue([
      { format: 'pdf', path: '/tmp/applications/Acme-Corp/file.pdf', filename: 'file.pdf' },
    ])
    ;(ApplicationModule.Application.saveMock as jest.Mock).mockResolvedValue({
      _id: { toString: () => 'app-id' },
    })

    const service = new SmartApplicationService(aiProvider)
    const result = await service.createApplication(sampleInput)

    expect(result.applicationId).toBe('app-id')
    expect(result.output.analysis.company).toBe('Acme Corp')
    expect(result.output.email.subject).toBe('Application for Senior Engineer')
    expect(result.scores).toBeDefined()
    expect(typeof result.scores.ats).toBe('number')
    expect(typeof result.scores.match).toBe('number')
    expect(typeof result.scores.overall).toBe('number')
    expect(result.scores.ats).toBeGreaterThanOrEqual(0)
    expect(result.scores.ats).toBeLessThanOrEqual(100)
    expect(result.scores.match).toBeGreaterThanOrEqual(0)
    expect(result.scores.match).toBeLessThanOrEqual(100)
    expect(result.scores.overall).toBeGreaterThanOrEqual(0)
    expect(result.scores.overall).toBeLessThanOrEqual(100)
    expect(result.exportPath).toBe('/tmp/applications/Acme-Corp/file.pdf')
    expect(aiProvider.generateText).toHaveBeenCalledTimes(1)
    expect(getFullProfile).toHaveBeenCalledWith('user-1')
  })

  // ---------- 2. fails without career profile ----------

  it('throws when career profile is missing', async () => {
    const aiProvider = buildMockAIProvider([''])
    ;(getFullProfile as jest.Mock).mockResolvedValue(null)

    const service = new SmartApplicationService(aiProvider)

    await expect(service.createApplication(sampleInput)).rejects.toThrow(
      /Career profile not found/
    )
    expect(aiProvider.generateText).not.toHaveBeenCalled()
  })
})

// ---------- 3. createBulkApplications success ----------

describe('SmartApplicationService.createBulkApplications', () => {
  it('creates multiple applications and returns results array', async () => {
    const outputA = buildValidOutput({
      analysis: { ...buildValidOutput().analysis, company: 'CoA', role: 'RoleA' },
      email: { subject: 'A', body: 'A body', tone: 'professional' },
      coverLetter: 'CL A',
    })
    const outputB = buildValidOutput({
      analysis: { ...buildValidOutput().analysis, company: 'CoB', role: 'RoleB' },
      email: { subject: 'B', body: 'B body', tone: 'enthusiastic' },
      coverLetter: 'CL B',
    })
    const bulkResponse = JSON.stringify([outputA, outputB])

    const aiProvider = buildMockAIProvider([bulkResponse])
    ;(getFullProfile as jest.Mock).mockResolvedValue(buildCareerProfile())
    ;(exportManager.exportApplication as jest.Mock).mockResolvedValue([
      { format: 'md', path: '/tmp/x.md', filename: 'x.md' },
    ])
    ;(ApplicationModule.Application.saveMock as jest.Mock).mockResolvedValue({
      _id: { toString: () => 'app-id' },
    })

    const service = new SmartApplicationService(aiProvider)

    const result = await service.createBulkApplications({
      userId: 'user-1',
      jds: [
        { company: 'CoA', role: 'RoleA', jdText: 'JD for role A with enough text to satisfy validation.' },
        { company: 'CoB', role: 'RoleB', jdText: 'JD for role B with enough text to satisfy validation.' },
      ],
    })

    expect(result.results).toHaveLength(2)
    for (const item of result.results) {
      expect(item).toHaveProperty('applicationId')
      // Successful results carry output + scores
      const ok = item as any
      expect(ok.output).toBeDefined()
      expect(ok.scores).toBeDefined()
      expect(typeof ok.scores.overall).toBe('number')
    }
    expect(aiProvider.generateText).toHaveBeenCalledTimes(1)
  })

  it('throws when career profile is missing in bulk flow', async () => {
    const aiProvider = buildMockAIProvider([''])
    ;(getFullProfile as jest.Mock).mockResolvedValue(null)

    const service = new SmartApplicationService(aiProvider)

    await expect(
      service.createBulkApplications({
        userId: 'user-1',
        jds: [{ company: 'X', role: 'Y', jdText: 'long enough JD text for the schema validator'.repeat(2) }],
      })
    ).rejects.toThrow(/Career profile not found/)
  })
})

// ---------- 4. ResponseParser.calculateScores ----------

describe('ResponseParser.calculateScores', () => {
  it('returns numeric scores between 0 and 100 with high keyword match', () => {
    const output = buildValidOutput()
    const scores = ResponseParser.calculateScores(output)

    expect(typeof scores.ats).toBe('number')
    expect(typeof scores.match).toBe('number')
    expect(typeof scores.overall).toBe('number')
    expect(scores.ats).toBeGreaterThanOrEqual(0)
    expect(scores.ats).toBeLessThanOrEqual(100)
    expect(scores.match).toBeGreaterThanOrEqual(0)
    expect(scores.match).toBeLessThanOrEqual(100)
    expect(scores.overall).toBeGreaterThanOrEqual(0)
    expect(scores.overall).toBeLessThanOrEqual(100)

    // matchPercent=80, both atsKeywords+requiredSkills in resume → ats=100
    expect(scores.match).toBe(80)
    expect(scores.ats).toBe(100)
    // overall = 100*0.5 + 80*0.5 = 90
    expect(scores.overall).toBe(90)
  })

  it('handles empty JD keywords (returns ats=100)', () => {
    const output = buildValidOutput({
      analysis: {
        ...buildValidOutput().analysis,
        atsKeywords: [],
        requiredSkills: [],
      },
    })
    const scores = ResponseParser.calculateScores(output)
    expect(scores.ats).toBe(100)
  })
})

// ---------- 5. ResponseParser.parseSingle malformed JSON ----------

describe('ResponseParser.parseSingle', () => {
  it('strips markdown fences and parses valid JSON', () => {
    const valid = buildValidOutput()
    const raw = '```json\n' + JSON.stringify(valid, null, 2) + '\n```'

    const parsed = ResponseParser.parseSingle(raw)

    expect(parsed.analysis.company).toBe('Acme Corp')
    expect(parsed.email.subject).toBe('Application for Senior Engineer')
    expect(parsed.resume.sections.experience).toHaveLength(1)
  })

  it('throws on truly malformed JSON', () => {
    expect(() => ResponseParser.parseSingle('not json at all')).toThrow(/Failed to parse/)
  })

  it('throws when schema validation fails', () => {
    const invalid = { analysis: { company: 'X' } } // missing many required fields
    expect(() => ResponseParser.parseSingle(JSON.stringify(invalid))).toThrow(
      /validation failed/i
    )
  })
})
