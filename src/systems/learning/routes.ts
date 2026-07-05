import { Router, Request, Response } from 'express'
import { LearningData } from '../../models/LearningData'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import { feedbackSchema } from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

async function getOrCreate(userId: string) {
  let data = await LearningData.findOne({ userId })
  if (!data) data = await LearningData.create({ userId })
  return data
}

router.get('/preferences', async (req: Request, res: Response) => {
  const data = await getOrCreate(req.userId)
  sendSuccess(res, {
    preferredVerbs: Object.fromEntries(data.preferredVerbs || new Map()),
    removedPhrases: data.removedPhrases || [],
    shorterSummaries: data.shorterSummaries,
  })
})

router.post('/feedback', validate(feedbackSchema), async (req: Request, res: Response) => {
  const { section, original, edited } = req.body
  const data = await getOrCreate(req.userId)
  data.editHistory.push({ section, original, edited, timestamp: new Date() })
  const origVerbs = original.toLowerCase().split(' ').filter((w: string) => w.endsWith('ed'))
  const editVerbs = edited.toLowerCase().split(' ').filter((w: string) => w.endsWith('ed'))
  for (const v of editVerbs) {
    if (!data.preferredVerbs) data.preferredVerbs = new Map()
    data.preferredVerbs.set(v, (data.preferredVerbs.get(v) || 0) + 1)
  }
  const removed = origVerbs.filter((v: string) => !editVerbs.includes(v) && (data.preferredVerbs?.get(v) || 0) < 2)
  if (!data.removedPhrases) data.removedPhrases = []
  for (const v of removed) {
    if (!data.removedPhrases.includes(v)) data.removedPhrases.push(v)
  }
  if (edited.length < original.length * 0.6) data.shorterSummaries = true
  await data.save()
  sendSuccess(res, { ok: true })
})

export default router
