/**
 * Feedback Aggregator — Phase 10.1
 *
 * Collects feedback from user actions:
 * - Export edits: user changes to generated resume before export
 * - Re-generations: when user regenerates a section
 * - Validation overrides: when user accepts output despite low score
 * - Explicit ratings: thumbs up/down on final output
 */

export type FeedbackSource = 'export-edit' | 'regeneration' | 'validation-override' | 'explicit-rating'

export interface FeedbackEvent {
  userId: string
  timestamp: number
  source: FeedbackSource
  phase: string
  /** The original generated content */
  original: string
  /** The user's edited version (for export-edit) */
  edited?: string
  /** Simple diff representation */
  diff?: string
  /** Score at the time of feedback */
  score: number
  /** Section name when applicable */
  section?: string
  /** User rating (for explicit-rating) */
  rating?: 'up' | 'down'
}

import { saveJSON, loadJSON } from '../utils/fileStore'

const STORE_NAME = 'feedback'

function computeDiff(original: string, edited: string): string {
  if (original === edited) return ''

  const origLines = original.split('\n')
  const editLines = edited.split('\n')
  const changes: string[] = []

  let maxLen = Math.max(origLines.length, editLines.length)
  for (let i = 0; i < maxLen; i++) {
    if (origLines[i] !== editLines[i]) {
      if (origLines[i] && editLines[i]) {
        changes.push(`L${i + 1}: "${origLines[i].substring(0, 60)}" → "${editLines[i].substring(0, 60)}"`)
      } else if (editLines[i]) {
        changes.push(`L${i + 1}: +"${editLines[i].substring(0, 60)}"`)
      } else {
        changes.push(`L${i + 1}: -"${origLines[i]?.substring(0, 60)}"`)
      }
      if (changes.length >= 5) {
        changes.push(`... +${maxLen - i - 1} more changes`)
        break
      }
    }
  }

  return changes.join('\n')
}

export class FeedbackAggregator {
  private events: FeedbackEvent[] = []
  private readonly maxSize: number

  constructor(maxSize = 10000) {
    this.maxSize = maxSize
  }

  record(event: FeedbackEvent): void {
    this.events.push({
      ...event,
      diff: event.edited ? computeDiff(event.original, event.edited) : undefined,
    })
    if (this.events.length > this.maxSize) {
      this.events.shift()
    }
    // Persist to disk after each record (feedback events are less frequent than pipeline runs)
    this.persist()
  }

  getRecent(count = 100): FeedbackEvent[] {
    return this.events.slice(-count)
  }

  getAll(): FeedbackEvent[] {
    return [...this.events]
  }

  getBySource(source: FeedbackSource): FeedbackEvent[] {
    return this.events.filter(e => e.source === source)
  }

  getByPhase(phase: string): FeedbackEvent[] {
    return this.events.filter(e => e.phase === phase)
  }

  clear(): void {
    this.events = []
  }

  get size(): number {
    return this.events.length
  }

  /** Persist current feedback events to disk. */
  persist(): void {
    saveJSON(STORE_NAME, this.events)
  }

  /** Load feedback events from disk, merging into current state. */
  load(): void {
    const saved = loadJSON<FeedbackEvent[]>(STORE_NAME, [])
    if (saved.length > 0) {
      const merged = [...saved, ...this.events].slice(-this.maxSize)
      this.events = merged
    }
  }
}

export const feedbackAggregator = new FeedbackAggregator()

// Auto-load persisted feedback on cold start
feedbackAggregator.load()
