import { Router, Request, Response } from 'express'
import { Experience } from '../../models/Experience'
import { Project } from '../../models/Project'
import { Skill } from '../../models/Skill'
import { Education } from '../../models/Education'
import { Certificate } from '../../models/Certificate'
import { ResumeVersion } from '../../models/ResumeVersion'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import { generateResumeSchema } from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

router.post('/', validate(generateResumeSchema), async (req: Request, res: Response) => {
  const { applicationId, strategy, template = 'modern' } = req.body
  const [experiences, projects, skills, education, certificates] = await Promise.all([
    Experience.find({ userId: req.userId }),
    Project.find({ userId: req.userId }),
    Skill.find({ userId: req.userId }),
    Education.find({ userId: req.userId }),
    Certificate.find({ userId: req.userId }),
  ])
  const selectedExpIds = (strategy?.selectedExperienceIds || experiences.map(e => e._id.toString())).map(String)
  const selectedProjIds = (strategy?.selectedProjectIds || projects.map(p => p._id.toString())).map(String)
  const selectedExps = experiences.filter(e => selectedExpIds.includes(e._id.toString()))
  const selectedProjs = projects.filter(p => selectedProjIds.includes(p._id.toString()))
  const ai = getAIProvider()
  const summary = await ai.generateSummary(req.body.profile || {}, req.body.jdAnalysis || {})
  const optimizedExps = await ai.optimizeBullets(selectedExps, req.body.jdKeywords || [])
  const prevVersion = await ResumeVersion.findOne({ applicationId, userId: req.userId }).sort({ version: -1 })
  const version = (prevVersion?.version || 0) + 1
  const resume = await ResumeVersion.create({
    userId: req.userId,
    applicationId,
    version,
    strategySnapshot: strategy || {},
    content: {
      summary,
      experiences: optimizedExps.map(e => ({
        company: e.company, role: e.role,
        startDate: e.startDate, endDate: e.endDate,
        current: e.current, responsibilities: e.responsibilities,
        technologies: e.technologies,
      })),
      projects: selectedProjs.map(p => ({
        title: p.title, description: p.description,
        technologies: p.technologies, features: p.features,
      })),
      skills: skills.map(s => `${s.name} (${s.level})`),
      education: education.map(e => ({
        degree: e.degree, institution: e.institution,
        startDate: e.startDate, endDate: e.endDate, result: e.result,
      })),
      certificates: certificates.map(c => ({
        name: c.name, issuer: c.issuer, date: c.date, url: c.url,
      })),
    },
    template,
  })
  sendSuccess(res, resume, 201)
})

export default router
