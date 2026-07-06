export interface AtsResult {
  score: number
  missingKeywords: string[]
  formattingIssues: string[]
  suggestions: string[]
}

const SECTION_HEADERS = [
  'experience', 'work experience', 'employment', 'work history',
  'education', 'academic',
  'skills', 'technical skills', 'core competencies',
  'projects', 'professional projects',
  'certifications', 'certificates',
  'summary', 'professional summary', 'objective',
]

const FORMATTING_ISSUES: Array<{ check: (c: string) => boolean; issue: string }> = [
  { check: (c) => !c.includes('\n'), issue: 'Resume is a single block of text' },
  { check: (c) => (c.match(/\b(bullet|point)\b/gi) || []).length < 3, issue: 'Few or no bullet points detected' },
  { check: (c) => c.length < 500, issue: 'Resume content is too short' },
  { check: (c) => c.length > 10000, issue: 'Resume may be too long for ATS parsing' },
  { check: (c) => !SECTION_HEADERS.some(h => new RegExp(h, 'i').test(c)), issue: 'No standard section headers detected' },
  { check: (c) => !/\b(email|phone|linkedin)\b/i.test(c), issue: 'No contact information detected' },
]

export function analyzeAts(resumeContent: string, requiredSkills: string[], preferredSkills: string[]): AtsResult {
  const content = resumeContent.toLowerCase()
  const missingKeywords: string[] = []
  let matchedRequired = 0

  for (const skill of requiredSkills) {
    const skillLower = skill.toLowerCase()
    if (content.includes(skillLower)) {
      matchedRequired++
    } else {
      missingKeywords.push(skill)
    }
  }

  for (const skill of preferredSkills) {
    const skillLower = skill.toLowerCase()
    if (!content.includes(skillLower)) {
      missingKeywords.push(skill)
    }
  }

  const keywordScore = requiredSkills.length > 0
    ? matchedRequired / requiredSkills.length
    : 1.0

  const formattingIssues: string[] = []
  for (const { check, issue } of FORMATTING_ISSUES) {
    if (check(content)) formattingIssues.push(issue)
  }

  const formatScore = Math.max(0, 1 - formattingIssues.length * 0.15)

  const lengthScore = Math.min(1, content.length / 2000)

  const score = Math.round((keywordScore * 0.5 + formatScore * 0.3 + lengthScore * 0.2) * 100)

  const suggestions: string[] = []
  if (missingKeywords.length > 0) {
    suggestions.push(`Add these missing keywords: ${missingKeywords.slice(0, 5).join(', ')}`)
  }
  for (const issue of formattingIssues) {
    suggestions.push(issue)
  }
  if (score < 60) {
    suggestions.push('Consider restructuring your resume for better ATS compatibility')
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    missingKeywords,
    formattingIssues,
    suggestions,
  }
}
