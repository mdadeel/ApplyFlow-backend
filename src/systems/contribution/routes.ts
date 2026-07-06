import { Router, Request, Response } from 'express'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import {
  createContributionSchema,
  listContributionsQuerySchema,
  listContributions,
  createContribution,
  deleteContribution,
  toggleHelpful,
} from './contributionService'

const router = Router({ mergeParams: true })

router.get('/', sessionGuard, async (req: Request, res: Response) => {
  const parsed = listContributionsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid query: ' + parsed.error.message)
  }
  const contributions = await listContributions(String(req.params.opportunityId), parsed.data)
  sendSuccess(res, contributions)
})

router.post('/', sessionGuard, async (req: Request, res: Response) => {
  const parsed = createContributionSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  const created = await createContribution(String(req.params.opportunityId), parsed.data, req.userId!)
  sendSuccess(res, created, 201)
})

router.delete('/:contributionId', sessionGuard, async (req: Request, res: Response) => {
  try {
    const result = await deleteContribution(String(req.params.contributionId), req.userId!)
    sendSuccess(res, result)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Contribution not found')
  }
})

router.post('/:contributionId/helpful', sessionGuard, async (req: Request, res: Response) => {
  try {
    const result = await toggleHelpful(String(req.params.contributionId), req.userId!)
    sendSuccess(res, result)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Contribution not found')
  }
})

export default router
