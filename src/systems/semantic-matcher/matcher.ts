import { findMatchingTechnologies, getSemanticEquivalents, type MatchResult } from './mappings'
import type { CareerProfile } from '../career-data/profileService'
import { EvidenceGraphBuilder } from '../evidence-graph/builder'

export interface SkillMatch {
  jdSkill: string
  matchType: 'exact' | 'partial' | 'transferable' | 'missing'
  matchedSource?: string
  semanticGroup?: string
  evidenceSources: number
}

export interface SkillMatchReport {
  requiredMatches: SkillMatch[]
  preferredMatches: SkillMatch[]
  exactCount: number
  partialCount: number
  transferableCount: number
  missingCount: number
  score: number
}

function getAllUserTechnologies(profile: CareerProfile): string[] {
  const techSet = new Set<string>()

  for (const exp of profile.experiences) {
    for (const t of exp.technologies) techSet.add(t)
    for (const r of exp.responsibilities) {
      const words = r.split(/\s+/)
      for (const w of words) {
        if (w[0] === w[0]?.toUpperCase() && w.length > 2) techSet.add(w)
      }
    }
  }
  for (const proj of profile.projects) {
    for (const t of proj.technologies) techSet.add(t)
  }
  for (const skill of profile.skills) {
    techSet.add(skill.name)
  }

  return [...techSet]
}

function classifyMatch(
  jdSkill: string,
  userTechs: string[],
  builder: EvidenceGraphBuilder,
  visited: Set<string>,
): SkillMatch {
  const lower = jdSkill.toLowerCase()
  if (visited.has(lower)) {
    return { jdSkill, matchType: 'missing', evidenceSources: 0 }
  }
  visited.add(lower)

  const evidenceSources = builder.lookupTechnology(jdSkill).length + builder.lookupSkill(jdSkill).length

  if (evidenceSources > 0) {
    return { jdSkill, matchType: 'exact', matchedSource: jdSkill, evidenceSources }
  }

  const exactMatch = userTechs.find(t => t.toLowerCase() === lower)
  if (exactMatch) {
    return { jdSkill, matchType: 'exact', matchedSource: exactMatch, evidenceSources: 1 }
  }

  const results: MatchResult[] = findMatchingTechnologies(jdSkill, userTechs)
  const aliasMatch = results.find(r => r.matchType === 'alias')
  if (aliasMatch) {
    return {
      jdSkill,
      matchType: 'partial',
      matchedSource: aliasMatch.original,
      semanticGroup: aliasMatch.canonical,
      evidenceSources: 1,
    }
  }

  const partialMatch = userTechs.find(t =>
    t.toLowerCase().includes(lower) || lower.includes(t.toLowerCase()),
  )
  if (partialMatch) {
    return { jdSkill, matchType: 'partial', matchedSource: partialMatch, evidenceSources: 1 }
  }

  const equivalents = getSemanticEquivalents(jdSkill)
  for (const equiv of equivalents) {
    const match = userTechs.find(t => t.toLowerCase() === equiv.toLowerCase())
    if (match) {
      return { jdSkill, matchType: 'transferable', matchedSource: match, evidenceSources: 1 }
    }
  }

  return { jdSkill, matchType: 'missing', evidenceSources: 0 }
}

export function matchSkillsAgainstProfile(
  requiredSkills: string[],
  preferredSkills: string[],
  profile: CareerProfile,
): SkillMatchReport {
  const builder = new EvidenceGraphBuilder(profile)
  const userTechs = getAllUserTechnologies(profile)
  const visited = new Set<string>()

  const requiredMatches = requiredSkills.map(s => classifyMatch(s, userTechs, builder, visited))
  const preferredMatches = preferredSkills.map(s => classifyMatch(s, userTechs, builder, visited))

  const exactCount = requiredMatches.filter(m => m.matchType === 'exact').length
  const partialCount = requiredMatches.filter(m => m.matchType === 'partial').length
  const transferableCount = requiredMatches.filter(m => m.matchType === 'transferable').length
  const missingCount = requiredMatches.filter(m => m.matchType === 'missing').length

  const score = requiredSkills.length > 0
    ? Math.round(((exactCount * 1.0 + partialCount * 0.7 + transferableCount * 0.4) / requiredSkills.length) * 100)
    : 100

  return {
    requiredMatches,
    preferredMatches,
    exactCount,
    partialCount,
    transferableCount,
    missingCount,
    score,
  }
}
