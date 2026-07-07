import type { EvidenceSource } from './types'

export interface ScoreResult {
  /** Final confidence score 0-1 */
  score: number
  /** Number of distinct evidence sources */
  sources: number
  /** How many conflicts were detected among the evidence */
  conflicts: number
  /** Per-source breakdown */
  breakdown: Array<{ source: string; weight: number; reason: string }>
}

const MAX_EXPECTED_SOURCES = 5  // beyond this, inverse frequency kicks in

/**
 * Score a claim against its supporting evidence sources.
 *
 * Uses inverse-frequency weighting:
 * - Claims appearing in only 1 source → full weight (1.0)
 * - Claims appearing in many sources → diminished per-source weight (avoids
 *   over-counting the same fact repeated across sections)
 * - If any source contradicts another, a penalty is applied.
 */
export function scoreClaim(
  claim: string,
  evidenceSources: EvidenceSource[],
  existingScore?: number,
  conflictCount?: number,
): ScoreResult {
  if (evidenceSources.length === 0) {
    return { score: 0, sources: 0, conflicts: 0, breakdown: [] }
  }

  const breakdown: ScoreResult['breakdown'] = []
  const conflicts = conflictCount ?? 0

  // Count distinct source types for diversity bonus
  const sourceTypes = new Set(evidenceSources.map(s => s.sourceType))
  const typeDiversity = sourceTypes.size / 3  // 3+ types → full bonus
  const diversityBonus = Math.min(typeDiversity, 1) * 0.1

  // Inverse-frequency: more sources = each contributes less
  const sourceCount = evidenceSources.length
  let baseScore: number
  if (sourceCount === 0) {
    baseScore = 0
  } else if (sourceCount <= MAX_EXPECTED_SOURCES) {
    // Linear ramp: 1 source = 0.6, MAX sources = 1.0
    baseScore = 0.6 + (sourceCount / MAX_EXPECTED_SOURCES) * 0.4
  } else {
    // Inverse frequency: more sources beyond MAX contribute diminishing returns
    baseScore = 1.0 - (MAX_EXPECTED_SOURCES / sourceCount) * 0.2
  }

  // Confidence quality bonus: exact matches contribute more than inferred
  let qualitySum = 0
  for (const src of evidenceSources) {
    const qualityWeight = src.confidence === 'exact' ? 1.0
      : src.confidence === 'partial' ? 0.7
      : 0.4
    qualitySum += qualityWeight
    breakdown.push({
      source: `${src.sourceLabel} (${src.field})`,
      weight: Math.round(qualityWeight * 100) / 100,
      reason: `confidence: ${src.confidence}`,
    })
  }
  const qualityBonus = (qualitySum / evidenceSources.length) * 0.15

  // Conflict penalty
  const conflictPenalty = conflicts * 0.15

  // Existing score consideration (for merged claims)
  const mergeBonus = existingScore ? Math.max(0, existingScore - 0.5) * 0.1 : 0

  // Final score clamped to [0, 1]
  const raw = baseScore + diversityBonus + qualityBonus + mergeBonus - conflictPenalty
  const score = Math.max(0, Math.min(1, raw))

  return {
    score: Math.round(score * 100) / 100,
    sources: evidenceSources.length,
    conflicts,
    breakdown,
  }
}

/**
 * Compute an aggregate confidence score for a set of claims.
 * Returns overall score as a percentage (0-100) with pass/fail.
 */
export function aggregateConfidence(
  scores: ScoreResult[],
  threshold: number = 0.7,
): { overall: number; passed: boolean; avgScore: number; totalSources: number; totalConflicts: number } {
  if (scores.length === 0) {
    return { overall: 100, passed: true, avgScore: 1, totalSources: 0, totalConflicts: 0 }
  }

  const totalSources = scores.reduce((s, r) => s + r.sources, 0)
  const totalConflicts = scores.reduce((s, r) => s + r.conflicts, 0)
  const avgScore = scores.reduce((s, r) => s + r.score, 0) / scores.length
  const overall = Math.round(avgScore * 100)

  return {
    overall,
    passed: avgScore >= threshold,
    avgScore,
    totalSources,
    totalConflicts,
  }
}
