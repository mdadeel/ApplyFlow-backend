// Refinement Service — multi-pass improvement pipeline

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { AIProvider } from '../ai/aiProvider'
import type { SmartApplicationOutput } from './types'
import type { CareerProfile } from '../career-data/profileService'
import { validateTruthAgainstProfile, stripUnverifiableClaims } from '../document-validation/truthGate'
import { validateHumanization } from '../document-validation/humanizationValidator'

const HUMANIZATION_THRESHOLD = 70
const ATS_THRESHOLD = 80

function getRefinementPrompt(name: string): string {
  const fromDist = join(process.cwd(), 'dist', 'systems', 'smart-application', 'prompts')
  const fromSrc = join(process.cwd(), 'src', 'systems', 'smart-application', 'prompts')
  const dir = existsSync(fromDist) ? fromDist : fromSrc
  return readFileSync(join(dir, name), 'utf-8')
}

function combineContentText(output: SmartApplicationOutput): string {
  const parts: string[] = []
  parts.push('=== RESUME ===')
  parts.push(output.resume.markdown)
  parts.push('=== EMAIL ===')
  parts.push(`Subject: ${output.email.subject}`)
  parts.push(output.email.body)
  parts.push('=== COVER LETTER ===')
  parts.push(output.coverLetter)
  return parts.join('\n\n')
}

function updateOutputFromRefinement(
  output: SmartApplicationOutput,
  refined: { resumeMarkdown?: string; emailSubject?: string; emailBody?: string; coverLetter?: string }
): SmartApplicationOutput {
  return {
    ...output,
    resume: {
      ...output.resume,
      markdown: refined.resumeMarkdown?.trim() || output.resume.markdown,
    },
    email: {
      ...output.email,
      subject: refined.emailSubject?.trim() || output.email.subject,
      body: refined.emailBody?.trim() || output.email.body,
    },
    coverLetter: refined.coverLetter?.trim() || output.coverLetter,
  }
}

export class RefinementService {
  /**
   * Pass 2: Humanization refinement.
   * If the deterministic humanization validator scores below threshold,
   * re-prompt the AI to fix specific issues.
   */
  async refineHumanization(
    aiProvider: AIProvider,
    output: SmartApplicationOutput,
  ): Promise<{ output: SmartApplicationOutput; changes: string[]; humanizationScore: number }> {
    const allText = combineContentText(output)
    const humanResult = validateHumanization(allText)

    if (humanResult.score >= HUMANIZATION_THRESHOLD) {
      return { output, changes: [], humanizationScore: humanResult.score }
    }

    const issueDescriptions = humanResult.issues.map(i => `- [${i.severity}] ${i.message}`).join('\n')
    const instructions = humanResult.issues.map(i => {
      switch (i.location) {
        case 'vocabulary': return 'Replace banned AI words with natural alternatives'
        case 'transitions': return 'Remove AI transitions; use varied connectors or no connector'
        case 'sentence-structure': return 'Mix short and long sentences for natural rhythm'
        case 'bullet-structure': return 'Vary bullet lengths — some short, some detailed'
        case 'action-verbs': return 'Start each bullet with a different action verb'
        case 'structure': return 'Add clear section headers (Summary, Experience, Skills)'
        default: return ''
      }
    }).filter(Boolean).join('\n')

    const prompt = getRefinementPrompt('refinement-humanization.md')
      .replace('{{currentResume}}', allText)
      .replace('{{issues}}', issueDescriptions)
      .replace('{{instructions}}', instructions)

    const raw = await aiProvider.generateText(prompt, 0.4, true)
    const refined = this.parseRefinementJson(raw)

    const result = updateOutputFromRefinement(output, refined)
    const changes = this.detectChanges(output, result)

    return { output: result, changes, humanizationScore: validateHumanization(combineContentText(result)).score }
  }

  /**
   * Pass 3: ATS gap fill.
   * Check which JD keywords are missing from resume; re-prompt AI to incorporate them naturally.
   */
  async fillATSGaps(
    aiProvider: AIProvider,
    output: SmartApplicationOutput,
    careerProfile: CareerProfile,
  ): Promise<{ output: SmartApplicationOutput; changes: string[]; atsScore: number }> {
    const resumeText = output.resume.markdown.toLowerCase()
    const jdKeywords = [
      ...new Set([
        ...(output.analysis.atsKeywords || []),
        ...(output.analysis.requiredSkills || []),
      ].map(k => k.toLowerCase())),
    ]

    const missing = jdKeywords.filter(kw => !resumeText.includes(kw))

    const currentCoverage = jdKeywords.length > 0
      ? Math.round(((jdKeywords.length - missing.length) / jdKeywords.length) * 100)
      : 100

    if (missing.length === 0 || currentCoverage >= ATS_THRESHOLD) {
      return { output, changes: [], atsScore: currentCoverage }
    }

    const prompt = getRefinementPrompt('refinement-ats.md')
      .replace('{{currentResume}}', output.resume.markdown)
      .replace('{{missingKeywords}}', missing.map(k => `- ${k}`).join('\n'))

    const raw = await aiProvider.generateText(prompt, 0.4, true)

    let parsed: { resumeMarkdown?: string; filledKeywords?: string[]; skippedKeywords?: string[]; changes?: string[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else return { output, changes: [], atsScore: currentCoverage }
    }

    if (!parsed.resumeMarkdown || parsed.resumeMarkdown.trim().length < 50) {
      return { output, changes: [], atsScore: currentCoverage }
    }

    const refined: SmartApplicationOutput = {
      ...output,
      resume: { ...output.resume, markdown: parsed.resumeMarkdown.trim() },
    }

    // Re-check truth on the modified resume
    const truthResult = validateTruthAgainstProfile(refined, careerProfile)
    let finalOutput = refined
    if (truthResult.unverifiable.length > 0) {
      console.warn(`[ATS Refinement] Truth gate found ${truthResult.unverifiable.length} new unverifiable claims — reverting`)
      return { output, changes: [], atsScore: currentCoverage }
    }

    // Recalculate ATS score
    const newResumeText = finalOutput.resume.markdown.toLowerCase()
    const newFound = jdKeywords.filter(kw => newResumeText.includes(kw)).length
    const newScore = jdKeywords.length > 0 ? Math.round((newFound / jdKeywords.length) * 100) : 100

    return {
      output: finalOutput,
      changes: parsed.changes || [],
      atsScore: newScore,
    }
  }

  private parseRefinementJson(raw: string): { resumeMarkdown?: string; emailSubject?: string; emailBody?: string; coverLetter?: string } {
    try {
      return JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try { return JSON.parse(match[0]) } catch {}
      }
    }
    return {}
  }

  private detectChanges(original: SmartApplicationOutput, refined: SmartApplicationOutput): string[] {
    const changes: string[] = []
    if (refined.resume.markdown !== original.resume.markdown) changes.push('Humanized resume markdown')
    if (refined.email.subject !== original.email.subject) changes.push('Updated email subject')
    if (refined.email.body !== original.email.body) changes.push('Refined email body')
    if (refined.coverLetter !== original.coverLetter) changes.push('Refined cover letter')
    return changes
  }
}
