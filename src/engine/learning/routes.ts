/**
 * Learning API Routes
 *
 * Dedicated endpoints for the continuous learning system:
 * - View current auto-tuning suggestions
 * - Force re-run pattern detection
 * - Reset suggestions and cached state
 * - View feedback history and learning system status
 *
 * Mounted at /api/v1/engine/learning by backend/src/index.ts
 */

import { Router, Request, Response } from 'express'
import { sessionGuard } from '../../systems/identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import {
  getCurrentSuggestions,
  applyConfigSuggestions,
  resetSuggestions,
} from './index'
import { feedbackAggregator } from './feedbackAggregator'
import { pipelineMetrics } from '../observability/metrics'
import { analyticsStore } from '../observability/analytics'
import { detectPatterns } from './patternDetector'

const router = Router()

/**
 * GET /suggestions
 *
 * View current auto-tuning suggestions from pattern detection.
 * Returns both the cached suggestions and the raw policy overrides.
 */
router.get('/suggestions', sessionGuard, async (_req: Request, res: Response) => {
  const suggestions = getCurrentSuggestions()

  sendSuccess(res, {
    count: suggestions.length,
    lastUpdated: null, // could track timestamp in a future iteration
    active: suggestions.length > 0,
    suggestions: suggestions.map(s => ({
      stage: s.stage,
      field: s.field,
      currentValue: s.currentValue,
      suggestedValue: s.suggestedValue,
      reason: s.reason,
      pattern: s.pattern,
    })),
  })
})

/**
 * POST /suggestions/refresh
 *
 * Force re-run pattern detection and regenerate suggestions.
 * Resets the 60s cooldown so fresh pattern data is always returned.
 */
router.post('/suggestions/refresh', sessionGuard, async (_req: Request, res: Response) => {
  // Clear cooldown so applyConfigSuggestions runs fresh detection
  resetSuggestions()

  // Run fresh detection once (applyConfigSuggestions calls suggestConfigChanges
  // which calls detectPatterns internally)
  const applied = applyConfigSuggestions()
  const freshReport = detectPatterns()
  const freshSuggestions = getCurrentSuggestions()

  sendSuccess(res, {
    patternsFound: freshReport.patterns.length,
    suggestionsGenerated: freshSuggestions.length,
    changesApplied: applied.length,
    report: {
      generatedAt: freshReport.generatedAt,
      patterns: freshReport.patterns.map(p => ({
        type: p.type,
        section: p.section,
        severity: p.severity,
        frequency: p.frequency,
        description: p.description,
        suggestedAction: p.suggestedAction,
      })),
    },
    suggestions: freshSuggestions.map(s => ({
      stage: s.stage,
      field: s.field,
      from: s.currentValue,
      to: s.suggestedValue,
      reason: s.reason,
    })),
  })
})

/**
 * POST /suggestions/reset
 *
 * Reset all learning suggestions and cached state.
 * Does not clear raw metrics or feedback — only the derived suggestions.
 */
router.post('/suggestions/reset', sessionGuard, async (_req: Request, res: Response) => {
  resetSuggestions()

  sendSuccess(res, {
    ok: true,
    message: 'All learning suggestions have been cleared',
  })
})

/**
 * GET /feedback
 *
 * View recent feedback events from user interactions
 * (export edits, regenerations, validation overrides, ratings).
 *
 * Supports ?source=export-edit&limit=20 query filters.
 */
router.get('/feedback', sessionGuard, async (req: Request, res: Response) => {
  const source = req.query.source as string | undefined
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)

  let events = feedbackAggregator.getAll()

  // Filter by feedback source if specified
  if (source && ['export-edit', 'regeneration', 'validation-override', 'explicit-rating'].includes(source)) {
    events = events.filter(e => e.source === source)
  }

  const recent = events.slice(-limit).reverse()

  sendSuccess(res, {
    total: events.length,
    displayed: recent.length,
    source: source || 'all',
    events: recent.map(e => ({
      source: e.source,
      phase: e.phase,
      section: e.section,
      score: e.score,
      rating: e.rating,
      timestamp: e.timestamp,
      diff: e.diff ? e.diff.substring(0, 500) : undefined,
      hasOriginal: !!e.original,
      hasEdited: !!e.edited,
    })),
  })
})

/**
 * GET /status
 *
 * Full learning system status — aggregated view of the health
 * and activity of the continuous learning system.
 */
router.get('/status', sessionGuard, async (_req: Request, res: Response) => {
  const patterns = detectPatterns()
  const suggestions = getCurrentSuggestions()
  const feedback = feedbackAggregator.getAll()
  const metrics = pipelineMetrics.getAll()
  const analytics = analyticsStore.counts()

  // Count feedback by source
  const feedbackBySource: Record<string, number> = {}
  for (const event of feedback) {
    feedbackBySource[event.source] = (feedbackBySource[event.source] || 0) + 1
  }

  sendSuccess(res, {
    patterns: {
      total: patterns.patterns.length,
      generatedAt: patterns.generatedAt,
      byType: patterns.patterns.reduce<Record<string, number>>((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1
        return acc
      }, {}),
    },
    suggestions: {
      active: suggestions.length > 0,
      count: suggestions.length,
    },
    feedback: {
      total: feedback.length,
      bySource: feedbackBySource,
    },
    metrics: {
      totalRuns: Object.values(metrics).reduce((s, m) => s + m.totalRuns, 0),
      byStage: metrics,
    },
    analytics: analytics,
  })
})

export default router
