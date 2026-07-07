import { orchestrateRetry } from '../orchestrator'
import type { SmartApplicationOutput } from '../../../systems/smart-application/types'
import type { RetriableSection } from '../orchestrator'

function buildEmptyOutput(): SmartApplicationOutput {
  return {
    analysis: {
      company: 'TestCo', role: 'Engineer', employmentType: 'full-time',
      experienceLevel: 'mid', requiredSkills: [], preferredSkills: [],
      responsibilities: [], keywords: [], atsKeywords: [], softSkills: [],
      redFlags: [], matchPercent: 0, salaryRange: null, location: null,
    },
    resume: {
      markdown: '',
      sections: {},
    },
    email: { subject: '', body: '', tone: 'professional' },
    coverLetter: '',
    validationHints: { atsKeywordsToInclude: [], truthFlags: [], humanizationTips: [] },
  }
}

describe('orchestrateRetry', () => {
  it('returns passed result on first attempt when score >= threshold', async () => {
    let callCount = 0
    const scores = [95]
    const regenerate = async (output: SmartApplicationOutput, _s: RetriableSection[], _a: number) => {
      output.validationHints.humanizationTips = [`score:${scores[callCount]}`]
      callCount++
      return output
    }
    const validate = async (output: SmartApplicationOutput) => {
      const score = parseInt(output.validationHints.humanizationTips[0]?.split(':')[1] || '0', 10)
      return { overall: score, perSection: { summary: score, experience: score } }
    }

    const result = await orchestrateRetry(
      'test', regenerate, validate, undefined,
      { test: { maxRetries: 3, scoreThreshold: 70, backoffMs: 1 } },
    )

    expect(result.best.passed).toBe(true)
    expect(result.best.score).toBe(95)
    expect(result.best.attempt).toBe(1)
    expect(result.attempts).toHaveLength(1)
    expect(result.exhausted).toBe(false)
  })

  it('retries until score passes threshold', async () => {
    let callCount = 0
    const scores = [30, 50, 80]
    const regenerate = async (output: SmartApplicationOutput, _s: RetriableSection[], _a: number) => {
      output.validationHints.humanizationTips = [`score:${scores[Math.min(callCount, scores.length - 1)]}`]
      callCount++
      return output
    }
    const validate = async (output: SmartApplicationOutput) => {
      const score = parseInt(output.validationHints.humanizationTips[0]?.split(':')[1] || '0', 10)
      return { overall: score, perSection: { summary: score, experience: score } }
    }

    const result = await orchestrateRetry(
      'test', regenerate, validate, undefined,
      { test: { maxRetries: 4, scoreThreshold: 70, backoffMs: 1 } },
    )

    expect(result.best.passed).toBe(true)
    expect(result.best.attempt).toBe(3)
    expect(result.best.score).toBe(80)
    expect(result.attempts).toHaveLength(3)
    expect(result.exhausted).toBe(false)
  })

  it('exhausts maxRetries when score never passes threshold', async () => {
    let callCount = 0
    const scores = [20, 30, 25]
    const regenerate = async (output: SmartApplicationOutput, _s: RetriableSection[], _a: number) => {
      output.validationHints.humanizationTips = [`score:${scores[Math.min(callCount, scores.length - 1)]}`]
      callCount++
      return output
    }
    const validate = async (output: SmartApplicationOutput) => {
      const score = parseInt(output.validationHints.humanizationTips[0]?.split(':')[1] || '0', 10)
      return { overall: score, perSection: { summary: score, experience: score } }
    }

    const result = await orchestrateRetry(
      'test', regenerate, validate, undefined,
      // Tiny backoff to avoid timeout — real delays are tested separately in policy tests
      { test: { maxRetries: 3, scoreThreshold: 70, backoffMs: 1 } },
    )

    expect(result.best.passed).toBe(false)
    expect(result.attempts).toHaveLength(3)
    expect(result.exhausted).toBe(true)
    // Best should be the highest score across attempts
    expect(result.best.score).toBe(30)
  })

  it('returns best result (highest score) across attempts', async () => {
    let callCount = 0
    const scores = [30, 90, 50]
    const regenerate = async (output: SmartApplicationOutput, _s: RetriableSection[], _a: number) => {
      output.validationHints.humanizationTips = [`score:${scores[Math.min(callCount, scores.length - 1)]}`]
      callCount++
      return output
    }
    const validate = async (output: SmartApplicationOutput) => {
      const score = parseInt(output.validationHints.humanizationTips[0]?.split(':')[1] || '0', 10)
      return { overall: score, perSection: { summary: score, experience: score } }
    }

    const result = await orchestrateRetry(
      'test', regenerate, validate, undefined,
      { test: { maxRetries: 3, scoreThreshold: 70, backoffMs: 1 } },
    )

    // Should stop at attempt 2 because it passed (90 >= 70)
    expect(result.attempts).toHaveLength(2)
    expect(result.best.passed).toBe(true)
    expect(result.best.score).toBe(90)
  })

  it('uses per-section strategy and only retries low-scoring sections', async () => {
    let callCount = 0
    // Section scores on attempt 1: summary=80 (pass), experience=20 (fail)
    // On attempt 2: summary=80 (pass), experience=85 (pass)
    const perSectionScores = [
      { summary: 80, experience: 20 },
      { summary: 80, experience: 85 },
    ]
    const regenerate = async (output: SmartApplicationOutput, sections: RetriableSection[], _a: number) => {
      const state = perSectionScores[Math.min(callCount, perSectionScores.length - 1)]
      output.validationHints.humanizationTips = [
        `summary:${state.summary}`, `experience:${state.experience}`,
        `retried:${sections.join(',')}`,
      ]
      callCount++
      return output
    }
    const validate = async (output: SmartApplicationOutput) => {
      const tips = output.validationHints.humanizationTips
      const summary = parseInt(tips[0]?.split(':')[1] || '0', 10)
      const experience = parseInt(tips[1]?.split(':')[1] || '0', 10)
      return {
        overall: Math.round((summary + experience) / 2),
        perSection: { summary, experience },
      }
    }

    const result = await orchestrateRetry(
      'test', regenerate, validate, undefined,
      { test: { maxRetries: 3, scoreThreshold: 70, strategy: 'per-section', backoffMs: 1 } },
    )

    expect(result.best.passed).toBe(true)
    expect(result.attempts).toHaveLength(2)
    // First attempt retried all sections (initial generation)
    expect(result.attempts[0].sectionsRetried).toContain('summary')
    expect(result.attempts[0].sectionsRetried).toContain('experience')
  })

  it('accepts initialInput and passes it to first regenerate call', async () => {
    const initial = buildEmptyOutput()
    initial.email.subject = 'initial-subject'

    let receivedInput: SmartApplicationOutput | null = null
    const regenerate = async (output: SmartApplicationOutput, _s: RetriableSection[], _a: number) => {
      receivedInput = output
      output.validationHints.humanizationTips = ['score:95']
      return output
    }
    const validate = async (_output: SmartApplicationOutput) => {
      return { overall: 95, perSection: { summary: 95, experience: 95 } }
    }

    await orchestrateRetry(
      'test', regenerate, validate, initial,
      { test: { maxRetries: 3, scoreThreshold: 70, backoffMs: 1 } },
    )

    expect(receivedInput).toBe(initial)
    expect(receivedInput?.email.subject).toBe('initial-subject')
  })

  it('uses full strategy to regenerate all sections on retry', async () => {
    let callCount = 0
    const scores = [30, 80]
    const regenerate = async (output: SmartApplicationOutput, sections: RetriableSection[], _a: number) => {
      output.validationHints.humanizationTips = [
        `score:${scores[Math.min(callCount, scores.length - 1)]}`,
        `sections:${sections.length}`,
      ]
      callCount++
      return output
    }
    const validate = async (output: SmartApplicationOutput) => {
      const score = parseInt(output.validationHints.humanizationTips[0]?.split(':')[1] || '0', 10)
      return { overall: score, perSection: { summary: score, experience: score } }
    }

    const result = await orchestrateRetry(
      'test', regenerate, validate, undefined,
      { test: { maxRetries: 3, scoreThreshold: 70, strategy: 'full', backoffMs: 1 } },
    )

    expect(result.best.passed).toBe(true)
    expect(result.attempts).toHaveLength(2)
  })

  it('reports sections that were retried on first attempt', async () => {
    let callCount = 0
    const regenerate = async (output: SmartApplicationOutput, _s: RetriableSection[], _a: number) => {
      output.validationHints.humanizationTips = ['score:95']
      callCount++
      return output
    }
    const validate = async (_output: SmartApplicationOutput) => {
      return { overall: 95, perSection: { summary: 95, experience: 95 } }
    }

    const result = await orchestrateRetry(
      'test', regenerate, validate, undefined,
      { test: { maxRetries: 3, scoreThreshold: 70, backoffMs: 1 } },
    )

    expect(result.attempts[0].sectionsRetried).toContain('summary')
    expect(result.attempts[0].sectionsRetried).toContain('experience')
    expect(result.attempts[0].sectionsRetried).toContain('skills')
  })
})
