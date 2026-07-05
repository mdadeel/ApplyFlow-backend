import { Router, Request, Response } from 'express'
import { Experience } from '../../models/Experience'
import { Project } from '../../models/Project'
import { Skill } from '../../models/Skill'
import { sessionGuard } from '../identity/sessionGuard'
import { analyzeSkillOverlap } from './skillOverlapAnalyzer'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import { generateStrategySchema } from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

router.post('/strategy', validate(generateStrategySchema), async (req: Request, res: Response) => {
  const { jdKeywords = [], requiredSkills = [] } = req.body
  const [experiences, projects, skills] = await Promise.all([
    Experience.find({ userId: req.userId }),
    Project.find({ userId: req.userId }),
    Skill.find({ userId: req.userId }),
  ])
  const allKeywords = [...new Set([...jdKeywords, ...requiredSkills])]
  const scoredExp = analyzeSkillOverlap(experiences, allKeywords)
  const scoredProj = analyzeSkillOverlap(projects, allKeywords)
  const selectedExpIds = scoredExp.filter(s => s.score > 0).map(s => s.id)
  const selectedProjIds = scoredProj.filter(s => s.score > 0).map(s => s.id)
  const excludedExp = scoredExp.filter(s => s.score === 0).map(s => ({ id: s.id, reason: 'No skill overlap with job description' }))
  const excludedProj = scoredProj.filter(s => s.score === 0).map(s => ({ id: s.id, reason: 'No technology match for this role' }))
  const matchedSkills = skills.filter(s => allKeywords.some(k => s.name.toLowerCase().includes(k.toLowerCase())))
  const strategy = {
    selectedExperienceIds: selectedExpIds,
    selectedProjectIds: selectedProjIds,
    excludedItems: [...excludedExp, ...excludedProj],
    ordering: {
      experiences: scoredExp.map(s => s.id),
      projects: scoredProj.map(s => s.id),
    },
    matchedSkills: matchedSkills.map(s => s.name),
    reasoning: {
      ...Object.fromEntries(scoredExp.map(s => [s.id, `Score: ${s.score}% - matched ${s.matchedKeywords.join(', ')}`])),
      ...Object.fromEntries(scoredProj.map(s => [s.id, `Score: ${s.score}% - matched ${s.matchedKeywords.join(', ')}`])),
    },
  }
  sendSuccess(res, strategy)
})

export default router
