import type { EvidenceNode, EvidenceEdge, EvidenceGraph } from '../../systems/evidence-graph/types'
import { scoreClaim } from '../../systems/evidence-graph/scorer'

export interface ClaimScore {
  node: EvidenceNode
  score: number
  keywordOverlap: number
  confidenceScore: number
  recencyScore: number
  sourceCredibility: number
}

/**
 * Select the best evidence claim for a target keyword from a set of candidates.
 *
 * Scoring dimensions:
 * - **Keyword overlap**: How many JD keywords does this claim mention?
 * - **Confidence score**: From the evidence graph scorer (inverse-frequency weighted)
 * - **Recency**: Claims from more recent experience score higher
 * - **Source credibility**: experience > project > skill > education > certificate
 */
export function selectBestClaim(
  targetKeyword: string,
  candidates: EvidenceNode[],
  graph: EvidenceGraph,
  jdKeywords: string[] = [],
): ClaimScore | null {
  if (candidates.length === 0) return null

  const scored: ClaimScore[] = candidates.map(node => {
    // Keyword overlap: how many JD keywords appear in this claim
    const claimLower = node.claim.toLowerCase()
    const keywordOverlap = jdKeywords.filter(kw => claimLower.includes(kw.toLowerCase())).length
    const maxOverlap = Math.max(1, jdKeywords.length * 0.1)
    const overlapScore = Math.min(1, keywordOverlap / maxOverlap)

    // Confidence score from evidence graph
    const scored = scoreClaim(node.claim, node.sources)
    const confidenceScore = scored.score

    // Recency score: newer sources score higher
    const recencyScore = computeRecencyScore(node)

    // Source credibility: experience > project > skill > education > cert
    const sourceCredibility = computeSourceCredibility(node)

    // Composite score
    const weights = { overlap: 0.35, confidence: 0.30, recency: 0.20, credibility: 0.15 }
    const total = (
      overlapScore * weights.overlap +
      confidenceScore * weights.confidence +
      recencyScore * weights.recency +
      sourceCredibility * weights.credibility
    )

    return {
      node,
      score: total,
      keywordOverlap,
      confidenceScore,
      recencyScore,
      sourceCredibility,
    }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)
  return scored[0]
}

/**
 * Find the best evidence nodes in the graph that match a target keyword.
 * Uses both exact lookup and BFS traversal to find related claims.
 */
export function findEvidenceForClaim(
  targetKeyword: string,
  graph: EvidenceGraph,
): EvidenceNode[] {
  const lower = targetKeyword.toLowerCase()
  const matches = graph.nodes.filter(n => {
    const claimLower = n.claim.toLowerCase()
    return claimLower.includes(lower) || lower.includes(claimLower)
  })

  // Also check edges for related nodes
  const relatedClaims = new Set<string>()
  for (const edge of graph.edges) {
    const srcLower = edge.source.toLowerCase()
    const tgtLower = edge.target.toLowerCase()
    if (srcLower.includes(lower) || lower.includes(srcLower)) {
      relatedClaims.add(edge.target)
    }
    if (tgtLower.includes(lower) || lower.includes(tgtLower)) {
      relatedClaims.add(edge.source)
    }
  }

  // Add related nodes from edge traversal
  for (const relatedClaim of relatedClaims) {
    if (!matches.some(n => n.claim.toLowerCase() === relatedClaim)) {
      const node = graph.nodes.find(n => n.claim.toLowerCase() === relatedClaim)
      if (node) matches.push(node)
    }
  }

  return matches
}

/**
 * Compute recency score based on source type and experience dates.
 * Higher score for more recent experiences.
 */
function computeRecencyScore(node: EvidenceNode): number {
  const experienceSources = node.sources.filter(s => s.sourceType === 'experience')
  if (experienceSources.length === 0) return 0.5

  // Look for year patterns in source labels (e.g. "Engineer at Acme (2020-2023)")
  let maxYear = 0
  for (const src of experienceSources) {
    const yearMatch = src.sourceLabel.match(/\b(20\d{2})\b/)
    if (yearMatch) {
      const year = parseInt(yearMatch[1])
      if (year > maxYear) maxYear = year
    }
  }

  if (maxYear === 0) return 0.5

  // Score: more recent = higher. 2025+ → 1.0, 2020 → 0.6, 2015 → 0.2
  const currentYear = new Date().getFullYear()
  const yearsAgo = currentYear - maxYear
  return Math.max(0.1, 1.0 - yearsAgo * 0.15)
}

/**
 * Compute source credibility based on evidence source types.
 */
const CREDIBILITY_WEIGHTS: Record<string, number> = {
  experience: 1.0,
  project: 0.8,
  skill: 0.6,
  education: 0.5,
  certificate: 0.5,
  award: 0.4,
  publication: 0.4,
  volunteering: 0.6,
  language: 0.3,
}

function computeSourceCredibility(node: EvidenceNode): number {
  if (node.sources.length === 0) return 0.3

  const weightSum = node.sources.reduce((sum, src) => {
    return sum + (CREDIBILITY_WEIGHTS[src.sourceType] || 0.3)
  }, 0)

  return Math.min(1, weightSum / node.sources.length)
}
