import type { Resume, ResumeExperience } from '../types/resume'
import type { JobAnalysis } from '../types/job-analysis'
import type { EvidenceGraph } from '../../systems/evidence-graph/types'
import {
  type Plan, type PlannedSection, type PlannedBullet, type PlannedSectionType, type PlanMetadata,
  scoreSectionRelevance, computeSectionPriority,
} from './plan'
import { selectBestClaim, findEvidenceForClaim } from './claimSelector'

export { type Plan, type PlannedSection, type PlannedBullet, type PlanMetadata }
export { selectBestClaim, findEvidenceForClaim } from './claimSelector'

/**
 * Create a structured plan for resume generation.
 *
 * Algorithm:
 * 1. Score each section type against JD requirements
 * 2. Select highest-scoring sections (up to configurable limits)
 * 3. For each section, rank and filter content by relevance to target keywords
 * 4. For each bullet/claim, select best evidence anchor from knowledge graph
 * 5. Output an ordered plan that the generator can consume
 */
export function createPlan(
  profile: Resume,
  jd: JobAnalysis,
  knowledge: EvidenceGraph,
  options?: {
    strategy?: 'ats-first' | 'experience-first' | 'balanced'
    maxSections?: number
    maxBulletsPerSection?: number
    includeOptionalSections?: boolean
  },
): Plan {
  const strategy = options?.strategy || 'balanced'
  const maxSections = options?.maxSections || 6
  const maxBulletsPerSection = options?.maxBulletsPerSection || 5
  const includeOptionalSections = options?.includeOptionalSections ?? true

  const jdKeywords = jd.allKeywords
  const mustInclude = jd.requiredSkills.slice(0, 10)

  // 1. Score and rank all candidate sections
  const sectionTypes: PlannedSectionType[] = [
    'summary', 'experience', 'skills', 'project', 'education',
    'certifications', 'awards', 'publications',
  ]

  const scoredSections: Array<{ type: PlannedSectionType; score: number; priority: number }> = []
  for (const type of sectionTypes) {
    const score = scoreSectionRelevance(type, jd, profile)
    const priority = computeSectionPriority(score, type, strategy)
    if (score > 0 || type === 'summary') {
      scoredSections.push({ type, score, priority })
    }
  }

  // Sort by priority descending
  scoredSections.sort((a, b) => b.priority - a.priority)

  // 2. Select top sections
  const selectedSections = scoredSections.slice(0, maxSections)

  // 3. Build each planned section
  const sections: PlannedSection[] = []

  for (const scored of selectedSections) {
    const section = buildPlannedSection(scored.type, profile, jd, knowledge, jdKeywords, maxBulletsPerSection)
    if (section) {
      sections.push(section)
    }
  }

  // 4. Compute metadata
  const topSection = sections[0]
  const matchScore = computeMatchScore(profile, jd)
  const atsCoverage = computeAtsCoverage(sections, jd)

  const metadata: PlanMetadata = {
    targetRole: jd.title,
    targetCompany: jd.company,
    matchScore,
    atsCoverage,
    strategy,
    includeOptionalSections,
  }

  return { sections, metadata, mustInclude }
}

/**
 * Build a single planned section from the career profile data.
 */
function buildPlannedSection(
  type: PlannedSectionType,
  profile: Resume,
  jd: JobAnalysis,
  knowledge: EvidenceGraph,
  jdKeywords: string[],
  maxBullets: number,
): PlannedSection | null {
  const jdSkillSet = new Set(jd.requiredSkills.map(s => s.toLowerCase()))
  const allKeywords = jdKeywords

  switch (type) {
    case 'summary': {
      if (!profile.personal?.summary) return null
      return {
        type: 'summary',
        title: 'Professional Summary',
        bullets: [{
          claim: profile.personal.summary,
          evidenceAnchor: 'profile.summary',
          keywords: allKeywords.filter(kw =>
            profile.personal!.summary!.toLowerCase().includes(kw.toLowerCase())
          ),
          priority: 0.8,
          sourceRef: 'personal.summary',
        }],
        keywords: allKeywords,
        priority: 0.8,
        maxItems: 1,
      }
    }

    case 'experience': {
      if (profile.experiences.length === 0) return null

      // Score and rank experiences by JD relevance
      const scoredExps = profile.experiences.map(exp => {
        const score = scoreExperienceAgainstJd(exp, jd)
        return { exp, score }
      })
      scoredExps.sort((a, b) => b.score - a.score)

      const selectedExps = scoredExps.slice(0, 3)
      const bullets: PlannedBullet[] = []
      const bulletsPerExp = Math.max(2, Math.floor(maxBullets / selectedExps.length))

      for (const { exp, score } of selectedExps) {
        const expKeywords = allKeywords.filter(kw =>
          exp.technologies.some(t => t.toLowerCase().includes(kw.toLowerCase())) ||
          exp.responsibilities.some(r => r.toLowerCase().includes(kw.toLowerCase()))
        )

        // Generate planned bullets for responsibilities and achievements
        const items = [...exp.responsibilities, ...exp.achievements, ...exp.metrics]
        const scoredItems = items.map(item => ({
          text: item,
          score: jdKeywords.filter(kw => item.toLowerCase().includes(kw.toLowerCase())).length / Math.max(1, jdKeywords.length),
        }))
        scoredItems.sort((a, b) => b.score - a.score)

        // Select top bullets, guarantee at least 2 per experience
        const topItems = scoredItems.slice(0, bulletsPerExp)
        for (const item of topItems) {
          const evidenceNodes = findEvidenceForClaim(item.text, knowledge)
          const bestClaim = selectBestClaim(item.text, evidenceNodes, knowledge, jdKeywords)

          bullets.push({
            claim: item.text,
            evidenceAnchor: bestClaim?.node.claim || `${exp.company}/${exp.role}`,
            keywords: expKeywords,
            priority: item.score,
            sourceRef: `${exp.company}/${exp.role}`,
          })
        }
      }

      if (bullets.length === 0) return null

      return {
        type: 'experience',
        title: 'Experience',
        bullets,
        keywords: allKeywords,
        priority: scoredExps[0]?.score ?? 0.5,
        maxItems: selectedExps.length,
      }
    }

    case 'skills': {
      // Score skills by JD keyword match
      const scoredSkills = profile.skills.map(skill => {
        const jdMatch = jdSkillSet.has(skill.name.toLowerCase()) ? 1 : 0
        const partialMatch = jd.requiredSkills.some(
          rs => rs.toLowerCase().includes(skill.name.toLowerCase()) ||
               skill.name.toLowerCase().includes(rs.toLowerCase())
        ) ? 0.5 : 0
        return { skill, score: Math.max(jdMatch, partialMatch) }
      })
      scoredSkills.sort((a, b) => b.score - a.score)

      const topSkills = scoredSkills.slice(0, 15)
      const bullets: PlannedBullet[] = topSkills.map(({ skill, score }) => ({
        claim: skill.name,
        evidenceAnchor: `skill.${skill.name}`,
        keywords: jdSkillSet.has(skill.name.toLowerCase()) ? [skill.name] : [],
        priority: score,
        sourceRef: `skill.${skill.name}`,
      }))

      if (bullets.length === 0) return null

      return {
        type: 'skills',
        title: 'Skills',
        bullets,
        keywords: allKeywords,
        priority: 0.7,
        maxItems: topSkills.length,
      }
    }

    case 'project': {
      if (profile.projects.length === 0) return null

      const scoredProjs = profile.projects.map(proj => {
        const techMatch = proj.technologies.filter(t =>
          jdSkillSet.has(t.toLowerCase())
        ).length
        return { proj, score: techMatch / Math.max(1, jd.requiredSkills.length * 0.2) }
      })
      scoredProjs.sort((a, b) => b.score - a.score)

      const selectedProjs = scoredProjs.slice(0, 2)
      const bullets: PlannedBullet[] = []

      for (const { proj, score } of selectedProjs) {
        const projKeywords = allKeywords.filter(kw =>
          proj.technologies.some(t => t.toLowerCase().includes(kw.toLowerCase())) ||
          proj.features.some(f => f.toLowerCase().includes(kw.toLowerCase()))
        )

        const items = [proj.description, ...proj.features]
        const scoredItems = items.map(item => ({
          text: item,
          score: jdKeywords.filter(kw => item.toLowerCase().includes(kw.toLowerCase())).length / Math.max(1, jdKeywords.length),
        }))
        scoredItems.sort((a, b) => b.score - a.score)

        const topItems = scoredItems.slice(0, maxBullets)
        for (const item of topItems) {
          const evidenceNodes = findEvidenceForClaim(item.text, knowledge)
          const bestClaim = selectBestClaim(item.text, evidenceNodes, knowledge, jdKeywords)

          bullets.push({
            claim: item.text,
            evidenceAnchor: bestClaim?.node.claim || `project.${proj.title}`,
            keywords: projKeywords,
            priority: item.score,
            sourceRef: `project.${proj.title}`,
          })
        }
      }

      if (bullets.length === 0) return null

      return {
        type: 'project',
        title: 'Projects',
        bullets,
        keywords: allKeywords,
        priority: scoredProjs[0]?.score || 0.5,
        maxItems: selectedProjs.length,
      }
    }

    case 'education': {
      if (profile.education.length === 0) return null
      const bullets: PlannedBullet[] = profile.education.map(edu => ({
        claim: `${edu.degree} - ${edu.institution} (${edu.startDate} - ${edu.endDate})`,
        evidenceAnchor: `education.${edu.institution}`,
        keywords: [],
        priority: 0.5,
        sourceRef: `education.${edu.institution}`,
      }))

      return {
        type: 'education',
        title: 'Education',
        bullets,
        keywords: [],
        priority: 0.6,
        maxItems: profile.education.length,
      }
    }

    case 'certifications': {
      if (profile.certificates.length === 0) return null
      const bullets: PlannedBullet[] = profile.certificates.map(cert => ({
        claim: `${cert.name} - ${cert.issuer} (${cert.date})`,
        evidenceAnchor: `certificate.${cert.name}`,
        keywords: jdSkillSet.has(cert.name.toLowerCase()) ? [cert.name] : [],
        priority: 0.4,
        sourceRef: `certificate.${cert.name}`,
      }))

      return {
        type: 'certifications',
        title: 'Certifications',
        bullets,
        keywords: [],
        priority: 0.5,
        maxItems: profile.certificates.length,
      }
    }

    case 'awards':
    case 'publications':
      return null // Optional — not planned by default

    default:
      return null
  }
}

/**
 * Score an experience against JD requirements.
 */
function scoreExperienceAgainstJd(exp: ResumeExperience, jd: JobAnalysis): number {
  const jdSkillSet = new Set(jd.requiredSkills.map(s => s.toLowerCase()))
  let score = 0

  // Technology match
  const techMatches = exp.technologies.filter(t => jdSkillSet.has(t.toLowerCase())).length
  score += techMatches * 2

  // Responsibility keyword match
  for (const resp of exp.responsibilities) {
    const respLower = resp.toLowerCase()
    for (const kw of jd.allKeywords) {
      if (respLower.includes(kw.toLowerCase())) score += 1
    }
  }

  // Recency bonus
  if (exp.current) score += 3
  else if (exp.endDate) {
    const endYear = parseInt(exp.endDate.split('-')[0])
    const currentYear = new Date().getFullYear()
    if (endYear >= currentYear - 2) score += 2
    else if (endYear >= currentYear - 5) score += 1
  }

  return score
}

/**
 * Compute a match score (0-100) between profile and JD.
 */
function computeMatchScore(profile: Resume, jd: JobAnalysis): number {
  const jdSkills = new Set(jd.requiredSkills.map(s => s.toLowerCase()))
  const profileSkills = new Set(profile.skills.map(s => s.name.toLowerCase()))
  const techSkills = new Set<string>()
  for (const exp of profile.experiences) {
    for (const tech of exp.technologies) techSkills.add(tech.toLowerCase())
  }
  const allProfileSkills = new Set([...profileSkills, ...techSkills])

  if (jdSkills.size === 0) return 100
  const matches = [...jdSkills].filter(s => allProfileSkills.has(s)).length
  return Math.round((matches / jdSkills.size) * 100)
}

/**
 * Compute ATS keyword coverage percentage for the planned sections.
 */
function computeAtsCoverage(sections: PlannedSection[], jd: JobAnalysis): number {
  if (jd.keywords.ats.length === 0) return 100

  const covered = new Set<string>()
  for (const section of sections) {
    for (const bullet of section.bullets) {
      const bulletLower = bullet.claim.toLowerCase()
      for (const atsKw of jd.keywords.ats) {
        if (bulletLower.includes(atsKw.toLowerCase())) {
          covered.add(atsKw.toLowerCase())
        }
      }
    }
  }

  return Math.round((covered.size / jd.keywords.ats.length) * 100)
}
