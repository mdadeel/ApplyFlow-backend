import type { SmartApplicationOutput } from '../smart-application/types'
import type { CareerProfile } from '../career-data/profileService'
import { EvidenceGraphBuilder } from '../evidence-graph/builder'
import { validateHumanization } from './humanizationValidator'
import { reviewLanguage } from './humanLanguageReview'
import { recruiterReview } from './recruiterReview'
import { validateHallucinations } from './hallucinationValidator'

export interface ConfidenceReport {
  evidenceCoverage: number
  hallucinationRisk: number
  atsConfidence: number
  skillConfidence: number
  humanizationConfidence: number
  languageQuality: number
  recruiterScore: number
  overall: number
  passed: boolean
}

export function computeConfidence(
  output: SmartApplicationOutput,
  profile: CareerProfile,
): ConfidenceReport {
  const graphBuilder = new EvidenceGraphBuilder(profile)

  const evidenceNodes: Array<{ text: string; type: string }> = []
  for (const skillCat of output.resume.sections?.skills || []) {
    for (const skill of skillCat.items) {
      evidenceNodes.push({ text: skill, type: 'skill' })
    }
  }
  for (const exp of output.resume.sections?.experience || []) {
    for (const tech of exp.technologies || []) {
      evidenceNodes.push({ text: tech, type: 'technology' })
    }
  }
  const graph = graphBuilder.build(evidenceNodes)
  const evidenceCoverage = graph.metadata.coverage

  const hallucinationReport = validateHallucinations(output, profile)
  const hallucinationRisk = 100 - hallucinationReport.evidenceCoverage

  const resumeText = output.resume.markdown.toLowerCase()
  const jdKeywords = [
    ...new Set([
      ...(output.analysis.atsKeywords || []),
      ...(output.analysis.requiredSkills || []),
    ].map(k => k.toLowerCase())),
  ]
  const atsFound = jdKeywords.filter(k => resumeText.includes(k)).length
  const atsConfidence = jdKeywords.length > 0
    ? Math.round((atsFound / jdKeywords.length) * 100)
    : 100

  const skillEvidence = evidenceNodes.filter(n => n.type === 'skill')
  const supportedSkills = skillEvidence.filter(n => graphBuilder.lookupSkill(n.text).length > 0).length
  const skillConfidence = skillEvidence.length > 0
    ? Math.round((supportedSkills / skillEvidence.length) * 100)
    : 100

  const humanResult = validateHumanization(resumeText)
  const humanizationConfidence = humanResult.score

  const langResult = reviewLanguage(output)
  const languageQuality = langResult.score

  const recruitResult = recruiterReview(output)
  const recruiterScore = recruitResult.overall

  const scores = [
    evidenceCoverage,
    100 - hallucinationRisk,
    atsConfidence,
    skillConfidence,
    humanizationConfidence,
    languageQuality,
    recruiterScore,
  ]
  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  return {
    evidenceCoverage,
    hallucinationRisk,
    atsConfidence,
    skillConfidence,
    humanizationConfidence,
    languageQuality,
    recruiterScore,
    overall,
    passed: overall >= 70,
  }
}
