import type { SmartApplicationOutput } from '../smart-application/types'

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

const BLACKLIST: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(results-driven)\b/gi, replacement: 'focused on outcomes' },
  { pattern: /\b(passionate)\b/gi, replacement: '' },
  { pattern: /\b(thrilled)\b/gi, replacement: '' },
  { pattern: /\b(excited)\b/gi, replacement: '' },
  { pattern: /\b(seasoned)\b/gi, replacement: 'experienced' },
  { pattern: /\b(dynamic)\b/gi, replacement: '' },
  { pattern: /\b(highly motivated)\b/gi, replacement: '' },
  { pattern: /\b(proven track record)\b/gi, replacement: 'track record' },
  { pattern: /\b(fast-paced)\b/gi, replacement: 'dynamic' },
  { pattern: /\b(cutting-edge|cuttings? edge)\b/gi, replacement: 'modern' },
  { pattern: /\b(state-of-the-art)\b/gi, replacement: 'modern' },
  { pattern: /\b(leveraged?)\b/gi, replacement: 'used' },
  { pattern: /\b(utilized?)\b/gi, replacement: 'used' },
  { pattern: /\b(innovative)\b/gi, replacement: '' },
  { pattern: /\b(synergy|synergize)\b/gi, replacement: 'collaboration' },
  { pattern: /\b(deep dive|deep-dive)\b/gi, replacement: 'thorough analysis' },
  { pattern: /\b(drill down|drill-down)\b/gi, replacement: 'detailed review' },
  { pattern: /\b(think outside the box)\b/gi, replacement: 'approach creatively' },
  { pattern: /\b(game[- ]?changer?)\b/gi, replacement: 'significant impact' },
  { pattern: /\b(best[- ]?in[- ]?class)\b/gi, replacement: 'high-quality' },
  { pattern: /\b(thought leader)\b/gi, replacement: 'expert' },
  { pattern: /\b(learnings)\b/gi, replacement: 'lessons' },
  { pattern: /\b(ask)\b(?:\s+for\s+help)?/gi, replacement: 'request' },
]

const AI_PHRASES = [
  /\bI am writing to (express|apply)\b/i,
  /\bI am excited to (apply|submit|present)\b/i,
  /\bThis role (aligns with|matches) my (skills|experience|background)\b/i,
  /\bI am confident that my (skills|experience|background)\b/i,
  /\bAs a highly (skilled|motivated|experienced)\b/i,
  /\bI possess a (strong|deep|thorough) (understanding|knowledge)\b/i,
  /\bWith my (extensive|strong|proven) background\b/i,
]

function scanSection(text: string, location: string): LanguageIssue[] {
  const issues: LanguageIssue[] = []

  for (const entry of BLACKLIST) {
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

  for (const pattern of AI_PHRASES) {
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
  for (const entry of BLACKLIST) {
    cleaned = cleaned.replace(entry.pattern, entry.replacement)
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  return cleaned
}
