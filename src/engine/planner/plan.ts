import type { Resume, ResumeExperience, ResumeProject, ResumeSkill } from '../types/resume'
import type { JobAnalysis } from '../types/job-analysis'

export type PlannedSectionType = 'summary' | 'experience' | 'project' | 'skills' | 'education' | 'certifications' | 'awards' | 'publications'

export interface PlannedBullet {
  /** The claim text that will become a bullet point */
  claim: string
  /** Reference to the evidence anchor in the knowledge graph */
  evidenceAnchor: string
  /** Keywords from the JD that this bullet should target */
  keywords: string[]
  /** Priority score 0-1 (higher = more important to include) */
  priority: number
  /** Source section in the career profile (experience index, project index, etc.) */
  sourceRef?: string
}

export interface PlannedSection {
  /** Section type */
  type: PlannedSectionType
  /** Display title for this section */
  title: string
  /** Ordered list of bullets */
  bullets: PlannedBullet[]
  /** Keywords from the JD that this section should target */
  keywords: string[]
  /** Priority score 0-1 for the section */
  priority: number
  /** Maximum number of items to include */
  maxItems: number
}

export interface PlanMetadata {
  targetRole: string
  targetCompany: string
  matchScore: number
  /** ATS keyword coverage target (0-100) */
  atsCoverage: number
  /** Priority: 'ats-first' | 'experience-first' | 'balanced' */
  strategy: 'ats-first' | 'experience-first' | 'balanced'
  /** Whether to include optional sections */
  includeOptionalSections: boolean
}

/**
 * A complete optimization plan for resume generation.
 *
 * The planner produces this before any LLM call. The generator consumes
 * this plan to produce the final resume.
 */
export interface Plan {
  sections: PlannedSection[]
  metadata: PlanMetadata
  /** High-priority keywords that MUST appear somewhere in the resume */
  mustInclude: string[]
}

/**
 * Score the relevance of a section type against the JD requirements.
 */
export function scoreSectionRelevance(
  sectionType: PlannedSectionType,
  jd: JobAnalysis,
  profile: Resume,
): number {
  switch (sectionType) {
    case 'summary': {
      return profile.personal?.summary ? 0.8 : 0
    }
    case 'experience': {
      if (profile.experiences.length === 0) return 0
      // Count UNIQUE skills matched across experiences (dedup to avoid inflation)
      const skills = new Set(jd.requiredSkills.map(s => s.toLowerCase()))
      const matchedSkills = new Set<string>()
      for (const exp of profile.experiences) {
        const expWords = new Set([
          exp.company.toLowerCase(),
          exp.role.toLowerCase(),
          ...exp.technologies.map(t => t.toLowerCase()),
          ...exp.responsibilities.map(r => r.toLowerCase()),
        ])
        for (const skill of skills) {
          for (const word of expWords) {
            if (word.includes(skill) || skill.includes(word)) {
              matchedSkills.add(skill)
              break
            }
          }
        }
      }
      return Math.min(1, matchedSkills.size / Math.max(1, skills.size * 0.5))
    }
    case 'project': {
      if (profile.projects.length === 0) return 0.3
      return 0.7
    }
    case 'skills': {
      if (profile.skills.length === 0) return 0
      const profileSkillNames = new Set(profile.skills.map(s => s.name.toLowerCase()))
      const matchCount = jd.requiredSkills.filter(s => profileSkillNames.has(s.toLowerCase())).length
      return Math.min(1, matchCount / Math.max(1, jd.requiredSkills.length * 0.3))
    }
    case 'education':
      return profile.education.length > 0 ? 0.6 : 0
    case 'certifications':
      return profile.certificates.length > 0 ? 0.5 : 0
    case 'awards':
      return (profile.awards?.length || 0) > 0 ? 0.3 : 0
    case 'publications':
      return (profile.publications?.length || 0) > 0 ? 0.3 : 0
  }
}

/**
 * Compute priority for a section based on JD relevance.
 */
export function computeSectionPriority(
  score: number,
  type: PlannedSectionType,
  strategy: 'ats-first' | 'experience-first' | 'balanced',
): number {
  const base = score
  const typeMultiplier = strategy === 'experience-first'
    ? (type === 'experience' ? 1.2 : type === 'project' ? 1.1 : 0.9)
    : strategy === 'ats-first'
    ? (type === 'skills' ? 1.2 : type === 'experience' ? 1.1 : 0.9)
    : 1.0
  return Math.min(1, base * typeMultiplier)
}
