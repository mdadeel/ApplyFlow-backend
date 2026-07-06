import { validateHumanization } from './humanizationValidator'

export interface ATSIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  location: string
}

export interface ATSDetailedReport {
  score: number
  passed: boolean
  keywordDensity: number
  duplicateKeywords: string[]
  sectionCompleteness: number
  readability: number
  issues: ATSIssue[]
  matchedRequired: string[]
  matchedPreferred: string[]
  missingSkills: string[]
  semanticMatches: string[]
}

const REQUIRED_SECTIONS = ['Summary', 'Experience', 'Education', 'Skills']

export function getATSDetailedReport(
  content: { markdown: string; sections: any },
  jdKeywords: string[],
  requiredSkills: string[],
  preferredSkills: string[],
): ATSDetailedReport {
  const issues: ATSIssue[] = []
  const resumeText = content.markdown.toLowerCase()

  const matchedRequired = requiredSkills.filter(s => resumeText.includes(s.toLowerCase()))
  const missingSkills = requiredSkills.filter(s => !resumeText.includes(s.toLowerCase()))
  const matchedPreferred = preferredSkills.filter(s => resumeText.includes(s.toLowerCase()))

  const keywordCount = jdKeywords.map(k => ({
    keyword: k,
    count: (resumeText.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length,
  }))

  const keywordDensity = jdKeywords.length > 0
    ? Math.round((keywordCount.filter(k => k.count > 0).length / jdKeywords.length) * 100)
    : 100

  const duplicates = keywordCount.filter(k => k.count > 3).map(k => k.keyword)
  if (duplicates.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Keyword stuffing detected: ${duplicates.join(', ')} (appears ${duplicates.length > 1 ? '' : '>3x'})`,
      location: 'keyword-density',
    })
  }

  const sectionsFound: string[] = []
  const text = content.markdown
  if (/summary/i.test(text)) sectionsFound.push('Summary')
  if (/(?:experience|employment|work\s+history)/i.test(text)) sectionsFound.push('Experience')
  if (/education/i.test(text)) sectionsFound.push('Education')
  if (/skills/i.test(text)) sectionsFound.push('Skills')
  if (/projects?/i.test(text)) sectionsFound.push('Projects')
  if (/certif/i.test(text)) sectionsFound.push('Certifications')

  const sectionCompleteness = Math.round((sectionsFound.length / Math.max(REQUIRED_SECTIONS.length, 1)) * 100)
  if (sectionsFound.length < REQUIRED_SECTIONS.length) {
    const missing = REQUIRED_SECTIONS.filter(s => !sectionsFound.includes(s))
    issues.push({
      severity: 'warning',
      message: `Missing sections: ${missing.join(', ')}`,
      location: 'sections',
    })
  }

  const humanResult = validateHumanization(text)
  const readability = humanResult.score

  if (matchedRequired.length < requiredSkills.length) {
    issues.push({
      severity: 'error',
      message: `Missing ${requiredSkills.length - matchedRequired.length} required skill(s): ${missingSkills.join(', ')}`,
      location: 'skills',
    })
  }

  const score = Math.round(
    keywordDensity * 0.35 +
    sectionCompleteness * 0.25 +
    readability * 0.25 +
    (requiredSkills.length > 0 ? (matchedRequired.length / requiredSkills.length) * 100 : 100) * 0.15,
  )

  return {
    score,
    passed: score >= 60,
    keywordDensity,
    duplicateKeywords: duplicates,
    sectionCompleteness,
    readability,
    issues,
    matchedRequired,
    matchedPreferred,
    missingSkills,
    semanticMatches: [],
  }
}

export function validateATS(
  content: { summary?: string; experiences?: any[]; projects?: any[]; skills?: string[]; education?: any[]; certificates?: any[] },
  jdKeywords: string[],
): { name: string; score: number; passed: boolean; issues: ATSIssue[] } {
  const markdown = [
    content.summary || '',
    ...(content.experiences || []).map((e: any) => `${e.role || ''} at ${e.company || ''}: ${(e.responsibilities || []).join('. ')}`),
    ...(content.skills || []),
    ...(content.education || []).map((e: any) => `${e.degree || ''} at ${e.institution || ''}`),
    ...(content.certificates || []).map((c: any) => `${c.name || ''} (${c.issuer || ''})`),
    ...(content.projects || []).map((p: any) => `${p.title || ''}: ${p.description || ''}`),
  ].join('\n')
  const report = getATSDetailedReport({ markdown, sections: content }, jdKeywords, [], [])
  return {
    name: 'ATS',
    score: report.score,
    passed: report.passed,
    issues: report.issues,
  }
}
