/**
 * Pipeline Metrics — Phase 9.2
 *
 * In-memory rolling window (last 1000 runs) for pipeline stage metrics.
 * Exposed via callback for pluggable output (console, file, external).
 */

export interface StageMetrics {
  totalRuns: number
  avgLatency: number
  passCount: number
  failCount: number
  avgRetryCount: number
  avgScore: number
}

export interface RunRecord {
  stage: string
  latency: number
  passed: boolean
  retryCount: number
  score: number
  timestamp: number
}

import { saveJSON, loadJSON, deleteStore } from '../utils/fileStore'

const STORE_NAME = 'metrics'
export const DEFAULT_WINDOW_SIZE = 1000

export class PipelineMetrics {
  private runs: RunRecord[] = []
  private readonly maxSize: number

  constructor(maxSize = DEFAULT_WINDOW_SIZE) {
    this.maxSize = maxSize
  }

  /** Record a single pipeline stage run. */
  record(run: RunRecord): void {
    this.runs.push(run)
    if (this.runs.length > this.maxSize) {
      this.runs.shift()
    }
  }

  /** Get aggregated metrics for all stages. */
  getAll(): Record<string, StageMetrics> {
    const byStage = new Map<string, RunRecord[]>()

    for (const run of this.runs) {
      const existing = byStage.get(run.stage)
      if (existing) {
        existing.push(run)
      } else {
        byStage.set(run.stage, [run])
      }
    }

    const result: Record<string, StageMetrics> = {}
    for (const [stage, stageRuns] of byStage.entries()) {
      const total = stageRuns.length
      const totalLatency = stageRuns.reduce((s, r) => s + r.latency, 0)
      const passCount = stageRuns.filter(r => r.passed).length
      const totalRetries = stageRuns.reduce((s, r) => s + r.retryCount, 0)
      const totalScore = stageRuns.reduce((s, r) => s + r.score, 0)

      result[stage] = {
        totalRuns: total,
        avgLatency: Math.round(totalLatency / total),
        passCount,
        failCount: total - passCount,
        avgRetryCount: Math.round((totalRetries / total) * 10) / 10,
        avgScore: Math.round(totalScore / total),
      }
    }
    return result
  }

  /** Get raw runs for external processing. */
  getRaw(): RunRecord[] {
    return [...this.runs]
  }

  /** Reset all metrics AND optionally delete persisted data. */
  reset(persistClear = false): void {
    this.runs = []
    if (persistClear) {
      deleteStore(STORE_NAME)
    }
  }

  /** Current window size. */
  get size(): number {
    return this.runs.length
  }

  /** Max window capacity. */
  get capacity(): number {
    return this.maxSize
  }

  /** Persist current run data to disk. */
  persist(): void {
    saveJSON(STORE_NAME, this.runs)
  }

  /** Load run data from disk, merging into current state. */
  load(): void {
    const saved = loadJSON<RunRecord[]>(STORE_NAME, [])
    if (saved.length > 0) {
      const merged = [...saved, ...this.runs].slice(-this.maxSize)
      this.runs = merged
    }
  }
}

/** Application-wide singleton */
export const pipelineMetrics = new PipelineMetrics()

// Auto-load persisted metrics on cold start
pipelineMetrics.load()

/** Emit metrics via callback (console, file, or external). */
export type MetricsCallback = (metrics: Record<string, StageMetrics>) => void

export const defaultMetricsCallback: MetricsCallback = (metrics) => {
  // Only log at info level, not as structured JSON (to avoid log noise)
  const summary = Object.entries(metrics).map(([stage, m]) =>
    `${stage}: ${m.totalRuns}runs/${m.avgLatency}ms/${m.avgScore}score`
  ).join(' | ')
  console.log(`[Metrics] ${summary}`)
}
