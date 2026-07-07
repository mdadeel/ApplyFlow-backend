// Community Routes
//
// Mounted at /api/v1/community by backend/src/index.ts
//
// Endpoints:
//   GET    /templates
//   GET    /templates/:id
//   POST   /templates
//   POST   /templates/:id/like
//   POST   /templates/:id/download
//   GET    /referrals
//   POST   /referrals
//   POST   /referrals/:id/claim
//   GET    /posts
//   POST   /posts
//   POST   /posts/:id/like

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import {
  templateCreateSchema,
  referralCreateSchema,
  postCreateSchema,
  listTemplates,
  getTemplate,
  createTemplate,
  likeTemplate,
  downloadTemplate,
  listReferrals,
  createReferralRequest,
  claimReferral,
  getReferralMatches,
  acceptReferral,
  withdrawReferral,
  completeReferral,
  listPosts,
  createPost,
  likePost,
  getFeed,
} from './communityService'

const router = Router()

const listTemplatesQuerySchema = z.object({
  tag: z.string().optional(),
  type: z.enum(['resume', 'cover_letter', 'email']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

const listReferralsQuerySchema = z.object({
  company: z.string().optional(),
  status: z.enum(['open', 'claimed', 'matched', 'accepted', 'completed', 'withdrawn', 'closed', 'expired']).optional(),
  opportunityId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

const listPostsQuerySchema = z.object({
  category: z.enum(['interview', 'career', 'salary', 'tools', 'general']).optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

const claimSchema = z.object({
  note: z.string().max(5000).optional(),
})

// ---------- Templates ----------

router.get('/templates', sessionGuard, async (req: Request, res: Response) => {
  const parsed = listTemplatesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid query: ' + parsed.error.message)
  }
  const templates = await listTemplates(parsed.data)
  sendSuccess(res, templates)
})

router.get('/templates/:id', sessionGuard, async (req: Request, res: Response) => {
  try {
    const template = await getTemplate(String(req.params.id), req.userId!)
    sendSuccess(res, template)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Template not found')
  }
})

router.post('/templates', sessionGuard, async (req: Request, res: Response) => {
  const parsed = templateCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  const created = await createTemplate(parsed.data, req.userId!)
  sendSuccess(res, created, 201)
})

router.post('/templates/:id/like', sessionGuard, async (req: Request, res: Response) => {
  try {
    const result = await likeTemplate(String(req.params.id), req.userId!)
    sendSuccess(res, result)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Template not found')
  }
})

router.post('/templates/:id/download', sessionGuard, async (req: Request, res: Response) => {
  try {
    const template = await downloadTemplate(String(req.params.id), req.userId!)
    sendSuccess(res, template)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Template not found')
  }
})

// ---------- Referrals ----------

router.get('/referrals', sessionGuard, async (req: Request, res: Response) => {
  const parsed = listReferralsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid query: ' + parsed.error.message)
  }
  const referrals = await listReferrals(parsed.data)
  sendSuccess(res, referrals)
})

router.post('/referrals', sessionGuard, async (req: Request, res: Response) => {
  const parsed = referralCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  const created = await createReferralRequest(parsed.data, req.userId!)
  sendSuccess(res, created, 201)
})

router.post('/referrals/:id/claim', sessionGuard, async (req: Request, res: Response) => {
  const parsed = claimSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  try {
    const updated = await claimReferral(String(req.params.id), req.userId!, parsed.data.note)
    sendSuccess(res, updated)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Referral not found')
  }
})

router.get('/referrals/:id/matches', sessionGuard, async (req: Request, res: Response) => {
  try {
    const matches = await getReferralMatches(String(req.params.id), req.userId!)
    sendSuccess(res, matches)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Referral not found')
  }
})

router.post('/referrals/:id/accept', sessionGuard, async (req: Request, res: Response) => {
  const parsed = z.object({ matchedReferralId: z.string().optional() }).safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  try {
    const updated = await acceptReferral(String(req.params.id), req.userId!, parsed.data.matchedReferralId)
    sendSuccess(res, updated)
  } catch (err) {
    const status = err instanceof Error && err.message.includes('Cannot') ? 400 : 404
    throw new AppError(status, err instanceof Error ? err.message : 'Referral not found')
  }
})

router.put('/referrals/:id/withdraw', sessionGuard, async (req: Request, res: Response) => {
  try {
    const updated = await withdrawReferral(String(req.params.id), req.userId!)
    sendSuccess(res, updated)
  } catch (err) {
    const status = err instanceof Error && err.message.includes('Not authorized') ? 403 : 400
    throw new AppError(status, err instanceof Error ? err.message : 'Referral not found')
  }
})

router.put('/referrals/:id/complete', sessionGuard, async (req: Request, res: Response) => {
  try {
    const updated = await completeReferral(String(req.params.id), req.userId!)
    sendSuccess(res, updated)
  } catch (err) {
    const status = err instanceof Error && err.message.includes('Can only') ? 400 : 404
    throw new AppError(status, err instanceof Error ? err.message : 'Referral not found')
  }
})

// ---------- Feed ----------

const feedQuerySchema = z.object({
  tab: z.enum(['for-you', 'trending', 'my-activity']).optional().default('for-you'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

router.get('/feed', sessionGuard, async (req: Request, res: Response) => {
  const parsed = feedQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid query: ' + parsed.error.message)
  }

  const feed = await getFeed({ ...parsed.data, userId: req.userId! })
  sendSuccess(res, feed)
})

// ---------- Posts ----------

router.get('/posts', sessionGuard, async (req: Request, res: Response) => {
  const parsed = listPostsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid query: ' + parsed.error.message)
  }
  const posts = await listPosts(parsed.data)
  sendSuccess(res, posts)
})

router.post('/posts', sessionGuard, async (req: Request, res: Response) => {
  const parsed = postCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  const created = await createPost(parsed.data, req.userId!)
  sendSuccess(res, created, 201)
})

router.post('/posts/:id/like', sessionGuard, async (req: Request, res: Response) => {
  try {
    const result = await likePost(String(req.params.id), req.userId!)
    sendSuccess(res, result)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Post not found')
  }
})

export default router
