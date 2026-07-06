import type { SmartApplicationOutput } from '../smart-application/types'
import type { CareerProfile } from '../career-data/profileService'
import type { UnverifiableClaim } from './truthGate'

const METRIC_PATTERNS = [
  /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%/g,
  /\b(?:reduced|increased|improved|decreased|cut|lowered|boosted|accelerated)\s+\w+\s+by\s+\d+(?:\.\d+)?%/gi,
  /\b(?:reduced|increased|improved|decreased|cut|lowered|boosted|accelerated)\s+\w+\s+by\s+\d+(?:\.\d+)?[xX]/gi,
  /\b\d+(?:\.\d+)?\s*(?:ms|seconds?|minutes?|hours?|days?)\b/gi,
  /\b(?:over|more than|less than|approximately|about)\s+\d+(?:,\d{3})*(?:\.\d+)?/gi,
  /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:users?|customers?|clients?|students?|members?|employees?|developers?|engineers?)\b/gi,
  /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:repos?|repositories?|commits?|PRs?|issues?|tests?|bugs?|features?)\b/gi,
  /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:requests?|queries?|transactions?|payments?|orders?)\b/gi,
]

function extractMetrics(text: string): string[] {
  const found: string[] = []
  for (const pattern of METRIC_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) found.push(...matches.map(m => m.trim().toLowerCase()))
  }
  return [...new Set(found)]
}

function metricExistsInProfile(metric: string, profile: CareerProfile): boolean {
  const lower = metric.toLowerCase()
  for (const exp of profile.experiences) {
    for (const a of exp.achievements) if (a.toLowerCase().includes(lower)) return true
    for (const m of exp.metrics) if (m.toLowerCase().includes(lower)) return true
  }
  for (const proj of profile.projects) {
    if (proj.outcome?.toLowerCase().includes(lower)) return true
  }
  return false
}

function stripMetricFromSentence(sentence: string, metric: string): string {
  const withoutMetric = sentence
    .replace(new RegExp(metric.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/\s+/g, ' ')
    .replace(/,?\s*,/g, ',')
    .trim()
    .replace(/^(and|that|which|with)\s+/i, '')
    .trim()
  return withoutMetric || sentence
}

export function enforceMetricsPolicy(
  output: SmartApplicationOutput,
  profile: CareerProfile,
): { output: SmartApplicationOutput; metricsStripped: UnverifiableClaim[] } {
  const metricsStripped: UnverifiableClaim[] = []

  const resumeText = output.resume.markdown
  const foundMetrics = extractMetrics(resumeText)

  for (const metric of foundMetrics) {
    if (!metricExistsInProfile(metric, profile)) {
      metricsStripped.push({
        claim: metric,
        location: 'resume.markdown',
        reason: `Unverifiable metric '${metric}' not found in profile`,
      })
    }
  }

  if (metricsStripped.length === 0) {
    return { output, metricsStripped: [] }
  }

  let cleanedMd = output.resume.markdown
  for (const issue of metricsStripped) {
    const lines = cleanedMd.split('\n')
    const newLines = lines.map(line => {
      if (line.toLowerCase().includes(issue.claim.toLowerCase())) {
        const metric = issue.claim
        const pctMatch = metric.match(/(\d+(?:\.\d+)?%)/)
        if (pctMatch) {
          return stripMetricFromSentence(line, pctMatch[0])
        }
        const numMatch = metric.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/)
        if (numMatch) {
          return stripMetricFromSentence(line, numMatch[0])
        }
      }
      return line
    })
    cleanedMd = newLines.join('\n')
  }

  return {
    output: {
      ...output,
      resume: { ...output.resume, markdown: cleanedMd },
    },
    metricsStripped,
  }
}
