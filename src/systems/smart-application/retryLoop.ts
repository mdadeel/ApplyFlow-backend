import type { SmartApplicationOutput, GenerationConfig } from './types'
import type { CareerProfile } from '../career-data/profileService'
import { validateHallucinations } from '../document-validation/hallucinationValidator'
import { enforceMetricsPolicy } from '../document-validation/metricsPolicy'
import { computeConfidence } from '../document-validation/confidenceScore'
import { optimizeResume } from '../resume-optimizer/optimizer'
import { reviewLanguage, cleanupLanguage } from '../document-validation/humanLanguageReview'

type GenerateFn = () => Promise<{ output: SmartApplicationOutput; scores: { ats: number; match: number; overall: number } }>

export interface RetryResult {
  output: SmartApplicationOutput
  attempts: number
  confidence: number
  atsScore: number
  hallucinationFree: boolean
  issues: string[]
}

/**
 * @deprecated Use `orchestrateRetry()` from `engine/retry/orchestrator` instead.
 * This full-reset retry loop is replaced by the section-level retry orchestrator.
 * Kept temporarily for backward compatibility with any direct imports.
 */
export async function generateWithRetry(
  generate: GenerateFn,
  profile: CareerProfile,
  config: GenerationConfig,
): Promise<RetryResult> {
  let lastError: string | null = null
  const allIssues: string[] = []

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    console.log(`[RetryLoop] Attempt ${attempt}/${config.maxRetries}`)

    const result = await generate()
    let output = result.output

    output = optimizeResume(output, profile)

    if (config.enforceTruthGate) {
      const { output: metricsCleaned, metricsStripped } = enforceMetricsPolicy(output, profile)
      if (metricsStripped.length > 0) {
        console.warn(`[RetryLoop] Stripped ${metricsStripped.length} unverifiable metrics on attempt ${attempt}`)
        allIssues.push(...metricsStripped.map(m => m.reason))
      }
      output = metricsCleaned
    }

    const hallucinationReport = validateHallucinations(output, profile)

    if (output.coverLetter) {
      output.coverLetter = cleanupLanguage(output.coverLetter)
    }
    if (output.email.body) {
      output.email.body = cleanupLanguage(output.email.body)
    }

    const confidence = computeConfidence(output, profile)
    const atsKeywords = [
      ...new Set([
        ...(output.analysis.atsKeywords || []),
        ...(output.analysis.requiredSkills || []),
      ].map(k => k.toLowerCase())),
    ]
    const resumeText = output.resume.markdown.toLowerCase()
    const atsScore = atsKeywords.length > 0
      ? Math.round((atsKeywords.filter(k => resumeText.includes(k)).length / atsKeywords.length) * 100)
      : 100

    const hallucinationFree = hallucinationReport.issues.filter(i => i.severity === 'error').length === 0
    const atsPassed = atsScore >= config.minATSScore
    const confidencePassed = confidence.passed

    if (hallucinationFree && atsPassed && confidencePassed) {
      console.log(`[RetryLoop] All validators passed on attempt ${attempt}`)
      return {
        output,
        attempts: attempt,
        confidence: confidence.overall,
        atsScore,
        hallucinationFree: true,
        issues: allIssues,
      }
    }

    const issues: string[] = []
    if (!hallucinationFree) issues.push(`hallucination (${hallucinationReport.issues.length} issues)`)
    if (!atsPassed) issues.push(`ATS score ${atsScore} < ${config.minATSScore}`)
    if (!confidencePassed) issues.push(`confidence ${confidence.overall} < ${config.minConfidence}`)
    lastError = `Attempt ${attempt}: ${issues.join(', ')}`
    console.warn(`[RetryLoop] ${lastError}`)
  }

  console.warn(`[RetryLoop] All ${config.maxRetries} attempts exhausted. Returning best effort.`)
  const finalResult = await generate()
  const finalConfidence = computeConfidence(finalResult.output, profile)
  const atsKeywords = [
    ...new Set([
      ...(finalResult.output.analysis.atsKeywords || []),
      ...(finalResult.output.analysis.requiredSkills || []),
    ].map(k => k.toLowerCase())),
  ]
  const resumeText = finalResult.output.resume.markdown.toLowerCase()
  const finalATS = atsKeywords.length > 0
    ? Math.round((atsKeywords.filter(k => resumeText.includes(k)).length / atsKeywords.length) * 100)
    : 100

  return {
    output: finalResult.output,
    attempts: config.maxRetries,
    confidence: finalConfidence.overall,
    atsScore: finalATS,
    hallucinationFree: false,
    issues: allIssues,
  }
}
