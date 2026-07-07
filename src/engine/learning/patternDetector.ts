/**
 * Pattern Detector — Phase 10.2
 *
 * Analyzes feedback and pipeline metrics to detect recurring issues:
 * - Hallucination hot spots
 * - Rejection loops
 * - Over-correction
 * - ATS keyword misses
 */

import { feedbackAggregator, type FeedbackEvent } from './feedbackAggregator'
import { pipelineMetrics, type RunRecord } from '../observability/metrics'

export type PatternType =
  | 'hallucination-hotspot'
  | 'rejection-loop'
  | 'over-correction'
  | 'ats-miss'

export interface Pattern {
  type: PatternType
  section?: string
  severity: 'low' | 'medium' | 'high'
  frequency: number
  description: string
  suggestedAction: string
}

export interface PatternReport {
  patterns: Pattern[]
  generatedAt: number
}

/** Detect sections that consistently get low truth scores. */
function detectHallucinationHotspots(feedback: FeedbackEvent[], _runs: RunRecord[]): Pattern[] {
  const sectionScores = new Map<string, number[]>()

  for (const event of feedback) {
    if (event.source === 'regeneration' || event.source === 'validation-override') {
      if (event.section) {
        const existing = sectionScores.get(event.section)
        if (existing) {
          existing.push(event.score)
        } else {
          sectionScores.set(event.section, [event.score])
        }
      }
    }
  }

  const patterns: Pattern[] = []
  for (const [section, scores] of sectionScores.entries()) {
    const avgScore = scores.reduce((s, c) => s + c, 0) / scores.length
    if (avgScore < 60 && scores.length >= 3) {
      patterns.push({
        type: 'hallucination-hotspot',
        section,
        severity: avgScore < 40 ? 'high' : 'medium',
        frequency: scores.length,
        description: `Section "${section}" averages ${Math.round(avgScore)}% truth score across ${scores.length} runs`,
        suggestedAction: avgScore < 40
          ? 'Increase truth_gate retries to 7 for this section'
          : 'Review generation prompt for this section type',
      })
    }
  }
  return patterns
}

/** Detect sections that get regenerated 3+ times. */
function detectRejectionLoops(runs: RunRecord[]): Pattern[] {
  const retryCounts = new Map<string, number[]>()

  for (const run of runs) {
    if (run.retryCount >= 3) {
      const existing = retryCounts.get(run.stage)
      if (existing) {
        existing.push(run.retryCount)
      } else {
        retryCounts.set(run.stage, [run.retryCount])
      }
    }
  }

  const patterns: Pattern[] = []
  for (const [stage, counts] of retryCounts.entries()) {
    const avg = counts.reduce((s, c) => s + c, 0) / counts.length
    if (counts.length >= 2) {
      patterns.push({
        type: 'rejection-loop',
        section: stage,
        severity: avg >= 4 ? 'high' : 'medium',
        frequency: counts.length,
        description: `Stage "${stage}" averages ${avg.toFixed(1)} retries across ${counts.length} runs`,
        suggestedAction: avg >= 4
          ? `Increase maxRetries for ${stage} or reduce scoreThreshold`
          : `Review ${stage} stage validation logic`,
      })
    }
  }
  return patterns
}

/** Detect humanization removing truth-accurate claims. */
function detectOverCorrection(feedback: FeedbackEvent[]): Pattern[] {
  const editsBySection = new Map<string, number>()
  let regenerationCount = 0

  for (const event of feedback) {
    if (event.source === 'regeneration') {
      regenerationCount++
    }
    if (event.source === 'export-edit' && event.section) {
      editsBySection.set(event.section, (editsBySection.get(event.section) || 0) + 1)
    }
  }

  const patterns: Pattern[] = []
  if (regenerationCount > 10) {
    patterns.push({
      type: 'over-correction',
      severity: 'medium',
      frequency: regenerationCount,
      description: `${regenerationCount} regenerations triggered — humanization may be over-correcting`,
      suggestedAction: 'Reduce humanization scoreThreshold or switch to per-section strategy',
    })
  }

  for (const [section, count] of editsBySection.entries()) {
    if (count >= 3) {
      patterns.push({
        type: 'over-correction',
        section,
        severity: 'low',
        frequency: count,
        description: `Section "${section}" was manually edited ${count} times`,
        suggestedAction: `Review generation quality for "${section}" section type`,
      })
    }
  }
  return patterns
}

/** Detect JD keywords that the generator consistently misses. */
function detectATSMisses(runs: RunRecord[]): Pattern[] {
  const lowATSRuns = runs.filter(r => r.stage === 'ats_fill' && r.score < 65)

  if (lowATSRuns.length < 3) return []

  const avgScore = lowATSRuns.reduce((s, r) => s + r.score, 0) / lowATSRuns.length
  return [{
    type: 'ats-miss',
    severity: avgScore < 50 ? 'high' : 'medium',
    frequency: lowATSRuns.length,
    description: `ATS fill stage scored below 65 in ${lowATSRuns.length} of ${runs.filter(r => r.stage === 'ats_fill').length} runs (avg ${Math.round(avgScore)})`,
    suggestedAction: avgScore < 50
      ? 'Increase ATS keyword boost in plan generator'
      : 'Review ATS gap fill prompt for missed keyword categories',
  }]
}

/** Run all detectors and return a combined report. */
export function detectPatterns(): PatternReport {
  const feedback = feedbackAggregator.getAll()
  const runs = pipelineMetrics.getRaw()

  const patterns: Pattern[] = [
    ...detectHallucinationHotspots(feedback, runs),
    ...detectRejectionLoops(runs),
    ...detectOverCorrection(feedback),
    ...detectATSMisses(runs),
  ]

  return {
    patterns,
    generatedAt: Date.now(),
  }
}
