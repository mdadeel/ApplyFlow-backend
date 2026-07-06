// Truth Gate — validates every claim in AI output against the career profile DB

import type { SmartApplicationOutput } from '../smart-application/types'
import type { CareerProfile } from '../career-data/profileService'

export interface ClaimProvenance {
  claim: string
  sourceType: 'experience' | 'project' | 'skill' | 'education' | 'certificate'
  sourceId: string
  field: string
}

export interface UnverifiableClaim {
  claim: string
  location: string
  reason: string
}

export interface TruthGateResult {
  passed: boolean
  verified: ClaimProvenance[]
  unverifiable: UnverifiableClaim[]
  stripped: boolean
}

const METRIC_REGEX = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})*[xX]\b|\breduced\s+\w+\s+by\s+\d+%|\bincreased\s+\w+\s+by\s+\d+%|\bimproved\s+\w+\s+by\s+\d+%|\b\d{2,3}\s*ms\b|\b\d+(?:\.\d+)?\s*seconds?\b/i

function extractPercentages(text: string): string[] {
  const found: string[] = []
  const pctMatches = text.match(/\b\d{1,3}(?:\.\d+)?%/g)
  if (pctMatches) found.push(...pctMatches)
  const wordMatches = text.match(/(?:reduced|increased|improved|decreased|cut|lowered)\s+\w+\s+by\s+\d+%/gi)
  if (wordMatches) found.push(...wordMatches)
  return found.map(s => s.toLowerCase().trim())
}

function extractTechnologies(text: string): string[] {
  const techs = text.match(/\b[A-Z][a-z]+(?:\s*\.?[A-Z][a-z]*)*(?:\s+\d+(?:\.\d+)?)?(?:\s*(?:\.js|\.ts|\.py|\.rb|\.go))?\b/g) || []
  return [...new Set(techs.map(t => t.trim()))].filter(t => t.length >= 2)
}

function splitIntoClaims(output: SmartApplicationOutput): Array<{ text: string; location: string }> {
  const claims: Array<{ text: string; location: string }> = []

  for (const exp of output.resume.sections?.experience || []) {
    for (let i = 0; i < exp.bullets.length; i++) {
      claims.push({ text: exp.bullets[i], location: `experience:${exp.company}/${exp.role}/bullet-${i}` })
    }
  }

  for (const proj of output.resume.sections?.projects || []) {
    for (let i = 0; i < proj.bullets.length; i++) {
      claims.push({ text: proj.bullets[i], location: `project:${proj.title}/bullet-${i}` })
    }
  }

  if (output.resume.sections?.summary) {
    claims.push({ text: output.resume.sections.summary, location: 'summary' })
  }

  if (output.coverLetter) {
    claims.push({ text: output.coverLetter, location: 'cover-letter' })
  }

  return claims
}

function claimContainsMetric(claim: string): boolean {
  return METRIC_REGEX.test(claim)
}

function findMetricInProfile(metric: string, profile: CareerProfile): ClaimProvenance | null {
  for (const exp of profile.experiences) {
    for (const a of exp.achievements) {
      if (a.toLowerCase().includes(metric)) {
        return { claim: metric, sourceType: 'experience', sourceId: exp._id, field: 'achievements' }
      }
    }
    for (const m of exp.metrics) {
      if (m.toLowerCase().includes(metric)) {
        return { claim: metric, sourceType: 'experience', sourceId: exp._id, field: 'metrics' }
      }
    }
    for (const r of exp.responsibilities) {
      if (r.toLowerCase().includes(metric)) {
        return { claim: metric, sourceType: 'experience', sourceId: exp._id, field: 'responsibilities' }
      }
    }
  }
  return null
}

function findCompanyInProfile(company: string, profile: CareerProfile): ClaimProvenance | null {
  for (const exp of profile.experiences) {
    if (exp.company.toLowerCase() === company.toLowerCase()) {
      return { claim: company, sourceType: 'experience', sourceId: exp._id, field: 'company' }
    }
  }
  return null
}

function findProjectInProfile(title: string, profile: CareerProfile): ClaimProvenance | null {
  for (const proj of profile.projects) {
    if (proj.title.toLowerCase() === title.toLowerCase()) {
      return { claim: title, sourceType: 'project', sourceId: proj._id, field: 'title' }
    }
  }
  return null
}

function findSkillInProfile(skill: string, profile: CareerProfile): boolean {
  const lower = skill.toLowerCase()
  for (const s of profile.skills) {
    if (s.name.toLowerCase() === lower) return true
  }
  for (const exp of profile.experiences) {
    if (exp.technologies.some(t => t.toLowerCase() === lower)) return true
  }
  for (const proj of profile.projects) {
    if (proj.technologies.some(t => t.toLowerCase() === lower)) return true
  }
  return false
}

export function validateTruth(
  output: SmartApplicationOutput,
  profile: CareerProfile,
): TruthGateResult {
  const verified: ClaimProvenance[] = []
  const unverifiable: UnverifiableClaim[] = []
  let stripped = false

  // Skip if profile has no data
  if (!profile.experiences.length && !profile.projects.length && !profile.skills.length) {
    return { passed: false, verified, unverifiable, stripped: false }
  }

  const claims = splitIntoClaims(output)

  for (const { text, location } of claims) {
    // Check 1: Metrics in claims must be traceable to profile
    if (claimContainsMetric(text)) {
      const percentages = extractPercentages(text)
      for (const pct of percentages) {
        const found = findMetricInProfile(pct, profile)
        if (!found) {
          unverifiable.push({ claim: pct, location, reason: `Metric '${pct}' not found in profile experience achievements/metrics` })
        } else {
          verified.push(found)
        }
      }
    }

    // Check 2: Company references in experience bullets must match profile
    for (const exp of output.resume.sections?.experience || []) {
      if (text.toLowerCase().includes(exp.company.toLowerCase()) && !findCompanyInProfile(exp.company, profile)) {
        unverifiable.push({
          claim: `Company: ${exp.company}`,
          location: `experience:${exp.company}`,
          reason: `Company '${exp.company}' not found in profile experiences`,
        })
      }
    }

    // Check 3: Project titles must exist in profile
    for (const proj of output.resume.sections?.projects || []) {
      if (!findProjectInProfile(proj.title, profile)) {
        unverifiable.push({
          claim: `Project: ${proj.title}`,
          location: `project:${proj.title}`,
          reason: `Project '${proj.title}' not found in profile projects`,
        })
      }
    }
  }

  // Check 4: All technologies in the output must be in profile
  const allOutputTechs = new Set<string>()
  for (const exp of output.resume.sections?.experience || []) {
    for (const bullet of exp.bullets) {
      extractTechnologies(bullet).forEach(t => allOutputTechs.add(t))
    }
  }
  for (const proj of output.resume.sections?.projects || []) {
    proj.technologies.forEach(t => allOutputTechs.add(t))
    for (const bullet of proj.bullets) {
      extractTechnologies(bullet).forEach(t => allOutputTechs.add(t))
    }
  }
  for (const skillCat of output.resume.sections?.skills || []) {
    skillCat.items.forEach(t => allOutputTechs.add(t))
  }

  const knownTechs = new Set(profile.skills.map(s => s.name.toLowerCase()))
  for (const exp of profile.experiences) {
    exp.technologies.forEach(t => knownTechs.add(t.toLowerCase()))
  }
  for (const proj of profile.projects) {
    proj.technologies.forEach(t => knownTechs.add(t.toLowerCase()))
  }

  for (const tech of allOutputTechs) {
    if (!knownTechs.has(tech.toLowerCase()) && !findSkillInProfile(tech, profile)) {
      unverifiable.push({
        claim: `Technology: ${tech}`,
        location: 'skills/technologies',
        reason: `Technology '${tech}' not found in profile skills, experience technologies, or project technologies`,
      })
    }
  }

  return {
    passed: unverifiable.length === 0,
    verified,
    unverifiable,
    stripped,
  }
}

export function stripUnverifiableClaims(
  output: SmartApplicationOutput,
  unverifiable: UnverifiableClaim[],
): SmartApplicationOutput {
  if (unverifiable.length === 0) return output

  const outputCopy: SmartApplicationOutput = JSON.parse(JSON.stringify(output))

  for (const issue of unverifiable) {
    if (issue.location.startsWith('experience:')) {
      const parts = issue.location.split('/')
      if (parts.length >= 2) {
        const company = parts[0].replace('experience:', '')
        for (const exp of outputCopy.resume.sections?.experience || []) {
          if (exp.company === company && issue.location.includes('bullet')) {
            const bulletIdx = parseInt(issue.location.split('bullet-')[1], 10)
            if (!isNaN(bulletIdx) && exp.bullets[bulletIdx]) {
              exp.bullets.splice(bulletIdx, 1)
            }
          }
        }
      }
    }
  }

  return outputCopy
}
