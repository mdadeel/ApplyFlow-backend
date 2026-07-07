/**
 * Pipeline Analytics Integration — Phase 9.3
 *
 * Tracks pipeline events: generation_start, generation_complete,
 * generation_retry, validation_result, export.
 */

export type PipelineEventType =
  | 'generation_start'
  | 'generation_complete'
  | 'generation_retry'
  | 'validation_result'
  | 'export'

export interface PipelineEvent {
  type: PipelineEventType
  timestamp: number
  stage?: string
  score?: number
  retryCount?: number
  latencyMs?: number
  metadata?: Record<string, unknown>
}

export type EventCallback = (event: PipelineEvent) => void

import { saveJSON, loadJSON } from '../utils/fileStore'

const STORE_NAME = 'analytics'

/** In-memory analytics store (can be swapped for external). */
class AnalyticsStore {
  private events: PipelineEvent[] = []
  private readonly maxSize: number

  constructor(maxSize = 5000) {
    this.maxSize = maxSize
  }

  record(event: PipelineEvent): void {
    this.events.push(event)
    if (this.events.length > this.maxSize) {
      this.events.shift()
    }
  }

  /** Get events by type. */
  getByType(type: PipelineEventType): PipelineEvent[] {
    return this.events.filter(e => e.type === type)
  }

  /** Get events within a time range. */
  getByTimeRange(start: number, end: number): PipelineEvent[] {
    return this.events.filter(e => e.timestamp >= start && e.timestamp <= end)
  }

  /** Get most recent events. */
  getRecent(count = 50): PipelineEvent[] {
    return this.events.slice(-count)
  }

  /** Count events by type. */
  counts(): Record<PipelineEventType, number> {
    const result: Record<string, number> = {}
    for (const type of ['generation_start', 'generation_complete', 'generation_retry', 'validation_result', 'export'] as PipelineEventType[]) {
      result[type] = this.events.filter(e => e.type === type).length
    }
    return result as Record<PipelineEventType, number>
  }

  clear(): void {
    this.events = []
  }

  /** Persist current events to disk (overwrites previous snapshot). */
  persist(): void {
    saveJSON(STORE_NAME, this.events)
  }

  /** Load events from disk, merging into current state. */
  load(): void {
    const saved = loadJSON<PipelineEvent[]>(STORE_NAME, [])
    if (saved.length > 0) {
      // Keep the most recent events up to maxSize
      const merged = [...saved, ...this.events].slice(-this.maxSize)
      this.events = merged
    }
  }
}

export const analyticsStore = new AnalyticsStore()

// Auto-load persisted analytics on cold start
analyticsStore.load()
