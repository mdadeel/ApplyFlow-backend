import type { CareerProfile } from '../career-data/profileService'
import type { EvidenceGraph, EvidenceNode, EvidenceSource, EvidenceIndex } from './types'

function buildIndex(profile: CareerProfile): EvidenceIndex {
  const skills = new Map<string, EvidenceSource[]>()
  const technologies = new Map<string, EvidenceSource[]>()
  const companies = new Map<string, EvidenceSource[]>()
  const projectTitles = new Map<string, EvidenceSource[]>()
  const certNames = new Map<string, EvidenceSource[]>()
  const educationDegrees = new Map<string, EvidenceSource[]>()

  for (const exp of profile.experiences) {
    const expSource = (field: string, text: string): EvidenceSource => ({
      sourceType: 'experience',
      sourceId: exp._id,
      sourceLabel: `${exp.role} at ${exp.company}`,
      field,
      text,
      confidence: 'exact',
    })

    companies.set(exp.company.toLowerCase(), [
      ...(companies.get(exp.company.toLowerCase()) || []),
      expSource('company', exp.company),
    ])

    for (const tech of exp.technologies) {
      const key = tech.toLowerCase()
      technologies.set(key, [...(technologies.get(key) || []), expSource('technologies', tech)])
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

    projectTitles.set(proj.title.toLowerCase(), [
      ...(projectTitles.get(proj.title.toLowerCase()) || []),
      projSource('title', proj.title),
    ])

    for (const tech of proj.technologies) {
      const key = tech.toLowerCase()
      technologies.set(key, [...(technologies.get(key) || []), projSource('technologies', tech)])
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

  return { skills, technologies, companies, projectTitles, certNames, educationDegrees }
}

export class EvidenceGraphBuilder {
  private index: EvidenceIndex

  constructor(profile: CareerProfile) {
    this.index = buildIndex(profile)
  }

  getIndex(): EvidenceIndex {
    return this.index
  }

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

  build(claims: Array<{ text: string; type: string }>): EvidenceGraph {
    const nodes: EvidenceNode[] = []

    for (const claim of claims) {
      const sources = this.findSources(claim.text, claim.type)
      nodes.push({
        claim: claim.text,
        claimType: claim.type,
        sources,
        coverage: sources.length > 0 ? 1 : 0,
      })
    }

    const totalClaims = nodes.length
    const covered = nodes.filter(n => n.sources.length > 0).length
    const uncoveredClaims = nodes.filter(n => n.sources.length === 0).map(n => n.claim)
    const totalSources = nodes.reduce((sum, n) => sum + n.sources.length, 0)

    return {
      nodes,
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
