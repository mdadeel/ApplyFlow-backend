// Humanization Validator — deterministic rules engine, no AI calls

interface HumanizationIssue {
  severity: 'error' | 'warning'
  message: string
  location?: string
}

interface HumanizationMetrics {
  bannedWordCount: number
  aiTransitionCount: number
  sentenceLengthStdDev: number
  actionVerbCount: number
  totalSentences: number
  totalBullets: number
  uniqueSectionCount: number
}

export interface HumanizationResult {
  score: number
  passed: boolean
  issues: HumanizationIssue[]
  metrics: HumanizationMetrics
}

const BANNED_WORDS = [
  'passionate', 'cutting-edge', 'cutting edge', 'dynamic', 'leveraged',
  'utilized', 'innovative', 'game-changing', 'game changing', 'world-class',
  'world class', 'robust', 'spearheaded', 'orchestrated',
  'synergy', 'synergize', 'best-in-class', 'best in class',
  'state-of-the-art', 'state of the art', 'bleeding-edge', 'bleeding edge',
  'next-level', 'next level', 'mission-critical', 'mission critical',
  'results-driven', 'results driven', 'proven track record',
  'highly-skilled', 'highly skilled',
]

const AI_TRANSITIONS = [
  'additionally,', 'furthermore,', 'moreover,', 'in addition,',
  'in conclusion,', 'to summarize,', 'as a result,',
  'it is worth noting', 'it is important to note',
  'needless to say', 'it goes without saying',
  'it should be noted', 'it is noteworthy',
  'of note,', 'importantly,',
]

const ACTION_VERBS = [
  'built', 'developed', 'designed', 'created', 'implemented', 'architected',
  'led', 'managed', 'directed', 'coordinated', 'delivered', 'shipped',
  'improved', 'optimized', 'increased', 'reduced', 'decreased', 'cut',
  'automated', 'migrated', 'transformed', 'modernized', 'refactored',
  'launched', 'deployed', 'integrated', 'configured', 'established',
  'mentored', 'trained', 'coached', 'guided', 'advised',
  'negotiated', 'presented', 'communicated', 'collaborated',
  'analyzed', 'researched', 'evaluated', 'investigated',
  'wrote', 'authored', 'documented', 'standardized',
  'troubleshot', 'resolved', 'debugged', 'tested', 'validated',
]

function countBannedWords(text: string): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word.replace(/[- ]/g, '[- ]')}\\b`, 'gi')
    const matches = lower.match(regex)
    if (matches) count += matches.length
  }
  return count
}

function countAiTransitions(text: string): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const transition of AI_TRANSITIONS) {
    if (lower.includes(transition)) count++
  }
  return count
}

function getSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function getBulletLines(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('-') || l.startsWith('*') || l.startsWith('•') || /^\d+\./.test(l))
    .map(l => l.replace(/^[-*•\d.]+\s*/, '').trim())
    .filter(l => l.length > 0)
}

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function countActionVerbs(text: string): number {
  const lower = text.toLowerCase()
  const words = lower.split(/\s+/)
  const firstWords = new Set<string>()

  // Check first word of each sentence and each bullet
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Skip headers and list markers
    const clean = trimmed.replace(/^[-*•\d.]+\s*/, '').trim()
    if (!clean) continue
    const firstWord = clean.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '')
    if (firstWord && firstWord.length >= 3) {
      firstWords.add(firstWord)
    }
  }

  // Count how many are in our action verb list
  let count = 0
  for (const word of firstWords) {
    if ((ACTION_VERBS as readonly string[]).includes(word)) count++
  }
  return count
}

function getUniqueSectionCount(text: string): number {
  const headingLines = text.split('\n').filter(l => /^#{1,3}\s/.test(l.trim()))
  return new Set(headingLines.map(l => l.trim().replace(/^#+\s*/, '').toLowerCase())).size
}

export function validateHumanization(text: string): HumanizationResult {
  const issues: HumanizationIssue[] = []

  const bannedWordCount = countBannedWords(text)
  if (bannedWordCount > 0) {
    issues.push({
      severity: bannedWordCount > 2 ? 'error' : 'warning',
      message: `Found ${bannedWordCount} banned AI vocabulary word(s): "passionate", "leveraged", "cutting-edge", etc.`,
      location: 'vocabulary',
    })
  }

  const aiTransitionCount = countAiTransitions(text)
  if (aiTransitionCount > 0) {
    issues.push({
      severity: 'warning',
      message: `Found ${aiTransitionCount} AI transition pattern(s): "Additionally,", "Furthermore,", "Moreover,", etc.`,
      location: 'transitions',
    })
  }

  const sentences = getSentences(text)
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length)
  const sentenceStdDev = calculateStdDev(sentenceLengths)

  if (sentences.length >= 5 && sentenceStdDev < 5) {
    issues.push({
      severity: 'warning',
      message: 'Sentence lengths are too uniform (stddev < 5). Mix short and long sentences for natural rhythm.',
      location: 'sentence-structure',
    })
  }

  const bulletLines = getBulletLines(text)
  if (bulletLines.length >= 3) {
    const bulletLengths = bulletLines.map(b => b.split(/\s+/).length)
    const bulletStdDev = calculateStdDev(bulletLengths)
    if (bulletStdDev < 2) {
      issues.push({
        severity: 'warning',
        message: 'Bullet points have very similar lengths. Vary bullet lengths for natural readability.',
        location: 'bullet-structure',
      })
    }
  }

  const actionVerbCount = countActionVerbs(text)
  if (actionVerbCount < 2 && bulletLines.length >= 2) {
    issues.push({
      severity: 'warning',
      message: `Only ${actionVerbCount} unique action verb(s) found. Use varied action verbs (Built, Led, Designed, etc.) to start sentences/bullets.`,
      location: 'action-verbs',
    })
  }

  const uniqueSections = getUniqueSectionCount(text)
  if (uniqueSections < 2 && text.length > 100) {
    issues.push({
      severity: 'warning',
      message: 'Content lacks clear section structure. Use standard resume sections (Summary, Experience, Skills, etc.).',
      location: 'structure',
    })
  }

  // Calculate score: start at 100, subtract per issue
  let score = 100
  for (const issue of issues) {
    score -= issue.severity === 'error' ? 15 : 8
  }
  score = Math.max(0, Math.min(100, score))

  return {
    score,
    passed: score >= 65,
    issues,
    metrics: {
      bannedWordCount,
      aiTransitionCount,
      sentenceLengthStdDev: Math.round(sentenceStdDev * 10) / 10,
      actionVerbCount,
      totalSentences: sentences.length,
      totalBullets: bulletLines.length,
      uniqueSectionCount: uniqueSections,
    },
  }
}
