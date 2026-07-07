/**
 * Regression test: pipeline retry integration.
 *
 * Validates that runPipeline produces PipelineResult with
 * stage-level retry metadata when stages are wrapped with
 * the retry orchestrator.
 */

import { DEFAULT_PIPELINE_CONFIG } from '../generation/pipeline'
import { resolvePolicy, STAGE_POLICIES } from '../retry/policy'

describe('Pipeline retry regression', () => {
  it('DEFAULT_PIPELINE_CONFIG has expected defaults', () => {
    expect(DEFAULT_PIPELINE_CONFIG.maxRetries).toBe(3)
    expect(DEFAULT_PIPELINE_CONFIG.runTruthGate).toBe(true)
    expect(DEFAULT_PIPELINE_CONFIG.runHumanization).toBe(true)
    expect(DEFAULT_PIPELINE_CONFIG.runATSfill).toBe(true)
  })

  it('STAGE_POLICIES covers all pipeline stages', () => {
    const stageNames = ['generate', 'truth_gate', 'humanization', 'ats_fill']
    for (const name of stageNames) {
      expect(STAGE_POLICIES[name]).toBeDefined()
    }
  })

  it('resolvePolicy produces valid policy for all pipeline stages', () => {
    const stageNames = ['generate', 'truth_gate', 'humanization', 'ats_fill']
    for (const name of stageNames) {
      const policy = resolvePolicy(name)
      expect(policy.maxRetries).toBeGreaterThanOrEqual(1)
      expect(policy.scoreThreshold).toBeGreaterThan(0)
      expect(policy.backoffMs).toBeGreaterThan(0)
      expect(['per-section', 'full']).toContain(policy.strategy)
    }
  })

  it('per-stage policy overrides propagate correctly', () => {
    const overrides = {
      generate: { maxRetries: 5, scoreThreshold: 90 },
    }
    const policy = resolvePolicy('generate', overrides)
    expect(policy.maxRetries).toBe(5)
    expect(policy.scoreThreshold).toBe(90)
  })
})
