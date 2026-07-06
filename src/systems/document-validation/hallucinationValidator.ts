import type { SmartApplicationOutput } from '../smart-application/types'
import type { CareerProfile } from '../career-data/profileService'
import type { EvidenceGraph } from '../evidence-graph/types'
import { EvidenceGraphBuilder } from '../evidence-graph/builder'

export interface HallucinationIssue {
  type: 'unsupported-metric' | 'unsupported-skill' | 'unsupported-technology' | 'unsupported-company' | 'unsupported-project' | 'unsupported-achievement'
  text: string
  location: string
  severity: 'error' | 'warning'
}

export interface HallucinationReport {
  passed: boolean
  issues: HallucinationIssue[]
  evidenceCoverage: number
}

function extractAllClaims(output: SmartApplicationOutput): Array<{ text: string; location: string }> {
  const claims: Array<{ text: string; location: string }> = []

  if (output.resume.sections?.summary) {
    claims.push({ text: output.resume.sections.summary, location: 'summary' })
  }

  const experienceList = output.resume.sections?.experience || []
  for (let i = 0; i < experienceList.length; i++) {
    const exp = experienceList[i]
    claims.push({ text: `${exp.role} at ${exp.company}`, location: `experience[${i}].header` })
    for (let j = 0; j < exp.bullets.length; j++) {
      claims.push({ text: exp.bullets[j], location: `experience[${i}].bullet[${j}]` })
    }
  }

  const projectList = output.resume.sections?.projects || []
  for (let i = 0; i < projectList.length; i++) {
    const proj = projectList[i]
    claims.push({ text: proj.title, location: `project[${i}].title` })
    claims.push({ text: proj.description, location: `project[${i}].description` })
    for (let j = 0; j < proj.bullets.length; j++) {
      claims.push({ text: proj.bullets[j], location: `project[${i}].bullet[${j}]` })
    }
  }

  if (output.coverLetter) {
    claims.push({ text: output.coverLetter, location: 'cover-letter' })
  }

  if (output.email.body) {
    claims.push({ text: output.email.body, location: 'email-body' })
  }

  return claims
}

const TECH_PATTERN = /\b(React|Angular|Vue|Next\.?js|Node\.?js|TypeScript|JavaScript|Python|Java|Go|Rust|Docker|Kubernetes|AWS|Azure|GCP|MongoDB|PostgreSQL|MySQL|Redis|GraphQL|REST|API|CI\/CD|Git|Linux|Express|Django|Flask|Spring|Tailwind|Firebase|Stripe|Socket\.?IO)\b/gi

const METRIC_PATTERN = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%|\b\d+(?:\.\d+)?\s*(?:ms|seconds?|users?|customers?)\b/gi

export function validateHallucinations(
  output: SmartApplicationOutput,
  profile: CareerProfile,
): HallucinationReport {
  const builder = new EvidenceGraphBuilder(profile)
  const issues: HallucinationIssue[] = []

  const allClaims = extractAllClaims(output)
  let totalEvidencePoints = 0
  let coveredEvidencePoints = 0

  for (const claim of allClaims) {
    const lowerText = claim.text.toLowerCase()

    const techMatches = lowerText.match(TECH_PATTERN) || []
    for (const tech of techMatches) {
      totalEvidencePoints++
      const sources = builder.lookupTechnology(tech)
      if (sources.length === 0) {
        const skillSources = builder.lookupSkill(tech)
        if (skillSources.length === 0) {
          issues.push({
            type: 'unsupported-technology',
            text: tech,
            location: claim.location,
            severity: 'error',
          })
        } else {
          coveredEvidencePoints++
        }
      } else {
        coveredEvidencePoints++
      }
    }

    const metricMatches = lowerText.match(METRIC_PATTERN) || []
    for (const metric of metricMatches) {
      totalEvidencePoints++
      let found = false
      for (const exp of profile.experiences) {
        for (const a of exp.achievements) if (a.toLowerCase().includes(metric)) found = true
        for (const m of exp.metrics) if (m.toLowerCase().includes(metric)) found = true
      }
      if (!found) {
        issues.push({
          type: 'unsupported-metric',
          text: metric,
          location: claim.location,
          severity: 'error',
        })
      } else {
        coveredEvidencePoints++
      }
    }

    for (const exp of output.resume.sections?.experience || []) {
      if (lowerText.includes(exp.company.toLowerCase())) {
        totalEvidencePoints++
        if (builder.lookupCompany(exp.company).length > 0) {
          coveredEvidencePoints++
        } else {
          issues.push({
            type: 'unsupported-company',
            text: exp.company,
            location: claim.location,
            severity: 'error',
          })
        }
      }
    }

    for (const proj of output.resume.sections?.projects || []) {
      if (lowerText.includes(proj.title.toLowerCase())) {
        totalEvidencePoints++
        if (builder.lookupProject(proj.title).length > 0) {
          coveredEvidencePoints++
        } else {
          issues.push({
            type: 'unsupported-project',
            text: proj.title,
            location: claim.location,
            severity: 'error',
          })
        }
      }
    }
  }

  const evidenceCoverage = totalEvidencePoints > 0
    ? Math.round((coveredEvidencePoints / totalEvidencePoints) * 100)
    : 100

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    evidenceCoverage,
  }
}
