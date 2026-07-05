import { Router, Request, Response } from 'express'
import { InterviewPrep } from '../../models/InterviewPrep'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import {
  generateInterviewPrepSchema,
  generateStarSchema,
  saveAnswerSchema,
  markPracticedSchema,
} from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

router.post('/generate', validate(generateInterviewPrepSchema), async (req: Request, res: Response) => {
  const { applicationId, jdAnalysis, profile } = req.body
  const ai = getAIProvider()
  const questions = await ai.generateQuestions(jdAnalysis || {}, profile || {})
  const talkingPoints = await ai.generateTalkingPoints(jdAnalysis || {}, profile || {})
  const companyResearch = await ai.researchCompany(jdAnalysis?.company || 'the company')
  const prep = await InterviewPrep.create({
    userId: req.userId,
    applicationId,
    questions,
    companyResearch,
    talkingPoints,
    starAnswers: [],
    weakAreas: [],
  })
  sendSuccess(res, prep, 201)
})

router.post('/star', validate(generateStarSchema), async (req: Request, res: Response) => {
  const { experience, question } = req.body
  const ai = getAIProvider()
  const star = await ai.buildStar(experience, question)
  sendSuccess(res, { star })
})

router.get('/:applicationId', async (req: Request, res: Response) => {
  const prep = await InterviewPrep.findOne({ applicationId: req.params.applicationId, userId: req.userId })
  if (!prep) throw new AppError(404, 'Interview prep not found')
  sendSuccess(res, prep)
})

router.put('/:applicationId/answer', validate(saveAnswerSchema), async (req: Request, res: Response) => {
  const { questionId, answer } = req.body
  const prep = await InterviewPrep.findOne({ applicationId: req.params.applicationId, userId: req.userId })
  if (!prep) throw new AppError(404, 'Interview prep not found')

  const existing = prep.answers?.find((a) => a.questionId === questionId)
  if (existing) {
    existing.answer = answer
  } else {
    if (!prep.answers) prep.answers = []
    prep.answers.push({ questionId, answer, practiced: false })
  }
  await prep.save()
  sendSuccess(res, prep)
})

router.post('/:applicationId/practice', validate(markPracticedSchema), async (req: Request, res: Response) => {
  const { questionId, practiced } = req.body
  const prep = await InterviewPrep.findOne({ applicationId: req.params.applicationId, userId: req.userId })
  if (!prep) throw new AppError(404, 'Interview prep not found')

  const existing = prep.answers?.find((a) => a.questionId === questionId)
  if (existing) {
    existing.practiced = practiced
  } else {
    if (!prep.answers) prep.answers = []
    prep.answers.push({ questionId, answer: '', practiced })
  }
  await prep.save()
  sendSuccess(res, prep)
})

router.get('/:applicationId/research', async (req: Request, res: Response) => {
  const prep = await InterviewPrep.findOne({ applicationId: req.params.applicationId, userId: req.userId })
  if (!prep) throw new AppError(404, 'Interview prep not found')

  const app = await import('../../models/Application').then((m) => m.Application.findOne({ _id: req.params.applicationId, userId: req.userId }))
  const company = app?.company ?? 'the company'
  const ai = getAIProvider()
  const research = await ai.researchCompany(company)
  prep.companyResearch = research
  await prep.save()
  sendSuccess(res, { companyResearch: research })
})

export default router
