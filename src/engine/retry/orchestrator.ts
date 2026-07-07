/**
 * Retry Orchestrator — Phase 7.2
 *
 * Orchestrates retry at the section level. Instead of regenerating the
 * entire output, it identifies which sections scored below threshold
 * and re-runs the stage on only those sections.
 *
 * Flow:
 * 1. Run stage on full input (first attempt = always run first)
 * 2. Run relevant validators on the output
 * 3. If all scores > threshold → done
 * 4. If any score < threshold:
 *    a. Identify low-scoring sections from the output
 *    b. Apply backoff
 *    c. Re-run stage on only those sections
 *    d. Re-validate only changed sections
 *    e. Repeat until maxRetries or all pass
 * 5. Return best result (highest score across attempts)
 */

import type { SmartApplicationOutput } from '../../systems/smart-application/types'
import { resolvePolicy, calculateBackoff, type StagePolicyMap, type RetryAttempt, type RetryResult } from './policy'

/** Sections within SmartApplicationOutput that can be individually retried. */
export type RetriableSection = 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'cover-letter' | 'email-body'

/**
 * A validate function that returns per-section scores.
 * Section names match RetriableSection values.
 */
export type SectionValidateFn = (
  output: SmartApplicationOutput,
) => Promise<{ overall: number; perSection: Record<string, number> }>

/**
 * A regenerate function that takes the current output and a list of
 * section names to regenerate, and returns the updated output.
 */
export type SectionRegenerateFn = (
  output: SmartApplicationOutput,
  sectionsToRetry: RetriableSection[],
  attempt: number,
) => Promise<SmartApplicationOutput>

/**
 * Orchestrate retry for a single pipeline stage.
 *
 * @param stageName - Name of the stage (e.g. 'generate', 'truth_gate')
 * @param regenerateFn - Function to regenerate specific sections
 * @param validateFn - Function to validate output and return per-section scores
 * @param initialInput - Optional starting output (omit for generate stage where there's no prior output)
 * @param overrides - Optional per-stage policy overrides
 * @returns The best result across all attempts
 */
export async function orchestrateRetry(
  stageName: string,
  regenerateFn: SectionRegenerateFn,
  validateFn: SectionValidateFn,
  initialInput?: SmartApplicationOutput,
  overrides?: StagePolicyMap,
): Promise<RetryResult<SmartApplicationOutput>> {
  const policy = resolvePolicy(stageName, overrides)
  const startTime = Date.now()
  const attempts: Array<RetryAttempt<SmartApplicationOutput>> = []

  let currentOutput: SmartApplicationOutput = emptyOutput()
  let bestAttempt: RetryAttempt<SmartApplicationOutput> | null = null

  // First attempt: always run the stage before validating
  const allSections: RetriableSection[] = [
    'summary', 'experience', 'projects', 'skills', 'education',
    'certifications', 'cover-letter', 'email-body',
  ]

  for (let attempt = 1; attempt <= policy.maxRetries; attempt++) {
    const attemptStart = Date.now()

    if (attempt === 1) {
      // First attempt: run the stage first, then validate
      if (initialInput) {
        currentOutput = await regenerateFn(initialInput, allSections, attempt)
    } else {
      // No initial input (generate stage) — start from empty output so
      // the regenerate function has a valid object to work with.
      currentOutput = await regenerateFn(emptyOutput(), allSections, attempt)
    }
    } else {
      // Subsequent attempts: apply backoff, then retry low-scoring sections
      const backoffMs = calculateBackoff(attempt, policy.backoffMs)
      await sleep(backoffMs)
    }

    // Validate the current output
    const { overall, perSection } = await validateFn(currentOutput)
    const lowScoreSections = Object.entries(perSection)
      .filter(([, score]) => score < policy.scoreThreshold)
      .map(([section]) => section as RetriableSection)

    const sectionsRetried: RetriableSection[] = attempt === 1
      ? allSections  // First attempt touched everything
      : lowScoreSections

    const attemptResult: RetryAttempt<SmartApplicationOutput> = {
      attempt,
      result: currentOutput,
      score: overall,
      passed: overall >= policy.scoreThreshold,
      durationMs: Date.now() - attemptStart,
      sectionsRetried,
    }
    attempts.push(attemptResult)

    // Track best by score
    if (!bestAttempt || attemptResult.score > bestAttempt.score) {
      bestAttempt = attemptResult
    }

    // Check if we passed
    if (attemptResult.passed) {
      break
    }

    // On subsequent attempts, only retry low-scoring sections
    if (attempt < policy.maxRetries && lowScoreSections.length > 0) {
      const retrySections = policy.strategy === 'full'
        ? allSections
        : lowScoreSections

      currentOutput = await regenerateFn(currentOutput, retrySections, attempt + 1)
    }
  }

  // Safety: bestAttempt must be set
  if (!bestAttempt) {
    bestAttempt = attempts[attempts.length - 1]
  }

  return {
    best: bestAttempt,
    attempts,
    totalDurationMs: Date.now() - startTime,
    exhausted: attempts.length >= policy.maxRetries && !attempts.some(a => a.passed),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function emptyOutput(): SmartApplicationOutput {
  return {
    analysis: {
      company: '', role: '', employmentType: 'full-time',
      experienceLevel: 'entry', requiredSkills: [], preferredSkills: [],
      responsibilities: [], keywords: [], atsKeywords: [], softSkills: [],
      redFlags: [], matchPercent: 0, salaryRange: null, location: null,
    },
    resume: { markdown: '', sections: {} },
    email: { subject: '', body: '', tone: 'professional' },
    coverLetter: '',
    validationHints: { atsKeywordsToInclude: [], truthFlags: [], humanizationTips: [] },
  }
}
