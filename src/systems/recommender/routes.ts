import { Router, Request, Response } from 'express'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { recommendForUser, getStoredMatches, matchSingle } from './engine'

const router = Router()

router.get('/recommendations', sessionGuard, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const results = await recommendForUser(req.userId!, limit)
  sendSuccess(res, results)
})

router.get('/matches', sessionGuard, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const results = await getStoredMatches(req.userId!, limit)
  sendSuccess(res, results)
})

router.post('/match/:opportunityId', sessionGuard, async (req: Request, res: Response) => {
  try {
    const result = await matchSingle(req.userId!, String(req.params.opportunityId))
    sendSuccess(res, result)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Not found')
  }
})

export default router
