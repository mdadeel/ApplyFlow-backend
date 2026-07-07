import { Router, Request, Response } from 'express'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { getReputation, getReputations } from '../community/communityService'

const router = Router()

router.get('/reputation/:userId', sessionGuard, async (req: Request, res: Response) => {
  try {
    const reputation = await getReputation(String(req.params.userId))
    sendSuccess(res, reputation)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'User not found')
  }
})

router.get('/reputation', sessionGuard, async (req: Request, res: Response) => {
  const userIdsStr = String(req.query.userIds || '')
  const userIds = userIdsStr ? userIdsStr.split(',').filter(Boolean) : []
  const reputations = await getReputations(userIds)
  sendSuccess(res, reputations)
})

export default router
