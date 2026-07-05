import { IValidatorResult } from '../../models/ValidationReport'

const requiredSections = ['Summary', 'Experience', 'Education', 'Skills']
const contactIndicators = [/@.+\./, /github\.com/, /linkedin\.com/, /\+?\d{10,}/]

export function validateATS(
  content: { summary: string; experiences: any[]; skills: string[] },
  jdKeywords: string[],
): IValidatorResult {
  const issues: IValidatorResult['issues'] = []
  const hasSummary = content.summary?.length > 20
  const hasExperience = content.experiences?.length > 0
  const hasSkills = content.skills?.length > 0
  const skillText = content.skills?.join(' ').toLowerCase() || ''
  const allText = [content.summary, ...(content.experiences || []).map(e => JSON.stringify(e))].join(' ').toLowerCase()
  let matchedCount = 0
  for (const kw of jdKeywords) {
    if (allText.includes(kw.toLowerCase())) matchedCount++
  }
  const coverage = jdKeywords.length > 0 ? Math.round((matchedCount / jdKeywords.length) * 100) : 100
  if (coverage < 60) issues.push({ severity: 'error', message: `Keyword coverage too low: ${coverage}%`, location: 'skills' })
  if (!hasSummary) issues.push({ severity: 'error', message: 'Missing or too short professional summary' })
  if (!hasExperience) issues.push({ severity: 'error', message: 'No experience entries' })
  if (!hasSkills) issues.push({ severity: 'warning', message: 'No skills listed' })
  const contactFound = contactIndicators.some(r => r.test(allText))
  if (!contactFound) issues.push({ severity: 'warning', message: 'No contact information detected' })
  const score = Math.max(0, Math.min(100, coverage - issues.filter(i => i.severity === 'error').length * 10))
  return { name: 'ATS', score, passed: score >= 60, issues }
}
