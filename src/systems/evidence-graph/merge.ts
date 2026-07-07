import type { EvidenceNode, EvidenceSource, EvidenceEdge, EdgeType } from './types'
import { scoreClaim } from './scorer'

export interface MergeResult {
  merged: EvidenceNode[]
  edges: EvidenceEdge[]
  conflicts: MergeConflict[]
}

export interface MergeConflict {
  claim: string
  type: 'exact_conflict' | 'semantic_conflict' | 'contradiction'
  existing: EvidenceNode
  incoming: EvidenceNode
  resolution: 'keep_existing' | 'merge_sources' | 'flag_for_review'
}

/**
 * Deduplicate edges — if an edge with same source+target+type already exists, skip.
 */
function dedupEdge(existing: EvidenceEdge[], candidate: EvidenceEdge): boolean {
  const lowerSrc = candidate.source.toLowerCase()
  const lowerTgt = candidate.target.toLowerCase()
  return existing.some(
    e =>
      e.source.toLowerCase() === lowerSrc &&
      e.target.toLowerCase() === lowerTgt &&
      e.type === candidate.type
  )
}

/**
 * Merge incoming evidence nodes with existing ones.
 *
 * Strategy:
 * - Exact match (same claim text, same type) → keep highest-confidence, merge source lists, recompute score
 * - Semantic match (similar claim text) → merge evidence lists, recompute confidence
 * - Contradiction → add CONTRADICTS edge, flag for user review
 */
export function mergeClaims(
  existing: EvidenceNode[],
  incoming: EvidenceNode[],
): MergeResult {
  const merged: EvidenceNode[] = [...existing]
  const newEdges: EvidenceEdge[] = []
  const conflicts: MergeConflict[] = []

  for (const incomingNode of incoming) {
    const incomingLower = incomingNode.claim.toLowerCase()

    // Check for exact match
    const exactMatch = merged.find(
      n => n.claim.toLowerCase() === incomingLower && n.claimType === incomingNode.claimType
    )

    if (exactMatch) {
      // Exact match: merge source lists, recompute confidence via scorer
      const mergedSources = mergeSourceLists(exactMatch.sources, incomingNode.sources)
      exactMatch.sources = mergedSources
      const scored = scoreClaim(exactMatch.claim, exactMatch.sources, 0.8, conflicts.length)
      exactMatch.coverage = scored.score
      continue
    }

    // Check for semantic match (significant text overlap)
    const semanticMatch = merged.find(n => {
      if (n.claimType !== incomingNode.claimType) return false
      const existingLower = n.claim.toLowerCase()
      return existingLower.includes(incomingLower) ||
        incomingLower.includes(existingLower) ||
        wordOverlap(existingLower, incomingLower) > 0.6
    })

    if (semanticMatch) {
      conflicts.push({
        claim: incomingNode.claim,
        type: 'semantic_conflict',
        existing: { ...semanticMatch },
        incoming: incomingNode,
        resolution: 'merge_sources',
      })

      const mergedSources = mergeSourceLists(semanticMatch.sources, incomingNode.sources)
      semanticMatch.sources = mergedSources
      const scored = scoreClaim(semanticMatch.claim, semanticMatch.sources, 0.7, 1)
      semanticMatch.coverage = scored.score

      const newEdge: EvidenceEdge = {
        source: semanticMatch.claim,
        target: incomingNode.claim,
        type: 'EXTENDS',
        weight: 0.7,
        createdAt: new Date(),
        metadata: { reason: 'semantic_merge' },
      }
      if (!dedupEdge(newEdges, newEdge)) {
        newEdges.push(newEdge)
      }
      continue
    }

    // No match found — this is a new claim
    merged.push(incomingNode)

    // Check for potential contradictions (same type, different claim)
    const contradictions = merged.filter(n =>
      n.claimType === incomingNode.claimType &&
      n.claim.toLowerCase() !== incomingLower &&
      isContradictory(n.claim, incomingNode.claim)
    )

    for (const contra of contradictions) {
      const newEdge: EvidenceEdge = {
        source: contra.claim,
        target: incomingNode.claim,
        type: 'CONTRADICTS',
        weight: 0.9,
        createdAt: new Date(),
        metadata: { reason: 'automatic_detection' },
      }
      if (!dedupEdge(newEdges, newEdge)) {
        newEdges.push(newEdge)
      }

      conflicts.push({
        claim: incomingNode.claim,
        type: 'contradiction',
        existing: { ...contra },
        incoming: incomingNode,
        resolution: 'flag_for_review',
      })
    }
  }

  return { merged, edges: newEdges, conflicts }
}

/**
 * Merge two source lists, deduplicating by (sourceType, sourceId, field).
 */
function mergeSourceLists(
  existing: EvidenceSource[],
  incoming: EvidenceSource[],
): EvidenceSource[] {
  const seen = new Set<string>()
  const result: EvidenceSource[] = []

  for (const src of existing) {
    const key = `${src.sourceType}:${src.sourceId}:${src.field}`
    seen.add(key)
    result.push(src)
  }

  for (const src of incoming) {
    const key = `${src.sourceType}:${src.sourceId}:${src.field}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(src)
    }
  }

  return result
}

/**
 * Check if two claims are potentially contradictory.
 * E.g. "5 years experience" vs "3 years experience" on same topic.
 */
function isContradictory(a: string, b: string): boolean {
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()

  // Check for numeric contradictions
  const aNums = aLower.match(/\d+/g) || []
  const bNums = bLower.match(/\d+/g) || []

  if (aNums.length > 0 && bNums.length > 0) {
    // Same context with different numbers could be contradictory
    const contextA = aLower.replace(/\d+/g, '').trim()
    const contextB = bLower.replace(/\d+/g, '').trim()
    if (wordOverlap(contextA, contextB) > 0.5) {
      return aNums.some((n, i) => bNums[i] && n !== bNums[i])
    }
  }

  return false
}

/**
 * Compute word overlap ratio between two strings.
 */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let intersection = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++
  }

  return intersection / Math.min(wordsA.size, wordsB.size)
}
