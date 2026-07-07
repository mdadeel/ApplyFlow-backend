import type { Resume } from '../types/resume'
import type { JobAnalysis } from '../types/job-analysis'
import type { Plan } from '../planner'
import { getAIProvider } from '../../systems/ai'
import type { AIProvider } from '../../systems/ai/aiProvider'
import type { SmartApplicationOutput } from '../../systems/smart-application/types'
import { ResponseParser } from '../../systems/smart-application/responseParser'
import { validateTruthAgainstProfile, stripUnverifiableClaims } from '../../systems/document-validation/truthGate'
import { RefinementService } from '../../systems/smart-application/refinementService'
import type { CareerProfile } from '../../systems/career-data/profileService'
import { orchestrateRetry } from '../retry/orchestrator'
import type { StagePolicyMap } from '../retry/policy'
import { createStageLogger } from '../observability/logger'
import { pipelineMetrics } from '../observability/metrics'
import { markPipelineRun, setTuningSuggestions } from '../observability/index'
import { analyticsStore } from '../observability/analytics'
import { applyConfigSuggestions, getCurrentPolicyOverrides } from '../learning'

export interface PipelineConfig {
  maxRetries: number
  scoreThreshold: number
  minATSScore: number
  minConfidence: number
  runHumanization: boolean
  runATSfill: boolean
  runTruthGate: boolean
  /** Per-stage retry policy overrides (keyed by stage name) */
  retryOverrides?: StagePolicyMap
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxRetries: 3,
  scoreThreshold: 0.7,
  minATSScore: 60,
  minConfidence: 70,
  runHumanization: true,
  runATSfill: true,
  runTruthGate: true,
}

export interface PipelineStage {
  name: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'warning'
  error?: string
  durationMs?: number
  /** Number of retry attempts made */
  attempts?: number
  /** Which sections were retried */
  sectionsRetried?: string[]
  /** Scores per attempt */
  attemptScores?: number[]
}

export interface PipelineResult {
  output: SmartApplicationOutput
  stages: PipelineStage[]
  attempts: number
  scores: { ats: number; match: number; overall: number }
}

/**
 * Generation pipeline orchestrator.
 *
 * Runs stages sequentially with per-stage error handling and retry:
 * 1. Generate (with retry via orchestrator)
 * 2. Truth gate validation (with retry)
 * 3. Humanization refinement (with retry)
 * 4. ATS gap fill (with retry)
 * 5. Score calculation
 *
 * Each stage is independent — if a stage fails, subsequent stages still run
 * on the best available output so far.
 *
 * Observability: each stage emits structured logs and analytics events.
 */
export async function runPipeline(
  generateFn: (retrySections?: string[]) => Promise<SmartApplicationOutput>,
  careerProfile: CareerProfile,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): Promise<PipelineResult> {
  const aiProvider = getAIProvider()
  const refinementService = new RefinementService()
  const stages: PipelineStage[] = []

  // Merge learned policy overrides (from pattern detection) with user-provided overrides.
  // Learned overrides act as defaults that users can override explicitly at the field level.
  const learnedOverrides = getCurrentPolicyOverrides()
  const retryOverrides: StagePolicyMap = { ...learnedOverrides }
  if (config.retryOverrides) {
    // Deep-merge at the stage level so individual field overrides combine
    for (const [stage, overrides] of Object.entries(config.retryOverrides)) {
      retryOverrides[stage] = { ...retryOverrides[stage], ...overrides }
    }
  }
  if (Object.keys(learnedOverrides).length > 0) {
    console.log(`[Pipeline] Merging ${Object.keys(learnedOverrides).length} learned config overrides from pattern detection`)
  }

  const log = createStageLogger('pipeline')

  analyticsStore.record({ type: 'generation_start', timestamp: Date.now() })

  // ── Stage 1: Generate ───────────────────────────────────────────────
  stages.push({ name: 'generate', status: 'running' })
  const stage1Start = Date.now()
  const genLog = createStageLogger('generate')
  let output: SmartApplicationOutput

  genLog.info('stage_start')

  try {
    const result = await orchestrateRetry(
      'generate',
      // Regenerate function: pass low-scoring sections as hints to generateFn
      async (_current, sections, _attempt) => {
        const raw = await generateFn(sections.length > 0 ? sections : undefined)
        return raw
      },
      // Validate function: compute overall + per-section scores
      async (output) => {
        const scores = ResponseParser.calculateScores(output)
        const perSection: Record<string, number> = {}
        if (output.resume.sections?.summary) perSection.summary = scores.overall
        if (output.resume.sections?.experience?.length) perSection.experience = scores.overall
        if (output.resume.sections?.projects?.length) perSection.projects = scores.overall
        if (output.resume.sections?.skills?.length) perSection.skills = scores.overall
        return { overall: scores.overall, perSection }
      },
      // No initial input for generate stage
      undefined,
      retryOverrides,
    )

    output = result.best.result
    stages[stages.length - 1] = {
      name: 'generate',
      status: result.best.passed ? 'passed' : 'failed',
      durationMs: Date.now() - stage1Start,
      attempts: result.attempts.length,
      sectionsRetried: result.best.sectionsRetried,
      attemptScores: result.attempts.map(a => a.score),
    }

    genLog.info('stage_complete', {
      latency: Date.now() - stage1Start,
      score: result.best.score,
      attempts: result.attempts.length,
      passed: result.best.passed,
    })

    analyticsStore.record({
      type: 'generation_complete',
      timestamp: Date.now(),
      stage: 'generate',
      score: result.best.score,
      retryCount: result.attempts.length,
      latencyMs: Date.now() - stage1Start,
    })
  } catch (err) {
    stages[stages.length - 1] = {
      name: 'generate',
      status: 'failed',
      error: (err as Error).message,
      durationMs: Date.now() - stage1Start,
    }

    genLog.error('stage_failed', {
      latency: Date.now() - stage1Start,
      error: (err as Error).message,
    })

    analyticsStore.record({
      type: 'generation_complete',
      timestamp: Date.now(),
      stage: 'generate',
      score: 0,
      retryCount: 0,
      latencyMs: Date.now() - stage1Start,
      metadata: { error: (err as Error).message },
    })

    // If generation fails entirely, we can't proceed
    throw err
  }

  // ── Stage 2: Truth gate ─────────────────────────────────────────────
  if (config.runTruthGate) {
    stages.push({ name: 'truth_gate', status: 'running' })
    const stage2Start = Date.now()
    const truthLog = createStageLogger('truth_gate')
    truthLog.info('stage_start')

    try {
      const result = await orchestrateRetry(
        'truth_gate',
        // Regenerate: strip unverifiable claims on each retry
        async (current) => {
          const truthResult = validateTruthAgainstProfile(current, careerProfile)
          if (truthResult.unverifiable.length > 0) {
            const cleaned = stripUnverifiableClaims(current, truthResult.unverifiable)
            cleaned.validationHints.truthFlags = [
              ...cleaned.validationHints.truthFlags,
              ...truthResult.unverifiable.map(u => `${u.reason} (at ${u.location})`),
            ]
            return cleaned
          }
          return current
        },
        // Validate: truth gate score = coverage of verifiable claims
        async (current) => {
          const truthResult = validateTruthAgainstProfile(current, careerProfile)
          const verifiable = truthResult.verified.length
          const total = verifiable + truthResult.unverifiable.length
          const overall = total > 0 ? Math.round((verifiable / total) * 100) : 100
          const perSection: Record<string, number> = { 'overall': overall }
          return { overall, perSection }
        },
        output,
        retryOverrides,
      )
      output = result.best.result
      stages[stages.length - 1] = {
        name: 'truth_gate',
        status: result.best.passed ? 'passed' : 'warning',
        durationMs: Date.now() - stage2Start,
        attempts: result.attempts.length,
        sectionsRetried: result.best.sectionsRetried,
        attemptScores: result.attempts.map(a => a.score),
      }

      truthLog.info('stage_complete', {
        latency: Date.now() - stage2Start,
        score: result.best.score,
        attempts: result.attempts.length,
        passed: result.best.passed,
      })

      analyticsStore.record({
        type: 'validation_result',
        timestamp: Date.now(),
        stage: 'truth_gate',
        score: result.best.score,
        retryCount: result.attempts.length,
        latencyMs: Date.now() - stage2Start,
      })
    } catch (err) {
      stages[stages.length - 1] = {
        name: 'truth_gate',
        status: 'failed',
        error: (err as Error).message,
        durationMs: Date.now() - stage2Start,
      }

      truthLog.error('stage_failed', {
        latency: Date.now() - stage2Start,
        error: (err as Error).message,
      })
    }
  }

  // ── Stage 3: Humanization ───────────────────────────────────────────
  if (config.runHumanization) {
    stages.push({ name: 'humanization', status: 'running' })
    const stage3Start = Date.now()
    const humanLog = createStageLogger('humanization')
    humanLog.info('stage_start')

    try {
      const result = await orchestrateRetry(
        'humanization',
        // Regenerate: run humanization refinement — sends the full text to AI for rewriting
        async (current) => {
          const { output: humanized } = await refinementService.refineHumanization(aiProvider, current)
          return humanized
        },
        // Validate: use deterministic humanization validator
        async (current) => {
          const { validateHumanization } = await import('../../systems/document-validation/humanizationValidator')
          const humanResult = validateHumanization(current.resume.markdown)
          const overall = humanResult.score
          const perSection: Record<string, number> = {}
          if (current.resume.sections?.summary) perSection.summary = humanResult.score
          if (current.resume.sections?.experience?.length) perSection.experience = humanResult.score
          return { overall, perSection }
        },
        output,
        retryOverrides,
      )
      output = result.best.result
      stages[stages.length - 1] = {
        name: 'humanization',
        status: result.best.passed ? 'passed' : 'warning',
        durationMs: Date.now() - stage3Start,
        attempts: result.attempts.length,
        sectionsRetried: result.best.sectionsRetried,
        attemptScores: result.attempts.map(a => a.score),
      }

      humanLog.info('stage_complete', {
        latency: Date.now() - stage3Start,
        score: result.best.score,
        attempts: result.attempts.length,
        passed: result.best.passed,
      })

      analyticsStore.record({
        type: 'validation_result',
        timestamp: Date.now(),
        stage: 'humanization',
        score: result.best.score,
        retryCount: result.attempts.length,
        latencyMs: Date.now() - stage3Start,
      })
    } catch (err) {
      stages[stages.length - 1] = {
        name: 'humanization',
        status: 'failed',
        error: (err as Error).message,
        durationMs: Date.now() - stage3Start,
      }

      humanLog.error('stage_failed', {
        latency: Date.now() - stage3Start,
        error: (err as Error).message,
      })
    }
  }

  // ── Stage 4: ATS fill ──────────────────────────────────────────────
  if (config.runATSfill) {
    stages.push({ name: 'ats_fill', status: 'running' })
    const stage4Start = Date.now()
    const atsLog = createStageLogger('ats_fill')
    atsLog.info('stage_start')

    try {
      const result = await orchestrateRetry(
        'ats_fill',
        // Regenerate: run ATS gap fill
        async (current) => {
          const { output: atsFilled } = await refinementService.fillATSGaps(aiProvider, current, careerProfile)
          return atsFilled
        },
        // Validate: compute keyword coverage per section
        async (current) => {
          const jdKeywords = [
            ...new Set([
              ...(current.analysis.atsKeywords || []),
              ...(current.analysis.requiredSkills || []),
            ].map(k => k.toLowerCase())),
          ]
          const resumeText = current.resume.markdown.toLowerCase()
          const found = jdKeywords.filter(kw => resumeText.includes(kw)).length
          const overall = jdKeywords.length > 0 ? Math.round((found / jdKeywords.length) * 100) : 100
          const perSection: Record<string, number> = {}
          if (current.resume.sections?.summary) {
            const sectionText = current.resume.sections.summary.toLowerCase()
            const sectionFound = jdKeywords.filter(kw => sectionText.includes(kw)).length
            perSection.summary = jdKeywords.length > 0 ? Math.round((sectionFound / jdKeywords.length) * 100) : 100
          }
          return { overall, perSection }
        },
        output,
        retryOverrides,
      )
      output = result.best.result
      stages[stages.length - 1] = {
        name: 'ats_fill',
        status: result.best.passed ? 'passed' : 'warning',
        durationMs: Date.now() - stage4Start,
        attempts: result.attempts.length,
        sectionsRetried: result.best.sectionsRetried,
        attemptScores: result.attempts.map(a => a.score),
      }

      atsLog.info('stage_complete', {
        latency: Date.now() - stage4Start,
        score: result.best.score,
        attempts: result.attempts.length,
        passed: result.best.passed,
      })
    } catch (err) {
      stages[stages.length - 1] = {
        name: 'ats_fill',
        status: 'failed',
        error: (err as Error).message,
        durationMs: Date.now() - stage4Start,
      }

      atsLog.error('stage_failed', {
        latency: Date.now() - stage4Start,
        error: (err as Error).message,
      })
    }
  }

  // ── Record observability metrics ───────────────────────────────────
  const scores = ResponseParser.calculateScores(output)
  for (const stage of stages) {
    if (stage.durationMs !== undefined) {
      pipelineMetrics.record({
        stage: stage.name,
        latency: stage.durationMs,
        passed: stage.status === 'passed',
        retryCount: stage.attempts ?? 1,
        score: scores.overall,
        timestamp: Date.now(),
      })
    }
  }
  markPipelineRun()
  log.info('pipeline_complete', { stages: stages.length, overallScore: scores.overall })

  // Persist observability data after each pipeline run
  pipelineMetrics.persist()
  analyticsStore.persist()

  // Trigger pattern detection from the metrics we just recorded.
  // Caches suggestions so the next pipeline run picks them up automatically.
  const newSuggestions = applyConfigSuggestions()

  // Inject suggestions into the health endpoint (avoids circular dependency)
  setTuningSuggestions(
    newSuggestions.map(s => ({
      stage: s.stage,
      field: s.field,
      from: s.currentValue,
      to: s.suggestedValue,
      reason: s.reason,
    }))
  )

  if (newSuggestions.length > 0) {
    log.info('learning_suggestions', {
      count: newSuggestions.length,
      suggestions: newSuggestions.map(s => `${s.stage}.${s.field}: ${s.suggestedValue}`),
    })
  }

  return { output, stages, attempts: 1, scores }
}
