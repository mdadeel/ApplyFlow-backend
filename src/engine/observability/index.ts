/**
 * Observability entry point — Phase 9
 *
 * Health endpoint: GET /api/v1/engine/health
 * Exposes: status, uptime, lastRun, metrics
 */

import { Router, Request, Response } from 'express'
import { pipelineMetrics } from './metrics'
import { getAIProvider } from '../../systems/ai'

const router = Router()
const started = Date.now()
let lastRunTimestamp: number | null = null
let lastAICheck: { responsive: boolean; latencyMs: number; checkedAt: number } | null = null
const AI_CHECK_TIMEOUT_MS = 5_000 // 5s timeout for AI health check

export function markPipelineRun(): void {
  lastRunTimestamp = Date.now()
}

/**
 * Module-level cache for auto-tuning suggestions, injected by the pipeline.
 * This avoids a circular dependency: observability → learning → patternDetector → observability/metrics.
 */
let currentSuggestions: Array<{ stage: string; field: string; from: number | string; to: number | string; reason: string }> = []

/**
 * Set the current auto-tuning suggestions from the learning module.
 * Called by the pipeline after pattern detection runs.
 */
export function setTuningSuggestions(
  suggestions: Array<{ stage: string; field: string; from: number | string; to: number | string; reason: string }>
): void {
  currentSuggestions = suggestions
}

/**
 * Actually verify the AI provider is responsive by sending a lightweight ping.
 * Cached for 30s to avoid hammering the provider on every health check request.
 */
async function checkAIResponsive(): Promise<{ responsive: boolean; latencyMs: number }> {
  const now = Date.now()
  // Cache check for 30s
  if (lastAICheck && now - lastAICheck.checkedAt < 30_000) {
    return { responsive: lastAICheck.responsive, latencyMs: lastAICheck.latencyMs }
  }

  const start = Date.now()
  try {
    const provider = getAIProvider()
    // Lightweight ping — send a trivial prompt with low temperature
    const result = await Promise.race([
      provider.generateText('Respond with exactly: ok', 0.1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI health check timed out')), AI_CHECK_TIMEOUT_MS)
      ),
    ])
    const latencyMs = Date.now() - start
    const responsive = result.toLowerCase().includes('ok') || result.length > 0
    lastAICheck = { responsive, latencyMs, checkedAt: Date.now() }
    return { responsive, latencyMs }
  } catch {
    const latencyMs = Date.now() - start
    lastAICheck = { responsive: false, latencyMs, checkedAt: Date.now() }
    return { responsive: false, latencyMs }
  }
}

/** Mount at /api/v1/engine */
router.get('/health', async (_req: Request, res: Response) => {
  const { responsive: aiResponsive, latencyMs: aiLatency } = await checkAIResponsive()

  const metrics = pipelineMetrics.getAll()
  const uptime = Date.now() - started

  res.json({
    status: aiResponsive ? 'healthy' : 'degraded',
    uptime: Math.floor(uptime / 1000),
    uptimeHuman: formatDuration(uptime),
    lastRun: lastRunTimestamp
      ? { timestamp: lastRunTimestamp, ago: Date.now() - lastRunTimestamp + 'ms' }
      : null,
    metrics,
    aiProvider: aiResponsive ? 'responsive' : 'unreachable',
    aiLatencyMs: aiLatency,
    totalRuns: pipelineMetrics.size,
    maxWindow: pipelineMetrics.capacity,
    autoTuning: {
      active: currentSuggestions.length > 0,
      suggestionCount: currentSuggestions.length,
      suggestions: currentSuggestions,
    },
  })
})

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export default router
