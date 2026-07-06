export type EvidenceSourceType = 'experience' | 'project' | 'skill' | 'education' | 'certificate'

export type EvidenceConfidence = 'exact' | 'partial' | 'inferred'

export interface EvidenceSource {
  sourceType: EvidenceSourceType
  sourceId: string
  sourceLabel: string
  field: string
  text: string
  confidence: EvidenceConfidence
}

export interface EvidenceNode {
  claim: string
  claimType: string
  sources: EvidenceSource[]
  coverage: number
}

export interface EvidenceGraph {
  nodes: EvidenceNode[]
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
