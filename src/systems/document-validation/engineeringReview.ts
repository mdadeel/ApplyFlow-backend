import type { SmartApplicationOutput } from '../smart-application/types'

/**
 * @deprecated This validator is unused in the current pipeline.
 * Kept for reference; will be removed in a future cleanup pass.
 * Use engine/validation/validators/ if re-adding to the pipeline.
 */
export interface EngineeringFeedback {
  category: string
  severity: 'error' | 'warning' | 'info'
  message: string
}
export interface EngineeringReviewReport {
  passed: boolean
  issues: EngineeringFeedback[]
}

/** @deprecated */
const SKILL_INFLATION_RED_FLAGS = [
  'architected', 'designed', 'led', 'managed', 'owned',
]

const WEAK_TECH_DESCRIPTORS = [
  'proficient in', 'experience with', 'knowledge of', 'familiar with',
]

export function engineeringReview(output: SmartApplicationOutput): EngineeringReviewReport {
  const issues: EngineeringFeedback[] = []

  const skillInflation = detectSkillInflation(output)
  issues.push(...skillInflation)

  const techMisuse = detectTechnologyMisuse(output)
  issues.push(...techMisuse)

  const weakArchitecture = detectWeakArchitecture(output)
  issues.push(...weakArchitecture)

  const weakProjects = detectWeakProjects(output)
  issues.push(...weakProjects)

  const duplicateSkills = detectDuplicateSkills(output)
  issues.push(...duplicateSkills)

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  }
}

/** @deprecated */
function detectSkillInflation(output: SmartApplicationOutput): EngineeringFeedback[] {
  const feedback: EngineeringFeedback[] = []

  for (const exp of output.resume.sections?.experience || []) {
    for (const bullet of exp.bullets) {
      for (const flag of SKILL_INFLATION_RED_FLAGS) {
        if (bullet.toLowerCase().startsWith(flag)) {
          const duration = getTenureYears(exp.startDate, exp.endDate)
          if (duration < 1) {
            const roleLabel = `${exp.role}@${exp.company}`
            feedback.push({
              category: 'Skill Inflation',
              severity: 'warning',
              message: `"${flag}" in ${roleLabel} (${duration.toFixed(1)}yr tenure) — ${flag} implies seniority inconsistent with tenure`,
            })
          }
        }
      }
    }
  }

  return feedback
}

function detectTechnologyMisuse(output: SmartApplicationOutput): EngineeringFeedback[] {
  const feedback: EngineeringFeedback[] = []

  const techMismatches: Array<[string, RegExp, string]> = [
    ['React Native', /react\s+native/i, 'React Native' as string],
    ['Next.js', /next(\.js)?\s+ssr/, 'Next.js SSR' as string],
  ]

  for (const exp of output.resume.sections?.experience || []) {
    for (const [tech, pattern] of techMismatches) {
      for (const bullet of exp.bullets) {
        if (pattern.test(bullet) && !exp.technologies?.some(t => t.toLowerCase().includes(tech.toLowerCase()))) {
          feedback.push({
            category: 'Technology Misuse',
            severity: 'warning',
            message: `"${bullet.substring(0, 60)}" mentions ${tech} but experience doesn't list it in technologies`,
          })
        }
      }
    }
  }

  return feedback
}

function detectWeakArchitecture(output: SmartApplicationOutput): EngineeringFeedback[] {
  const feedback: EngineeringFeedback[] = []

  const weakTerms = [
    /\b(?:simple|basic|easy)\s+(?:app|application|system|platform|solution)\b/i,
    /\bjust\s+(?:a|an)\s+(?:simple|basic)\b/i,
    /\b(?:nothing|not)\s+(?:complex|complicated|fancy)\b/i,
  ]

  for (const exp of output.resume.sections?.experience || []) {
    for (const bullet of exp.bullets) {
      for (const pattern of weakTerms) {
        if (pattern.test(bullet)) {
          feedback.push({
            category: 'Weak Architecture',
            severity: 'warning',
            message: `Bullet downplays complexity: "${bullet.substring(0, 60)}..."`,
          })
        }
      }
    }
  }

  return feedback
}

function detectWeakProjects(output: SmartApplicationOutput): EngineeringFeedback[] {
  const feedback: EngineeringFeedback[] = []

  const vagueProjectLang = [
    /\b(?:simple|basic|tutorial|demo|sample|example)\s+(?:project|app|application)\b/i,
    /\bbuilt\s+(?:a|an)\s+(?:simple|basic)\b/i,
  ]

  for (const proj of output.resume.sections?.projects || []) {
    for (const pattern of vagueProjectLang) {
      if (pattern.test(proj.description)) {
        feedback.push({
          category: 'Weak Project',
          severity: 'warning',
          message: `"${proj.title}" described as simple — use concrete technical terms`,
        })
      }
    }
  }

  return feedback
}

function detectDuplicateSkills(output: SmartApplicationOutput): EngineeringFeedback[] {
  const feedback: EngineeringFeedback[] = []
  const allSkills = new Set<string>()

  for (const cat of output.resume.sections?.skills || []) {
    cat.items.forEach(s => allSkills.add(s.toLowerCase()))
  }

  const skillCount = allSkills.size
  if (skillCount > 20) {
    feedback.push({
      category: 'Duplicate Skills',
      severity: 'warning',
      message: `${skillCount} unique skills listed — consider trimming to top 15 most relevant`,
    })
  }

  return feedback
}

function getTenureYears(startDate: string, endDate: string | undefined): number {
  if (!startDate || !endDate) return 2
  const start = new Date(startDate)
  const end = endDate.toLowerCase() === 'present' ? new Date() : new Date(endDate)
  return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
}
