/**
 * Retry Policy System — Phase 7.1
 *
 * Configurable per-stage retry policies with exponential backoff.
 * Each pipeline stage can have its own policy, and stage names are
 * matched by the orchestrator to select the right policy.
 */

/** Retry strategy: per-section retries only the low-scoring output sections; full regenerates everything. */
export type RetryStrategy = 'per-section' | 'full'

export interface RetryPolicy {
  /** Maximum retry attempts before giving up */
  maxRetries: number
  /** Minimum validator score (0-100) to consider a retry attempt successful */
  scoreThreshold: number
  /** Base backoff in ms (doubles each attempt: base * 2^(attempt-1)) */
  backoffMs: number
  /** Retry strategy */
  strategy: RetryStrategy
}

/** Per-stage policy overrides — stage names match pipeline stage names (e.g. 'generate', 'truth_gate', 'humanization', 'ats_fill'). */
export type StagePolicyMap = Record<string, Partial<RetryPolicy>>

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  scoreThreshold: 70,
  backoffMs: 1000,
  strategy: 'per-section',
}

/**
 * Per-stage defaults.
 * These override DEFAULT_RETRY_POLICY for specific stages.
 */
export const STAGE_POLICIES: StagePolicyMap = {
  // Generation: high retries, per-section retry to avoid losing good sections
  generate: { maxRetries: 3, scoreThreshold: 70, strategy: 'per-section' },
  // Truth gate: more retries since factual accuracy is critical, full retry to re-check all claims
  truth_gate: { maxRetries: 5, scoreThreshold: 85, strategy: 'full' },
  // Humanization: fewer retries, low threshold — any improvement is acceptable
  humanization: { maxRetries: 2, scoreThreshold: 60, strategy: 'per-section' },
  // ATS fill: moderate retries, per-section is fine
  ats_fill: { maxRetries: 2, scoreThreshold: 65, strategy: 'per-section' },
}

/** Resolve the effective policy for a given stage name. */
export function resolvePolicy(stageName: string, overrides?: StagePolicyMap): RetryPolicy {
  const stageOverride = STAGE_POLICIES[stageName] ?? {}
  const userOverride = overrides?.[stageName] ?? {}
  return {
    ...DEFAULT_RETRY_POLICY,
    ...stageOverride,
    ...userOverride,
  }
}

/**
 * Calculate exponential backoff delay for a given attempt number.
 * Formula: baseBackoff * 2^(attempt-1) + jitter (±20%)
 */
export function calculateBackoff(attempt: number, baseBackoffMs: number): number {
  const exponential = baseBackoffMs * Math.pow(2, attempt - 1)
  const jitter = exponential * (0.8 + Math.random() * 0.4) // 80%–120%
  return Math.round(jitter)
}

/** Result of a single retry attempt */
export interface RetryAttempt<T> {
  attempt: number
  result: T
  score: number
  passed: boolean
  durationMs: number
  /** Which sections were retried (empty = all sections passed without retry) */
  sectionsRetried: string[]
  error?: string
}

/** Cumulative result of all retry attempts */
export interface RetryResult<T> {
  best: RetryAttempt<T>
  attempts: RetryAttempt<T>[]
  totalDurationMs: number
  exhausted: boolean
}
