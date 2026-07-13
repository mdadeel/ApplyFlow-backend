import { Router, Request, Response } from 'express'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { apifyLimiter } from '../../middleware/rateLimit'
import { User } from '../../models/User'
import { scrapeAndAddToFeed } from '../../services/apifyScraper'
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  listOpportunitiesQuerySchema,
  searchOpportunitiesQuerySchema,
  listOpportunities,
  searchOpportunities,
  searchFilters,
  searchSuggestions,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  archiveOpportunity,
  listReviewQueue,
} from './opportunityService'

const router = Router()

router.get('/search/filters', sessionGuard, async (_req: Request, res: Response) => {
  const filters = await searchFilters()
  sendSuccess(res, filters)
})

router.get('/search/suggestions', sessionGuard, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim()
  if (!q) { sendSuccess(res, []); return }
  const suggestions = await searchSuggestions(q)
  sendSuccess(res, suggestions)
})

router.get('/search', sessionGuard, async (req: Request, res: Response) => {
  const parsed = searchOpportunitiesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid query: ' + parsed.error.message)
  }
  const result = await searchOpportunities(parsed.data)
  sendSuccess(res, result)
})

router.get('/', sessionGuard, async (req: Request, res: Response) => {
  const parsed = listOpportunitiesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid query: ' + parsed.error.message)
  }
  const result = await listOpportunities(parsed.data)
  sendSuccess(res, result)
})

router.get('/review-queue', sessionGuard, async (_req: Request, res: Response) => {
  const queue = await listReviewQueue()
  sendSuccess(res, queue)
})

router.get('/:id', sessionGuard, async (req: Request, res: Response) => {
  try {
    const opportunity = await getOpportunity(String(req.params.id))
    sendSuccess(res, opportunity)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Opportunity not found')
  }
})

router.post('/', sessionGuard, async (req: Request, res: Response) => {
  const parsed = createOpportunitySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  const created = await createOpportunity(parsed.data, req.userId!)
  sendSuccess(res, created, 201)
})

router.put('/:id', sessionGuard, async (req: Request, res: Response) => {
  const parsed = updateOpportunitySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  try {
    const updated = await updateOpportunity(String(req.params.id), parsed.data, req.userId!)
    sendSuccess(res, updated)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Opportunity not found')
  }
})

router.delete('/:id', sessionGuard, async (req: Request, res: Response) => {
  try {
    const archived = await archiveOpportunity(String(req.params.id), req.userId!)
    sendSuccess(res, archived)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Opportunity not found')
  }
})

/**
 * POST /api/opportunities/scrape-matches
 *
 * Triggers an Apify LinkedIn scrape derived from the authenticated user's
 * profile (preferredRoles, skills, location, openToRemote). Returns 202
 * immediately; results become visible in the feed once the ingestion worker
 * processes the newly created 'pending' Opportunity records (~30–90 s).
 */
router.post('/scrape-matches', sessionGuard, apifyLimiter, async (req: Request, res: Response) => {
  const userId = req.userId!

  const user = await User.findById(userId)
  if (!user) throw new AppError(404, 'User not found')

  // Fire-and-forget — client does not wait for the Apify actor to finish
  scrapeAndAddToFeed(userId, user).catch((err: Error) => {
    // Logged inside the service; nothing to surface to the client at this point
    console.error(`[scrape-matches] background scrape failed for user ${userId}: ${err.message}`)
  })

  sendSuccess(res, {
    message: 'Job scrape started. New opportunities will appear in your feed within 1–2 minutes.',
  }, 202)
})

export default router
