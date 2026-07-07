import type { CareerProfile } from '../career-data/profileService'
import type {
  EvidenceGraph, EvidenceNode, EvidenceSource, EvidenceIndex,
  EvidenceEdge, EdgeType, TraversalMatch,
} from './types'

/** Map of company name (lowercase) → set of technologies used at that company */
interface CompanyTechMap {
  companyToTech: Map<string, Set<string>>
  techToCompany: Map<string, Set<string>>
  projectToTech: Map<string, Set<string>>
  techToProject: Map<string, Set<string>>
}

function buildIndex(profile: CareerProfile): EvidenceIndex & CompanyTechMap {
  const skills = new Map<string, EvidenceSource[]>()
  const technologies = new Map<string, EvidenceSource[]>()
  const companies = new Map<string, EvidenceSource[]>()
  const projectTitles = new Map<string, EvidenceSource[]>()
  const certNames = new Map<string, EvidenceSource[]>()
  const educationDegrees = new Map<string, EvidenceSource[]>()

  // Cross-reference maps for edge building
  const companyToTech = new Map<string, Set<string>>()
  const techToCompany = new Map<string, Set<string>>()
  const projectToTech = new Map<string, Set<string>>()
  const techToProject = new Map<string, Set<string>>()

  for (const exp of profile.experiences) {
    const expSource = (field: string, text: string): EvidenceSource => ({
      sourceType: 'experience',
      sourceId: exp._id,
      sourceLabel: `${exp.role} at ${exp.company}`,
      field,
      text,
      confidence: 'exact',
    })

    const companyLower = exp.company.toLowerCase()
    companies.set(companyLower, [
      ...(companies.get(companyLower) || []),
      expSource('company', exp.company),
    ])

    // Track which technologies this company uses
    if (!companyToTech.has(companyLower)) companyToTech.set(companyLower, new Set())
    const companyTechs = companyToTech.get(companyLower)!

    for (const tech of exp.technologies) {
      const techLower = tech.toLowerCase()
      technologies.set(techLower, [...(technologies.get(techLower) || []), expSource('technologies', tech)])

      // Cross-reference: this company uses this tech
      companyTechs.add(techLower)
      if (!techToCompany.has(techLower)) techToCompany.set(techLower, new Set())
      techToCompany.get(techLower)!.add(companyLower)
    }
    for (const ach of exp.achievements) {
      const key = ach.toLowerCase()
      skills.set(key, [...(skills.get(key) || []), expSource('achievements', ach)])
    }
    for (const metric of exp.metrics) {
      const key = metric.toLowerCase()
      skills.set(key, [...(skills.get(key) || []), expSource('metrics', metric)])
    }
  }

  for (const proj of profile.projects) {
    const projSource = (field: string, text: string): EvidenceSource => ({
      sourceType: 'project',
      sourceId: proj._id,
      sourceLabel: proj.title,
      field,
      text,
      confidence: 'exact',
    })

    const projLower = proj.title.toLowerCase()
    projectTitles.set(projLower, [
      ...(projectTitles.get(projLower) || []),
      projSource('title', proj.title),
    ])

    // Track which technologies this project uses
    if (!projectToTech.has(projLower)) projectToTech.set(projLower, new Set())
    const projTechs = projectToTech.get(projLower)!

    for (const tech of proj.technologies) {
      const techLower = tech.toLowerCase()
      technologies.set(techLower, [...(technologies.get(techLower) || []), projSource('technologies', tech)])

      // Cross-reference: this project uses this tech
      projTechs.add(techLower)
      if (!techToProject.has(techLower)) techToProject.set(techLower, new Set())
      techToProject.get(techLower)!.add(projLower)
    }
  }

  for (const skill of profile.skills) {
    const source: EvidenceSource = {
      sourceType: 'skill',
      sourceId: skill._id,
      sourceLabel: skill.name,
      field: 'name',
      text: skill.name,
      confidence: 'exact',
    }
    const key = skill.name.toLowerCase()
    skills.set(key, [...(skills.get(key) || []), source])
  }

  for (const cert of profile.certificates) {
    const key = cert.name.toLowerCase()
    certNames.set(key, [
      ...(certNames.get(key) || []),
      {
        sourceType: 'certificate',
        sourceId: cert._id,
        sourceLabel: cert.name,
        field: 'name',
        text: cert.name,
        confidence: 'exact',
      },
    ])
  }

  for (const edu of profile.education) {
    const key = edu.degree.toLowerCase()
    educationDegrees.set(key, [
      ...(educationDegrees.get(key) || []),
      {
        sourceType: 'education',
        sourceId: edu._id,
        sourceLabel: `${edu.degree} at ${edu.institution}`,
        field: 'degree',
        text: edu.degree,
        confidence: 'exact',
      },
    ])
  }

  return {
    skills, technologies, companies, projectTitles, certNames, educationDegrees,
    companyToTech, techToCompany, projectToTech, techToProject,
  }
}

export class EvidenceGraphBuilder {
  private index: EvidenceIndex & CompanyTechMap
  private _edges: EvidenceEdge[] = []

  constructor(profile: CareerProfile) {
    this.index = buildIndex(profile)
    this.buildEdges()
  }

  getIndex(): EvidenceIndex {
    return this.index
  }

  get edges(): EvidenceEdge[] {
    return this._edges
  }

  /**
   * Build evidence-backed edges between related facts in the index.
   *
   * Only creates edges where there is actual evidence linking two nodes.
   * For example, a USES edge between a company and technology is only
   * created if an experience at that company actually lists that technology.
   * No all-pairs edges are created.
   */
  private buildEdges(): void {
    const edges: EvidenceEdge[] = []
    const now = new Date()

    // Connect technologies to skills that share names
    for (const [techName] of this.index.technologies) {
      const skillSources = this.index.skills.get(techName)
      if (skillSources && skillSources.length > 0) {
        edges.push({
          source: techName,
          target: techName,
          type: 'RELATED_TO',
          weight: 0.8,
          createdAt: now,
          metadata: { relation: 'technology-skill' },
        })
      }
    }

    // Connect companies ONLY to technologies they actually use (evidence-backed)
    for (const [companyName, techs] of this.index.companyToTech) {
      for (const techName of techs) {
        edges.push({
          source: companyName,
          target: techName,
          type: 'USES',
          weight: 0.7,
          createdAt: now,
          metadata: { relation: 'company-technology' },
        })
      }
    }

    // Connect projects ONLY to technologies they actually use (evidence-backed)
    for (const [projName, techs] of this.index.projectToTech) {
      for (const techName of techs) {
        edges.push({
          source: projName,
          target: techName,
          type: 'USES',
          weight: 0.6,
          createdAt: now,
          metadata: { relation: 'project-technology' },
        })
      }
    }

    // Connect skills to companies where those skills appear as technologies
    // (a skill like 'TypeScript' that also appears as a technology at a company)
    for (const [skillName] of this.index.skills) {
      const companiesUsingSkill = this.index.techToCompany.get(skillName)
      if (companiesUsingSkill) {
        for (const companyName of companiesUsingSkill) {
          edges.push({
            source: skillName,
            target: companyName,
            type: 'WORKED_AT',
            weight: 0.5,
            createdAt: now,
            metadata: { relation: 'skill-company' },
          })
        }
      }
    }

    // Connect certifications to their issuers (DERIVED_FROM edge)
    for (const [certName, certSources] of this.index.certNames) {
      for (const src of certSources) {
        edges.push({
          source: certName,
          target: src.sourceLabel,
          type: 'DERIVED_FROM',
          weight: 1.0,
          createdAt: now,
          metadata: { relation: 'cert-issuer' },
        })
      }
    }

    this._edges = edges
  }

  /**
   * Add a custom edge to the graph.
   */
  addEdge(edge: EvidenceEdge): void {
    this._edges.push(edge)
  }

  /** Lookup methods — unchanged API for backward compatibility */
  lookupSkill(name: string): EvidenceSource[] {
    return this.index.skills.get(name.toLowerCase()) || []
  }

  lookupTechnology(name: string): EvidenceSource[] {
    return this.index.technologies.get(name.toLowerCase()) || []
  }

  lookupCompany(name: string): EvidenceSource[] {
    return this.index.companies.get(name.toLowerCase()) || []
  }

  lookupProject(title: string): EvidenceSource[] {
    return this.index.projectTitles.get(title.toLowerCase()) || []
  }

  lookupCertification(name: string): EvidenceSource[] {
    return this.index.certNames.get(name.toLowerCase()) || []
  }

  lookupEducation(degree: string): EvidenceSource[] {
    return this.index.educationDegrees.get(degree.toLowerCase()) || []
  }

  /**
   * BFS traversal starting from a node claim.
   * Returns all nodes reachable within `maxDepth` along edges of `edgeType`.
   * If `edgeType` is undefined, traverses all edge types.
   */
  traverse(
    claim: string,
    edgeType?: EdgeType,
    maxDepth: number = 2,
  ): TraversalMatch[] {
    const results: TraversalMatch[] = []
    const visited = new Set<string>()
    const lowerClaim = claim.toLowerCase()

    // Build adjacency list: node claim -> edges
    const adjacency = new Map<string, EvidenceEdge[]>()
    for (const edge of this._edges) {
      const srcLower = edge.source.toLowerCase()
      if (!adjacency.has(srcLower)) adjacency.set(srcLower, [])
      adjacency.get(srcLower)!.push(edge)
    }

    // BFS
    const queue: Array<{ claim: string; path: EvidenceEdge[]; depth: number }> = [
      { claim: lowerClaim, path: [], depth: 0 },
    ]
    visited.add(lowerClaim)

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current.depth > 0) {
        // Build a synthetic node for the result
        const sources = this.findSources(current.claim, '')
        const node: EvidenceNode = {
          claim: current.claim,
          claimType: 'related',
          sources,
          coverage: sources.length > 0 ? 1 : 0,
        }
        results.push({ node, path: current.path, depth: current.depth })
      }

      if (current.depth >= maxDepth) continue

      const outgoingEdges = adjacency.get(current.claim) || []
      for (const edge of outgoingEdges) {
        if (edgeType && edge.type !== edgeType) continue
        const targetLower = edge.target.toLowerCase()
        if (!visited.has(targetLower)) {
          visited.add(targetLower)
          queue.push({
            claim: targetLower,
            path: [...current.path, edge],
            depth: current.depth + 1,
          })
        }
      }
    }

    return results
  }

  /**
   * Build the graph for a set of claims.
   * Returns an EvidenceGraph with nodes, edges, and metadata.
   */
  build(claims: Array<{ text: string; type: string }>): EvidenceGraph {
    const nodes: EvidenceNode[] = []
    const allEdges: EvidenceEdge[] = [...this._edges]

    for (const claim of claims) {
      const sources = this.findSources(claim.text, claim.type)
      // Find edges relevant to this claim
      const claimLower = claim.text.toLowerCase()
      const claimEdges = allEdges.filter(
        e => e.source.toLowerCase() === claimLower || e.target.toLowerCase() === claimLower
      )
      nodes.push({
        claim: claim.text,
        claimType: claim.type,
        sources,
        coverage: sources.length > 0 ? 1 : 0,
        edges: claimEdges.length > 0 ? claimEdges : undefined,
      })
    }

    const totalClaims = nodes.length
    const covered = nodes.filter(n => n.sources.length > 0).length
    const uncoveredClaims = nodes.filter(n => n.sources.length === 0).map(n => n.claim)
    const totalSources = nodes.reduce((sum, n) => sum + n.sources.length, 0)

    return {
      nodes,
      edges: allEdges,
      metadata: {
        totalClaims,
        totalSources,
        coverage: totalClaims > 0 ? Math.round((covered / totalClaims) * 100) : 100,
        uncoveredClaims,
      },
    }
  }

  private findSources(text: string, type: string): EvidenceSource[] {
    const lower = text.toLowerCase()

    switch (type) {
      case 'skill':
      case 'technology': {
        const techSources = this.index.technologies.get(lower)
        if (techSources) return techSources
        const skillSources = this.index.skills.get(lower)
        if (skillSources) return skillSources
        return this.fuzzyLookup(lower, [this.index.skills, this.index.technologies])
      }
      case 'company':
        return this.index.companies.get(lower) || []
      case 'project':
        return this.index.projectTitles.get(lower) || []
      case 'certification':
        return this.index.certNames.get(lower) || []
      case 'education':
        return this.index.educationDegrees.get(lower) || []
      default:
        return this.fuzzyLookup(lower, [
          this.index.skills, this.index.technologies, this.index.companies,
          this.index.projectTitles, this.index.certNames, this.index.educationDegrees,
        ])
    }
  }

  private fuzzyLookup(lower: string, maps: Map<string, EvidenceSource[]>[]): EvidenceSource[] {
    for (const map of maps) {
      for (const [key, sources] of map) {
        if (key.includes(lower) || lower.includes(key)) {
          return sources
        }
      }
    }
    return []
  }
}

export function profileToEvidencePrompt(profile: CareerProfile): string {
  const builder = new EvidenceGraphBuilder(profile)
  const index = builder.getIndex()

  const parts: string[] = ['### EVIDENCE INDEX (source of truth)']
  parts.push('')

  if (index.skills.size > 0) {
    parts.push('**Skills:**')
    for (const [name] of index.skills) {
      parts.push(`- ${name}`)
    }
    parts.push('')
  }

  if (index.technologies.size > 0) {
    parts.push('**Technologies used:**')
    for (const [name] of index.technologies) {
      parts.push(`- ${name}`)
    }
    parts.push('')
  }

  if (index.companies.size > 0) {
    parts.push('**Companies:**')
    for (const [name] of index.companies) {
      parts.push(`- ${name}`)
    }
    parts.push('')
  }

  if (index.projectTitles.size > 0) {
    parts.push('**Projects:**')
    for (const [name] of index.projectTitles) {
      parts.push(`- ${name}`)
    }
    parts.push('')
  }

  if (index.certNames.size > 0) {
    parts.push('**Certifications:**')
    for (const [name] of index.certNames) {
      parts.push(`- ${name}`)
    }
    parts.push('')
  }

  parts.push('**RULES:**')
  parts.push('- Every skill, technology, company, and project in the output MUST exist in this index.')
  parts.push('- If a JD keyword has NO match in this index, flag it in truthFlags and do NOT include it in the resume.')
  parts.push('- Metrics may ONLY be used if they match an existing metric in the profile.')
  parts.push('- Do not invent technologies, companies, or achievements.')

  return parts.join('\n')
}
