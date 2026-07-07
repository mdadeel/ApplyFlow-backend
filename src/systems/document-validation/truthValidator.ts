import { Experience } from '../../models/Experience'
import { Project } from '../../models/Project'
import { Skill } from '../../models/Skill'
import { IValidatorResult } from '../../models/ValidationReport'

export async function validateTruthAgainstDb(
  userId: string,
  content: { experiences: any[]; projects: any[]; skills: string[] },
): Promise<IValidatorResult> {
  const issues: IValidatorResult['issues'] = []
  const [dbExperiences, dbProjects, dbSkills] = await Promise.all([
    Experience.find({ userId }),
    Project.find({ userId }),
    Skill.find({ userId }),
  ])
  const dbCompanies = new Set(dbExperiences.map(e => e.company.toLowerCase()))
  const dbTitles = new Set(dbProjects.map(p => p.title.toLowerCase()))
  const dbSkillNames = new Set(dbSkills.map(s => s.name.toLowerCase()))
  for (const exp of content.experiences || []) {
    if (exp.company && !dbCompanies.has(exp.company.toLowerCase())) {
      issues.push({ severity: 'warning', message: `Experience at "${exp.company}" not found in profile`, location: `experience:${exp.company}` })
    }
  }
  for (const proj of content.projects || []) {
    if (proj.title && !dbTitles.has(proj.title.toLowerCase())) {
      issues.push({ severity: 'warning', message: `Project "${proj.title}" not found in profile`, location: `project:${proj.title}` })
    }
  }
  for (const skill of content.skills || []) {
    const name = skill.replace(/\s*\(.*\)$/, '').trim().toLowerCase()
    if (name && !dbSkillNames.has(name)) {
      issues.push({ severity: 'warning', message: `Skill "${skill}" not found in profile`, location: `skill:${skill}` })
    }
  }
  const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 10)
  return { name: 'Truth', score, passed: score >= 80, issues }
}
