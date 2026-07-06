import type { SmartApplicationOutput } from '../smart-application/types'

export interface RecruiterFeedback {
  category: string
  score: number
  passed: boolean
  feedback: string[]
}

export interface RecruiterReviewReport {
  overall: number
  passed: boolean
  feedback: RecruiterFeedback[]
}

export function recruiterReview(output: SmartApplicationOutput): RecruiterReviewReport {
  const feedback: RecruiterFeedback[] = []

  const readability = evaluateReadability(output.resume.markdown)
  feedback.push(readability)

  const credibility = evaluateCredibility(output)
  feedback.push(credibility)

  const professionalism = evaluateProfessionalism(output)
  feedback.push(professionalism)

  const skillPositioning = evaluateSkillPositioning(output)
  feedback.push(skillPositioning)

  const bulletQuality = evaluateBulletQuality(output)
  feedback.push(bulletQuality)

  const overall = Math.round(
    feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length,
  )

  return {
    overall,
    passed: overall >= 65,
    feedback,
  }
}

function evaluateReadability(markdown: string): RecruiterFeedback {
  const issues: string[] = []
  const lines = markdown.split('\n').filter(l => l.trim().length > 0)

  const longLines = lines.filter(l => l.split(/\s+/).length > 40)
  if (longLines.length > 0) issues.push(`${longLines.length} line(s) exceed 40 words — consider splitting`)

  const avgLineLen = Math.round(lines.reduce((sum, l) => sum + l.split(/\s+/).length, 0) / lines.length)
  if (avgLineLen > 25) issues.push(`Average line length ${avgLineLen} words — aim for 15-20`)

  const score = Math.max(0, 100 - issues.length * 15)
  return {
    category: 'Readability',
    score,
    passed: score >= 65,
    feedback: issues.length > 0 ? issues : ['Resume reads clearly'],
  }
}

function evaluateCredibility(output: SmartApplicationOutput): RecruiterFeedback {
  const issues: string[] = []

  const banned = ['results-driven', 'proven track record', 'highly motivated', 'team player', 'go-getter']
  const text = [output.resume.markdown, output.coverLetter, output.email.body].join(' ').toLowerCase()
  for (const phrase of banned) {
    if (text.includes(phrase)) issues.push(`Cliché detected: "${phrase}"`)
  }

  const bullets = (output.resume.sections?.experience || []).flatMap(e => e.bullets)
  const vagueBullets = bullets.filter(b => /^responsible for/i.test(b) || /^involved in/i.test(b) || /^helped with/i.test(b))
  if (vagueBullets.length > 0) issues.push(`${vagueBullets.length} bullet(s) start with vague language ("responsible for", "involved in")`)

  const score = Math.max(0, 100 - issues.length * 12)
  return {
    category: 'Credibility',
    score,
    passed: score >= 65,
    feedback: issues.length > 0 ? issues : ['Content appears credible'],
  }
}

function evaluateProfessionalism(output: SmartApplicationOutput): RecruiterFeedback {
  const issues: string[] = []

  const allText = [output.email.body, output.coverLetter].join(' ')

  if (output.email.body.length > 140 * 5) issues.push('Email body exceeds ~140 words')

  if (/overly\s+(excited|enthusiastic)/i.test(allText)) issues.push('Tone is overly familiar')

  if (/(?:^|\n)\s*hey\s+(?:there|hiring|team)/i.test(allText)) issues.push('Overly casual greeting')

  const score = Math.max(0, 100 - issues.length * 20)
  return {
    category: 'Professionalism',
    score,
    passed: score >= 65,
    feedback: issues.length > 0 ? issues : ['Tone is professional'],
  }
}

function evaluateSkillPositioning(output: SmartApplicationOutput): RecruiterFeedback {
  const issues: string[] = []

  const analysisSkills = new Set([
    ...output.analysis.requiredSkills.map(s => s.toLowerCase()),
    ...output.analysis.preferredSkills.map(s => s.toLowerCase()),
  ])

  const summarySkillCount = [...analysisSkills].filter(s =>
    output.resume.sections?.summary?.toLowerCase().includes(s),
  ).length

  if (summarySkillCount < 2 && output.analysis.requiredSkills.length > 0) {
    issues.push('Summary mentions fewer than 2 JD-required skills')
  }

  const score = Math.max(0, 100 - issues.length * 20)
  return {
    category: 'Skill Positioning',
    score,
    passed: score >= 65,
    feedback: issues.length > 0 ? issues : ['Skills are well-positioned'],
  }
}

function evaluateBulletQuality(output: SmartApplicationOutput): RecruiterFeedback {
  const issues: string[] = []

  const experienceBullets = (output.resume.sections?.experience || []).flatMap(e => e.bullets)
  const projectBullets = (output.resume.sections?.projects || []).flatMap(p => p.bullets)

  if (experienceBullets.length === 0 && output.resume.sections?.experience?.length) {
    issues.push('Experience sections exist but have no bullets')
  }

  for (let i = 0; i < experienceBullets.length; i++) {
    for (let j = i + 1; j < experienceBullets.length; j++) {
      if (experienceBullets[i].toLowerCase() === experienceBullets[j].toLowerCase()) {
        issues.push(`Duplicate bullet: "${experienceBullets[i].substring(0, 50)}..."`)
      }
    }
  }

  const allBullets = [...experienceBullets, ...projectBullets]
  const actionVerbStart = allBullets.filter(b => /^[A-Z][a-z]+ed\s/.test(b)).length
  if (allBullets.length > 0 && actionVerbStart < allBullets.length * 0.5) {
    issues.push(`Only ${actionVerbStart}/${allBullets.length} bullets start with a strong action verb`)
  }

  const score = Math.max(0, 100 - issues.length * 12)
  return {
    category: 'Bullet Quality',
    score,
    passed: score >= 65,
    feedback: issues.length > 0 ? issues : ['Bullets are well-written'],
  }
}
