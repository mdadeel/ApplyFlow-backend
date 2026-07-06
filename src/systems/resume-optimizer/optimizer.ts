import type { SmartApplicationOutput } from '../smart-application/types'
import type { CareerProfile } from '../career-data/profileService'
import { prioritizeSkillsByRole, type JobContext } from './dynamicOrdering'
import { enforceMetricsPolicy } from '../document-validation/metricsPolicy'

const DUPLICATE_TECH_THRESHOLD = 3

function detectDuplicateTechnologies(output: SmartApplicationOutput): string[] {
  const techCounts = new Map<string, number>()

  for (const exp of output.resume.sections?.experience || []) {
    for (const bullet of exp.bullets) {
      const words = bullet.split(/\s+/)
      for (const w of words) {
        const clean = w.replace(/[,.]/g, '')
        if (clean[0] === clean[0]?.toUpperCase() && clean.length > 2) {
          techCounts.set(clean.toLowerCase(), (techCounts.get(clean.toLowerCase()) || 0) + 1)
        }
      }
    }
  }

  return [...techCounts.entries()]
    .filter(([, count]) => count >= DUPLICATE_TECH_THRESHOLD)
    .map(([tech]) => tech)
}

function generateImprovedBullets(bullets: string[], technologies: string[]): string[] {
  const ACTION_VERBS = [
    'Built', 'Designed', 'Created', 'Developed', 'Implemented', 'Architected',
    'Led', 'Managed', 'Delivered', 'Shipped', 'Improved', 'Optimized',
    'Reduced', 'Automated', 'Migrated', 'Transformed', 'Modernized', 'Refactored',
    'Launched', 'Deployed', 'Integrated', 'Established', 'Mentored', 'Trained',
    'Analyzed', 'Researched', 'Evaluated', 'Wrote', 'Tested', 'Validated',
  ]

  const USED_PATTERNS = [/^with\s+/i, /^responsible\s+for\s+/i, /^involved\s+in\s+/i, /^worked\s+on\s+/i]

  const usedVerbs = new Set<string>()

  return bullets.map((bullet, i) => {
    let improved = bullet.trim()

    for (const pattern of USED_PATTERNS) {
      improved = improved.replace(pattern, '')
    }

    const firstWord = improved.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '')
    if (!firstWord || firstWord[0] !== firstWord[0]?.toUpperCase()) {
      const verb = ACTION_VERBS[i % ACTION_VERBS.length]
      improved = `${verb} ${improved[0]?.toLowerCase() + improved.slice(1)}`
      usedVerbs.add(verb)
    }

    improved = improved.replace(/\s+/g, ' ').trim()
    if (!improved.endsWith('.')) improved += '.'

    return improved
  })
}

export function optimizeResume(
  output: SmartApplicationOutput,
  profile: CareerProfile,
): SmartApplicationOutput {
  let optimized = JSON.parse(JSON.stringify(output)) as SmartApplicationOutput

  const jobContext: JobContext = {
    role: output.analysis.role,
    requiredSkills: output.analysis.requiredSkills,
    preferredSkills: output.analysis.preferredSkills,
    responsibilities: output.analysis.responsibilities,
    keywords: output.analysis.keywords,
    employmentType: output.analysis.employmentType,
    experienceLevel: output.analysis.experienceLevel,
  }

  if (optimized.resume.sections?.experience) {
    optimized.resume.sections.experience = optimized.resume.sections.experience.map(exp => ({
      ...exp,
      bullets: generateImprovedBullets(exp.bullets, exp.technologies || []),
    }))
  }

  const duplicates = detectDuplicateTechnologies(optimized)
  if (duplicates.length > 0 && optimized.resume.sections?.skills) {
    for (const cat of optimized.resume.sections.skills) {
      cat.items = [...new Set(cat.items.map(i => i.toLowerCase()))]
    }
  }

  if (optimized.resume.sections?.skills) {
    optimized.resume.sections.skills = prioritizeSkillsByRole(optimized.resume.sections.skills, jobContext)
  }

  if (optimized.resume.markdown && profile) {
    const { output: metricsCleaned } = enforceMetricsPolicy(optimized, profile)
    optimized = metricsCleaned
  }

  if (optimized.coverLetter) {
    optimized.coverLetter = optimized.coverLetter
      .replace(/\bI am (thrilled|excited|passionate)\b/gi, 'I am')
      .replace(/\bI'm (thrilled|excited|passionate)\b/gi, 'I\'m')
  }

  if (optimized.email.body) {
    optimized.email.body = optimized.email.body
      .replace(/\bI am (thrilled|excited|passionate)\b/gi, 'I am')
      .replace(/\bI'm (thrilled|excited|passionate)\b/gi, 'I\'m')
  }

  let md = optimized.resume.markdown
  md = md.replace(/\bI am (thrilled|excited|passionate)\b/gi, 'I am')
  optimized.resume.markdown = md

  return optimized
}

export function rebuildResumeMarkdown(output: SmartApplicationOutput): string {
  if (!output.resume.sections) return output.resume.markdown

  const lines: string[] = []

  if (output.resume.sections.summary) {
    lines.push(output.resume.sections.summary)
    lines.push('')
  }

  if (output.resume.sections.experience?.length) {
    for (const exp of output.resume.sections.experience) {
      lines.push(`${exp.role} at ${exp.company} (${exp.startDate} - ${exp.endDate})`)
      for (const b of exp.bullets) {
        lines.push(b)
      }
      lines.push('')
    }
  }

  if (output.resume.sections.projects?.length) {
    for (const proj of output.resume.sections.projects) {
      lines.push(`${proj.title}`)
      if (proj.description) lines.push(proj.description)
      for (const b of proj.bullets) {
        lines.push(b)
      }
      lines.push('')
    }
  }

  if (output.resume.sections.skills?.length) {
    for (const cat of output.resume.sections.skills) {
      lines.push(`${cat.category}: ${cat.items.join(', ')}`)
    }
    lines.push('')
  }

  if (output.resume.sections.education?.length) {
    for (const edu of output.resume.sections.education) {
      lines.push(`${edu.degree} - ${edu.institution} (${edu.year})`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}
