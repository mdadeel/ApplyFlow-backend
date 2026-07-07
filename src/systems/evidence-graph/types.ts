export type EvidenceSourceType = 'experience' | 'project' | 'skill' | 'education' | 'certificate' | 'award' | 'publication' | 'volunteering' | 'language'

export type EvidenceConfidence = 'exact' | 'partial' | 'inferred'

export interface EvidenceSource {
  sourceType: EvidenceSourceType
  sourceId: string
  sourceLabel: string
  field: string
  text: string
  confidence: EvidenceConfidence
}

export type EdgeType = 'SUPPORTED_BY' | 'CONTRADICTS' | 'EXTENDS' | 'DERIVED_FROM' | 'INFERRED_FROM' | 'MENTIONED_IN' | 'USES' | 'WORKED_AT' | 'RELATED_TO'

export interface EvidenceEdge {
  source: string       // source node claim
  target: string       // target node claim
  type: EdgeType
  weight: number       // 0-1 strength of relationship
  createdAt: Date
  metadata?: Record<string, unknown>
}

export interface EvidenceNode {
  claim: string
  claimType: string
  sources: EvidenceSource[]
  coverage: number
  /** Edges originating from this node */
  edges?: EvidenceEdge[]
}

export interface EvidenceGraph {
  nodes: EvidenceNode[]
  edges: EvidenceEdge[]
  metadata: {
    totalClaims: number
    totalSources: number
    coverage: number
    uncoveredClaims: string[]
  }
}

export interface EvidenceIndex {
  skills: Map<string, EvidenceSource[]>
  technologies: Map<string, EvidenceSource[]>
  companies: Map<string, EvidenceSource[]>
  projectTitles: Map<string, EvidenceSource[]>
  certNames: Map<string, EvidenceSource[]>
  educationDegrees: Map<string, EvidenceSource[]>
}

/**
 * Traversal result: a node plus the path of edges taken to reach it.
 */
export interface TraversalMatch {
  node: EvidenceNode
  path: EvidenceEdge[]
  depth: number
}
