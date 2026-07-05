import { Router, Request, Response } from 'express'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import {
  generateEmailSchema,
  generateCoverLetterSchema,
  humanizeTextSchema,
} from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

router.post('/email', validate(generateEmailSchema), async (req: Request, res: Response) => {
  const { jdAnalysis, profile, tone = 'professional' } = req.body
  const ai = getAIProvider()
  const email = await ai.generateEmail(jdAnalysis, profile || {}, tone)
  sendSuccess(res, { subject: email.subject, content: email.body })
})

router.post('/cover-letter', validate(generateCoverLetterSchema), async (req: Request, res: Response) => {
  const { jdAnalysis, profile } = req.body
  const ai = getAIProvider()
  const body = await ai.generateCoverLetter(jdAnalysis, profile || {})
  sendSuccess(res, { content: body })
})

router.post('/humanize', validate(humanizeTextSchema), async (req: Request, res: Response) => {
  const { text } = req.body
  const ai = getAIProvider()
  const result = await ai.validateHumanization(text)
  const refinedText =
    (result as { text?: string }).text ??
    (result.issues && result.issues.length > 0
      ? `${text}\n\n[Note: ${result.issues.length} humanization issue(s) detected.]`
      : text)
  sendSuccess(res, { text: refinedText })
})

export default router
