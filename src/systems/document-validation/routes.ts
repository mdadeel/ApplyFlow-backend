import { Router, Request, Response } from 'express'
import { ResumeVersion } from '../../models/ResumeVersion'
import { ValidationReport } from '../../models/ValidationReport'
import { JDAnalysis } from '../../models/JDAnalysis'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { validateATS } from './atsValidator'
import { validateTruth } from './truthValidator'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import { validateResumeSchema } from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

router.post('/', validate(validateResumeSchema), async (req: Request, res: Response) => {
  const { resumeVersionId } = req.body
  const version = await ResumeVersion.findOne({ _id: resumeVersionId, userId: req.userId })
  if (!version) throw new AppError(404, 'Resume version not found')
  const jdAnalysis = version.strategySnapshot?.jdAnalysisId
    ? await JDAnalysis.findById(version.strategySnapshot.jdAnalysisId)
    : null
  const jdKeywords = (jdAnalysis?.keywords || version.strategySnapshot?.jdKeywords || [])
  const ai = getAIProvider()
  const allText = [version.content.summary, ...version.content.experiences.map(e => JSON.stringify(e))].join(' ')
  const results = await Promise.all([
    Promise.resolve(validateATS(version.content, jdKeywords)),
    Promise.resolve(ai.validateHumanization(allText).then(r => ({ name: 'Humanization', ...r } as any))),
    Promise.resolve(ai.validateRecruiter(allText).then(r => ({ name: 'Recruiter', ...r } as any))),
    Promise.resolve(ai.checkGrammar(allText).then(r => ({ name: 'Grammar', ...r } as any))),
    validateTruth(req.userId, version.content),
  ])
  const blocking = ['ATS', 'Truth', 'Grammar']
  const blocked = results.some(r => blocking.includes(r.name) && !r.passed)
  const overallPassed = results.every(r => r.passed)
  const report = await ValidationReport.create({
    userId: req.userId,
    applicationId: version.applicationId,
    resumeVersionId,
    results,
    overallPassed,
    blocked,
  })
  sendSuccess(res, report, 201)
})

export default router
