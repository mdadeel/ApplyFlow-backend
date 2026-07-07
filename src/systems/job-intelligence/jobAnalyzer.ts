import { getAIProvider } from '../ai'
import { parseJD } from './jdParser'
import { extractKeywords, extractATSTerms } from './keywordExtractor'
import type { ParsedJD } from './types'
import type { JobAnalysis, EmploymentType, ExperienceLevel, SalaryRange } from '../../engine/types/job-analysis'
import { createJobAnalysis } from '../../engine/types/job-analysis'

/**
 * Standalone job analysis engine.
 *
 * Combines deterministic extraction (regex-based parsing) with AI enrichment.
 * This module has NO dependency on resume/career profile data — it only
 * analyzes job descriptions.
 *
 * Usage:
 *   const analysis = await analyzeJob(jdText)
 *   // analysis is a canonical JobAnalysis object
 */
export async function analyzeJob(
  jdText: string,
  options?: { sourceUrl?: string; existingMatchScore?: number }
): Promise<JobAnalysis> {
  // Run deterministic + AI extraction in parallel
  const [deterministic, aiResult] = await Promise.all([
    parseJD(jdText),
    getAIProvider().analyzeJD(jdText).catch(() => null),
  ])

  return mergeAnalyses(deterministic, jdText, aiResult, options)
}

/**
 * Create a JobAnalysis from deterministic parsing alone (no AI call).
 * Useful for fast-path analysis or offline processing.
 */
export function analyzeJobDeterministic(jdText: string): JobAnalysis {
  const parsed = parseJD(jdText)
  return toJobAnalysis(parsed, jdText)
}

/**
 * Merge deterministic and AI analysis results into a single canonical JobAnalysis.
 * Deterministic results take precedence for structured fields; AI fills gaps.
 */
function mergeAnalyses(
  deterministic: ParsedJD & { employmentType?: string; salaryRange?: SalaryRange; softSkills: string[] },
  jdText: string,
  aiResult: Awaited<ReturnType<ReturnType<typeof getAIProvider>['analyzeJD']>> | null,
  options?: { sourceUrl?: string; existingMatchScore?: number },
): JobAnalysis {
  const keywords = extractKeywords(jdText)
  const atsTerms = extractATSTerms(jdText)

  // Combine: deterministic wins for structured data, AI fills gaps
  const allRequired = [...new Set([
    ...deterministic.requiredSkills,
    ...(aiResult?.requiredSkills || []),
  ])]

  const allPreferred = [...new Set([
    ...deterministic.niceToHaveSkills,
    ...(aiResult?.niceToHaveSkills || []),
  ])]

  const allRedFlags = [...new Set([
    ...deterministic.redFlags,
    ...(aiResult?.redFlags || []),
  ])]

  return createJobAnalysis({
    title: deterministic.role !== 'Software Engineer' ? deterministic.role : (aiResult?.role || deterministic.role),
    company: deterministic.company !== 'Target Company' ? deterministic.company : (aiResult?.company || deterministic.company),
    location: deterministic.location || aiResult?.location || undefined,
    employmentType: (deterministic.employmentType as EmploymentType) || undefined,
    salaryRange: deterministic.salaryRange,
    experienceLevel: (deterministic.experienceLevel as ExperienceLevel) || (aiResult?.experienceLevel as ExperienceLevel) || undefined,
    requiredSkills: allRequired,
    preferredSkills: allPreferred,
    softSkills: deterministic.softSkills,
    keywords: {
      technical: [...extractSkillsFromJd(jdText)],
      domain: [],
      ats: atsTerms,
      actionVerbs: [],
    },
    responsibilities: deterministic.responsibilities,
    qualifications: [],
    benefits: [],
    summary: aiResult?.summary || deterministic.summary,
    redFlags: allRedFlags,
    matchScore: options?.existingMatchScore,
    raw: options?.sourceUrl
      ? { sourceUrl: options.sourceUrl, fetchedAt: new Date().toISOString(), sourceText: jdText.slice(0, 1000) }
      : undefined,
  })
}

/**
 * Extract technical skill names from JD text using keyword parser.
 */
function extractSkillsFromJd(text: string): string[] {
  const lower = text.toLowerCase()
  const found = new Set<string>()
  const techList = [
    'react', 'angular', 'vue', 'typescript', 'javascript', 'node.js', 'python',
    'java', 'go', 'rust', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
    'mongodb', 'postgresql', 'mysql', 'redis', 'graphql', 'rest', 'api',
    'html', 'css', 'tailwind', 'next.js', 'express', 'django', 'flask',
  ]
  for (const kw of techList) {
    if (lower.includes(kw)) found.add(kw)
  }
  return [...found]
}

/**
 * Convert a ParsedJD to a canonical JobAnalysis.
 */
function toJobAnalysis(
  parsed: ParsedJD & { employmentType?: string; salaryRange?: SalaryRange; softSkills: string[] },
  jdText: string,
): JobAnalysis {
  const atsTerms = extractATSTerms(jdText)
  const keywords = extractKeywords(jdText)

  return createJobAnalysis({
    title: parsed.role,
    company: parsed.company,
    location: parsed.location,
    employmentType: parsed.employmentType as EmploymentType | undefined,
    salaryRange: parsed.salaryRange,
    experienceLevel: parsed.experienceLevel as ExperienceLevel | undefined,
    requiredSkills: parsed.requiredSkills,
    preferredSkills: parsed.niceToHaveSkills,
    softSkills: parsed.softSkills,
    keywords: {
      technical: [...extractSkillsFromJd(jdText)],
      domain: [],
      ats: parsed.atsTerms,
      actionVerbs: [],
    },
    responsibilities: parsed.responsibilities,
    qualifications: [],
    benefits: [],
    summary: parsed.summary,
    redFlags: parsed.redFlags,
    raw: undefined,
  })
}
