import { resolvePolicy, calculateBackoff, DEFAULT_RETRY_POLICY } from '../policy'

describe('resolvePolicy', () => {
  it('returns defaults for unknown stage', () => {
    const policy = resolvePolicy('unknown_stage')
    expect(policy).toEqual(DEFAULT_RETRY_POLICY)
  })

  it('returns stage-specific defaults for known stages', () => {
    const genPolicy = resolvePolicy('generate')
    expect(genPolicy.maxRetries).toBe(3)
    expect(genPolicy.strategy).toBe('per-section')

    const truthPolicy = resolvePolicy('truth_gate')
    expect(truthPolicy.maxRetries).toBe(5)
    expect(truthPolicy.scoreThreshold).toBe(85)
    expect(truthPolicy.strategy).toBe('full')

    const humanPolicy = resolvePolicy('humanization')
    expect(humanPolicy.maxRetries).toBe(2)
    expect(humanPolicy.scoreThreshold).toBe(60)

    const atsPolicy = resolvePolicy('ats_fill')
    expect(atsPolicy.maxRetries).toBe(2)
    expect(atsPolicy.scoreThreshold).toBe(65)
  })

  it('merges user overrides on top of stage defaults', () => {
    const policy = resolvePolicy('generate', {
      generate: { maxRetries: 5, scoreThreshold: 80 },
    })
    expect(policy.maxRetries).toBe(5)        // from override
    expect(policy.scoreThreshold).toBe(80)    // from override
    expect(policy.strategy).toBe('per-section') // from stage default
    expect(policy.backoffMs).toBe(1000)       // from global default
  })

  it('partial override preserves stage defaults', () => {
    const policy = resolvePolicy('truth_gate', {
      truth_gate: { maxRetries: 3 },
    })
    expect(policy.maxRetries).toBe(3)         // from override
    expect(policy.scoreThreshold).toBe(85)    // from stage default
    expect(policy.strategy).toBe('full')      // from stage default
  })

  it('handles empty overrides gracefully', () => {
    const policy = resolvePolicy('generate', {})
    expect(policy.maxRetries).toBe(3)
  })
})

describe('calculateBackoff', () => {
  it('returns a positive number', () => {
    const backoff = calculateBackoff(1, 1000)
    expect(backoff).toBeGreaterThan(0)
  })

  it('scales exponentially with attempt number', () => {
    const attempt1 = calculateBackoff(1, 1000)
    const attempt2 = calculateBackoff(2, 1000)
    const attempt3 = calculateBackoff(3, 1000)

    // Each attempt should be roughly double the previous (with jitter)
    // attempt2 ≈ 2000 * jitter, attempt1 ≈ 1000 * jitter
    expect(attempt2).toBeGreaterThan(attempt1)
    expect(attempt3).toBeGreaterThan(attempt2)
  })

  it('stays within 80%-120% jitter range of exponential', () => {
    const base = 1000
    for (let attempt = 1; attempt <= 5; attempt++) {
      const exponential = base * Math.pow(2, attempt - 1)
      const backoff = calculateBackoff(attempt, base)

      // 80% - 120% of exponential value
      const min = Math.round(exponential * 0.8)
      const max = Math.round(exponential * 1.2)
      expect(backoff).toBeGreaterThanOrEqual(min)
      expect(backoff).toBeLessThanOrEqual(max)
    }
  })

  it('produces varying results due to jitter', () => {
    const results = new Set<number>()
    for (let i = 0; i < 100; i++) {
      results.add(calculateBackoff(2, 1000))
    }
    // With jitter, we should get multiple distinct values
    expect(results.size).toBeGreaterThan(1)
  })
})
