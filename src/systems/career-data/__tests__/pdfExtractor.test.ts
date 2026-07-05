/**
 * Unit tests for pdfExtractor.
 *
 * Strategy: mock the AI provider so we can deterministically control what the
 * extractor "sees" from the LLM. Internal helpers (`normalizeDates`,
 * `mergeAcronymSkills`, `cleanExtractedText`) are tested indirectly via their
 * observable effects on `extractProfileFromPDF`.
 */

import { jest } from '@jest/globals'

// ---------- Mocks ----------

const mockGenerateText = jest.fn() as any

jest.mock('../../ai', () => ({
  getAIProvider: () => ({ generateText: mockGenerateText }),
}))

// ---------- Imports ----------

import { extractProfileFromPDF } from '../pdfExtractor'

// ---------- Setup ----------

beforeEach(() => {
  mockGenerateText.mockReset()
})

// ---------- 1. extractProfileFromPDF returns structured profile ----------

describe('extractProfileFromPDF', () => {
  it('returns a fully populated profile when AI returns a valid JSON', async () => {
    const aiJson = {
      personal: { name: 'Jane Doe', title: 'Senior Engineer', summary: 'A great engineer.' },
      experiences: [
        {
          company: 'Acme',
          role: 'Senior Engineer',
          startDate: '2020-01',
          endDate: '2023-06',
          current: false,
          responsibilities: ['Built services', 'Mentored team'],
          technologies: ['TypeScript', 'Node.js'],
          achievements: ['Shipped v2'],
          metrics: ['50% latency reduction'],
          projects: ['Project X'],
        },
      ],
      projects: [
        {
          title: 'Project X',
          description: 'A great project',
          problem: 'Slow system',
          solution: 'Rebuilt it',
          technologies: ['TypeScript'],
          features: ['Real-time updates'],
          challenges: ['Legacy code'],
          outcome: '50% faster',
          github: 'https://github.com/x',
          demo: 'https://x.demo',
          tags: ['typescript'],
        },
      ],
      skills: [
        { category: 'Languages', name: 'TypeScript', level: 'Expert' },
        { category: 'Backend', name: 'Node.js', level: 'Advanced' },
      ],
      education: [
        { degree: 'BS CS', institution: 'University', startDate: '2014-09', endDate: '2018-06', result: '3.8 GPA' },
      ],
      certificates: [{ name: 'AWS Solutions Architect', issuer: 'AWS', date: '2022', url: 'https://aws.com' }],
    }
    mockGenerateText.mockResolvedValue(JSON.stringify(aiJson))

    const profile = await extractProfileFromPDF('Some raw resume text content with enough length.')

    expect(profile.personal?.name).toBe('Jane Doe')
    expect(profile.experiences).toHaveLength(1)
    expect(profile.experiences[0].company).toBe('Acme')
    expect(profile.projects).toHaveLength(1)
    expect(profile.skills).toHaveLength(2)
    expect(profile.education).toHaveLength(1)
    expect(profile.certificates).toHaveLength(1)
  })

  it('returns an empty profile when input text is empty (no AI call)', async () => {
    const profile = await extractProfileFromPDF('')

    expect(profile.experiences).toEqual([])
    expect(profile.projects).toEqual([])
    expect(profile.skills).toEqual([])
    expect(profile.education).toEqual([])
    expect(profile.certificates).toEqual([])
    expect(mockGenerateText).not.toHaveBeenCalled()
  })

  it('returns an empty profile when AI returns invalid JSON', async () => {
    mockGenerateText.mockResolvedValue('not json at all')

    const profile = await extractProfileFromPDF('Some text content.')

    expect(profile.experiences).toEqual([])
    expect(profile.skills).toEqual([])
  })
})

// ---------- 2. normalizeDates converts "Jan 2020" to "2020-01" ----------

describe('normalizeDates (via extractProfileFromPDF output)', () => {
  it('converts human-readable dates like "Jan 2020" to "2020-01"', async () => {
    const aiJson = {
      personal: { name: 'X' },
      experiences: [
        {
          company: 'Acme',
          role: 'Engineer',
          startDate: 'Jan 2020',
          endDate: 'Jun 2023',
          current: false,
          responsibilities: [],
          technologies: [],
          achievements: [],
          metrics: [],
          projects: [],
        },
      ],
      projects: [],
      skills: [],
      education: [
        { degree: 'BS', institution: 'U', startDate: 'Sep 2014', endDate: 'Jun 2018' },
      ],
      certificates: [],
    }
    mockGenerateText.mockResolvedValue(JSON.stringify(aiJson))

    const profile = await extractProfileFromPDF('Some text content here.')

    expect(profile.experiences[0].startDate).toBe('2020-01')
    expect(profile.experiences[0].endDate).toBe('2023-06')
    expect(profile.education[0].startDate).toBe('2014-09')
    expect(profile.education[0].endDate).toBe('2018-06')
  })

  it('passes through ISO-like dates unchanged', async () => {
    const aiJson = {
      personal: {},
      experiences: [
        {
          company: 'Acme',
          role: 'E',
          startDate: '2020-01',
          endDate: '2023-06',
          current: false,
          responsibilities: [],
          technologies: [],
          achievements: [],
          metrics: [],
          projects: [],
        },
      ],
      projects: [],
      skills: [],
      education: [],
      certificates: [],
    }
    mockGenerateText.mockResolvedValue(JSON.stringify(aiJson))

    const profile = await extractProfileFromPDF('text')
    expect(profile.experiences[0].startDate).toBe('2020-01')
  })
})

// ---------- 3. mergeAcronymSkills removes duplicate skills keeping highest level ----------

describe('mergeAcronymSkills (via extractProfileFromPDF output)', () => {
  it('removes duplicate skills and keeps the highest level entry', async () => {
    const aiJson = {
      personal: {},
      experiences: [],
      projects: [],
      skills: [
        { category: 'Languages', name: 'TypeScript', level: 'Beginner' },
        { category: 'Languages', name: 'TypeScript', level: 'Expert' },
        { category: 'Languages', name: 'typescript', level: 'Intermediate' }, // case-insensitive duplicate
        { category: 'Backend', name: 'Node.js', level: 'Intermediate' },
        { category: 'Backend', name: 'Node.js', level: 'Advanced' },
      ],
      education: [],
      certificates: [],
    }
    mockGenerateText.mockResolvedValue(JSON.stringify(aiJson))

    const profile = await extractProfileFromPDF('text')

    expect(profile.skills).toHaveLength(2)

    const ts = profile.skills.find((s) => s.name.toLowerCase() === 'typescript')!
    expect(ts.level).toBe('Expert') // highest among Beginner / Expert / Intermediate

    const node = profile.skills.find((s) => s.name === 'Node.js')!
    expect(node.level).toBe('Advanced') // highest between Intermediate and Advanced
  })
})

// ---------- 4. cleanExtractedText removes page numbers and URLs ----------

describe('cleanExtractedText (via prompt sent to AI)', () => {
  it('strips page-number markers and standalone URLs before sending to the AI', async () => {
    const dirtyText = [
      'John Doe',
      'Page 1',
      'https://example.com/should-be-stripped',
      '2 / 10',
      'Real content paragraph with enough length to pass the empty-text guard.',
      'extra@example.com',
    ].join('\n')

    const aiJson = {
      personal: { name: 'John Doe' },
      experiences: [],
      projects: [],
      skills: [],
      education: [],
      certificates: [],
    }
    mockGenerateText.mockResolvedValue(JSON.stringify(aiJson))

    await extractProfileFromPDF(dirtyText)

    expect(mockGenerateText).toHaveBeenCalledTimes(1)
    const sentPrompt = mockGenerateText.mock.calls[0][0] as string

    // Page markers should not appear in the cleaned prompt
    expect(sentPrompt).not.toMatch(/Page 1/)
    expect(sentPrompt).not.toMatch(/\b2 \/ 10\b/)

    // The standalone URL line should have been removed
    expect(sentPrompt).not.toMatch(/https:\/\/example\.com\/should-be-stripped/)

    // Real content must still be there
    expect(sentPrompt).toContain('Real content paragraph')
  })
})
