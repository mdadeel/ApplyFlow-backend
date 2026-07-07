export interface SalaryRange {
  min?: number
  max?: number
  currency?: string
}

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance'
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'principal'

export interface JobKeywords {
  technical: string[]
  domain: string[]
  ats: string[]
  actionVerbs: string[]
}

export interface JobAnalysis {
  /** Role/job title */
  title: string
  /** Company name */
  company: string
  /** Location string (can be remote/hybrid/on-site or city) */
  location?: string
  /** Employment type classification */
  employmentType?: EmploymentType
  /** Salary range if present in JD */
  salaryRange?: SalaryRange
  /** Seniority level */
  experienceLevel?: ExperienceLevel
  /** Skills explicitly required */
  requiredSkills: string[]
  /** Skills listed as preferred/nice-to-have */
  preferredSkills: string[]
  /** Soft skills (communication, leadership, teamwork, etc.) */
  softSkills: string[]
  /** Categorized keywords for ATS matching */
  keywords: JobKeywords
  /** Flat keyword list (for backward compat) */
  allKeywords: string[]
  /** Responsibilities extracted from JD */
  responsibilities: string[]
  /** Qualifications listed */
  qualifications: string[]
  /** Benefits listed */
  benefits: string[]
  /** Summary / description text */
  summary: string
  /** Red flags detected */
  redFlags: string[]
  /** Match score with user profile (0-100) */
  matchScore?: number
  /** Raw source information */
  raw?: {
    sourceUrl?: string
    fetchedAt?: string
    sourceText?: string
    parsedAt?: string
  }
}

/**
 * Convert JobAnalysis to the legacy flat format used by smart-application types.
 */
export function toLegacyJDAnalysisOutput(ja: JobAnalysis): {
  company: string
  role: string
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship'
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'principal'
  requiredSkills: string[]
  preferredSkills: string[]
  responsibilities: string[]
  keywords: string[]
  atsKeywords: string[]
  softSkills: string[]
  redFlags: string[]
  matchPercent: number
  salaryRange: string | null
  location: string | null
} {
  return {
    company: ja.company,
    role: ja.title,
    employmentType: (ja.employmentType && ja.employmentType !== 'freelance' ? ja.employmentType : 'full-time') as 'full-time' | 'part-time' | 'contract' | 'internship',
    experienceLevel: ja.experienceLevel || 'mid',
    requiredSkills: ja.requiredSkills,
    preferredSkills: ja.preferredSkills,
    responsibilities: ja.responsibilities,
    keywords: ja.allKeywords,
    atsKeywords: ja.keywords.ats,
    softSkills: ja.softSkills,
    redFlags: ja.redFlags,
    matchPercent: ja.matchScore ?? 0,
    salaryRange: ja.salaryRange
      ? `${ja.salaryRange.currency || '$'}${ja.salaryRange.min?.toLocaleString() || ''} - ${ja.salaryRange.currency || '$'}${ja.salaryRange.max?.toLocaleString() || ''}`
      : null,
    location: ja.location || null,
  }
}

/**
 * Create a JobAnalysis from the ParsedJD deterministic output + optional AI enrichment.
 */
export function createJobAnalysis(params: {
  title: string
  company: string
  location?: string
  employmentType?: EmploymentType
  salaryRange?: SalaryRange
  experienceLevel?: ExperienceLevel
  requiredSkills: string[]
  preferredSkills: string[]
  softSkills: string[]
  keywords: JobKeywords
  responsibilities: string[]
  qualifications: string[]
  benefits: string[]
  summary: string
  redFlags: string[]
  matchScore?: number
  raw?: { sourceUrl?: string; fetchedAt?: string; sourceText?: string }
}): JobAnalysis {
  return {
    title: params.title,
    company: params.company,
    location: params.location,
    employmentType: params.employmentType,
    salaryRange: params.salaryRange,
    experienceLevel: params.experienceLevel,
    requiredSkills: params.requiredSkills,
    preferredSkills: params.preferredSkills,
    softSkills: params.softSkills,
    keywords: params.keywords,
    allKeywords: [
      ...new Set([
        ...params.keywords.technical,
        ...params.keywords.domain,
        ...params.keywords.ats,
        ...params.keywords.actionVerbs,
      ]),
    ],
    responsibilities: params.responsibilities,
    qualifications: params.qualifications,
    benefits: params.benefits,
    summary: params.summary,
    redFlags: params.redFlags,
    matchScore: params.matchScore,
    raw: params.raw,
  }
}
