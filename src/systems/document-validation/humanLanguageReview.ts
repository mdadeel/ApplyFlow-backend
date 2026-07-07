import type { SmartApplicationOutput } from '../smart-application/types'
import { LANGUAGE_REPLACEMENTS, AI_COVER_LETTER_PHRASES } from '../../engine/validation/constants'

export interface LanguageIssue {
  original: string
  suggestion: string
  location: string
  type: 'cliche' | 'ai-phrase' | 'weak-language' | 'repetitive'
}

export interface LanguageReviewReport {
  passed: boolean
  issues: LanguageIssue[]
  score: number
}

function scanSection(text: string, location: string): LanguageIssue[] {
  const issues: LanguageIssue[] = []

  for (const entry of LANGUAGE_REPLACEMENTS) {
    const matches = text.match(entry.pattern)
    if (matches) {
      issues.push({
        original: matches[0],
        suggestion: entry.replacement || `replace "${matches[0]}" with natural language`,
        location,
        type: 'cliche',
      })
    }
  }

  for (const pattern of AI_COVER_LETTER_PHRASES) {
    const match = text.match(pattern)
    if (match) {
      issues.push({
        original: match[0],
        suggestion: 'Write concisely — state facts directly without self-promotion framing',
        location,
        type: 'ai-phrase',
      })
    }
  }

  const wordCount = text.split(/\s+/).length
  if (wordCount > 200 && location === 'cover-letter') {
    issues.push({
      original: `${wordCount} words`,
      suggestion: 'Cover letter should be 150-200 words max',
      location,
      type: 'weak-language',
    })
  }

  return issues
}

export function reviewLanguage(output: SmartApplicationOutput): LanguageReviewReport {
  const issues: LanguageIssue[] = []

  if (output.resume.sections?.summary) {
    issues.push(...scanSection(output.resume.sections.summary, 'summary'))
  }

  const experienceList = output.resume.sections?.experience || []
  for (let i = 0; i < experienceList.length; i++) {
    for (let j = 0; j < experienceList[i].bullets.length; j++) {
      issues.push(...scanSection(experienceList[i].bullets[j], `experience[${i}].bullet[${j}]`))
    }
  }

  const projectList = output.resume.sections?.projects || []
  for (let i = 0; i < projectList.length; i++) {
    issues.push(...scanSection(projectList[i].description, `project[${i}].description`))
    for (let j = 0; j < (projectList[i].bullets || []).length; j++) {
      issues.push(...scanSection(projectList[i].bullets[j], `project[${i}].bullet[${j}]`))
    }
  }

  if (output.coverLetter) {
    issues.push(...scanSection(output.coverLetter, 'cover-letter'))
  }

  if (output.email.body) {
    issues.push(...scanSection(output.email.body, 'email-body'))
  }

  const score = Math.max(0, 100 - issues.length * 8)
  return {
    passed: issues.filter(i => i.type === 'cliche').length === 0,
    issues,
    score,
  }
}

export function cleanupLanguage(text: string): string {
  let cleaned = text
  for (const entry of LANGUAGE_REPLACEMENTS) {
    cleaned = cleaned.replace(entry.pattern, entry.replacement)
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  return cleaned
}
