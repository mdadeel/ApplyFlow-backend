import { Router, Request, Response } from 'express'
import { sessionGuard } from '../identity/sessionGuard'
import { sendSuccess } from '../../utils/response'
import { getSuccessRateAnalytics } from './success-rate'
import { getCommunityImpact } from './community-impact'
import { getSkillTrends } from './skill-trends'
import { getDashboard } from './dashboard'

const router = Router()
router.use(sessionGuard)

router.get('/dashboard', async (_req: Request, res: Response) => {
  const data = await getDashboard()
  sendSuccess(res, data)
})

router.get('/success-rate', async (req: Request, res: Response) => {
  const data = await getSuccessRateAnalytics({
    roleLevel: req.query.roleLevel as string,
    company: req.query.company as string,
    days: req.query.days ? Number(req.query.days) : undefined,
  })
  sendSuccess(res, data)
})

router.get('/community-impact', async (_req: Request, res: Response) => {
  const data = await getCommunityImpact()
  sendSuccess(res, data)
})

router.get('/skill-trends', async (req: Request, res: Response) => {
  const data = await getSkillTrends(req.query.limit ? Number(req.query.limit) : 10)
  sendSuccess(res, data)
})

export default router
