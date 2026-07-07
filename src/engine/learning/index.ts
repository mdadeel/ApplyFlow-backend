/**
 * Continuous Learning — Phase 10 entry point
 *
 * Analyzes feedback + metrics patterns and suggests config adjustments
 * for the pipeline (validator thresholds, retry policies, prompt adjustments).
 *
 * Auto-tunes pipeline configuration by caching suggestions from pattern
 * detection and converting them to StagePolicyMap overrides that get
 * merged into runPipeline's retryOverrides on subsequent calls.
 */

import { feedbackAggregator } from './feedbackAggregator'
import { detectPatterns, type Pattern } from './patternDetector'
import type { StagePolicyMap } from '../retry/policy'

export { FeedbackAggregator } from './feedbackAggregator'
export type { FeedbackEvent } from './feedbackAggregator'
export { detectPatterns } from './patternDetector'
export type { PatternType, Pattern, PatternReport } from './patternDetector'
export { anonymizeRecord, anonymizeText } from './anonymizer'

export interface ConfigSuggestion {
  stage: string
  field: string
  currentValue: number | string
  suggestedValue: number | string
  reason: string
  pattern: Pattern['type']
}

// ── Cached suggestions for auto-tuning ─────────────────────────────

let cachedSuggestions: ConfigSuggestion[] = []
let lastSuggestionRun = 0
const SUGGESTION_COOLDOWN_MS = 60_000 // Re-run pattern detection at most once per minute

/**
 * Get the current cached config suggestions.
 * These are generated automatically by detectPatterns() after each pipeline run.
 */
export function getCurrentSuggestions(): ConfigSuggestion[] {
  return [...cachedSuggestions]
}

/**
 * Clear all cached suggestions.
 * Used by the learning API reset endpoint.
 */
export function resetSuggestions(): void {
  cachedSuggestions = []
  lastSuggestionRun = 0
}

/**
 * Get the cached suggestions converted to a StagePolicyMap
 * that can be merged into runPipeline retryOverrides.
 */
export function getCurrentPolicyOverrides(): StagePolicyMap {
  return suggestionsToPolicyMap(cachedSuggestions)
}

// ── Suggestion generation ──────────────────────────────────────────

/** Generate pipeline config suggestions from detected patterns. */
export function suggestConfigChanges(): ConfigSuggestion[] {
  const report = detectPatterns()
  const suggestions: ConfigSuggestion[] = []

  for (const pattern of report.patterns) {
    switch (pattern.type) {
      case 'hallucination-hotspot': {
        suggestions.push({
          stage: 'truth_gate',
          field: 'maxRetries',
          currentValue: 5,
          suggestedValue: 7,
          reason: pattern.description,
          pattern: pattern.type,
        })
        break
      }
      case 'rejection-loop': {
        suggestions.push({
          stage: pattern.section || 'generate',
          field: 'maxRetries',
          currentValue: 3,
          suggestedValue: 5,
          reason: pattern.description,
          pattern: pattern.type,
        })
        break
      }
      case 'over-correction': {
        suggestions.push({
          stage: 'humanization',
          field: 'scoreThreshold',
          currentValue: 60,
          suggestedValue: 50,
          reason: pattern.description,
          pattern: pattern.type,
        })
        break
      }
      case 'ats-miss': {
        suggestions.push({
          stage: 'ats_fill',
          field: 'scoreThreshold',
          currentValue: 65,
          suggestedValue: 55,
          reason: pattern.description,
          pattern: pattern.type,
        })
        break
      }
    }
  }

  return suggestions
}

/**
 * Apply config suggestions — caches them and returns the changes made.
 *
 * Cooldown: only re-runs pattern detection once per 60s to avoid
 * thrashing during rapid pipeline runs. Callers that need a fresh
 * analysis should call suggestConfigChanges() directly.
 *
 * Returns what WOULD be applied. The cached suggestions are consumed
 * by runPipeline via getCurrentPolicyOverrides().
 */
export function applyConfigSuggestions(): ConfigSuggestion[] {
  const now = Date.now()
  if (now - lastSuggestionRun < SUGGESTION_COOLDOWN_MS) {
    return cachedSuggestions.length > 0 ? [...cachedSuggestions] : []
  }

  const suggestions = suggestConfigChanges()
  cachedSuggestions = suggestions
  lastSuggestionRun = now

  for (const s of suggestions) {
    console.log(
      `[Learning] Config change: ${s.stage}.${s.field} ` +
      `${s.currentValue} → ${s.suggestedValue} (${s.reason})`
    )
  }

  return [...suggestions]
}

/**
 * Convert config suggestions to a StagePolicyMap that can be passed
 * to runPipeline's retryOverrides parameter.
 */
export function suggestionsToPolicyMap(suggestions: ConfigSuggestion[]): StagePolicyMap {
  const map: StagePolicyMap = {}
  for (const s of suggestions) {
    if (!map[s.stage]) {
      map[s.stage] = {}
    }
    if (s.field === 'maxRetries') {
      (map[s.stage] as Record<string, unknown>).maxRetries = s.suggestedValue
    } else if (s.field === 'scoreThreshold') {
      (map[s.stage] as Record<string, unknown>).scoreThreshold = s.suggestedValue
    }
  }
  return map
}
