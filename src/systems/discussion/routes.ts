import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { Discussion } from '../../models/Discussion'
import { DiscussionReply } from '../../models/DiscussionReply'
import mongoose from 'mongoose'

const router = Router()

const DISCUSSION_CHANNELS = [
  'resume-review',
  'interview-experience',
  'referral',
  'career-question',
  'success-story',
  'general',
] as const

const listQuerySchema = z.object({
  channel: z.enum(DISCUSSION_CHANNELS).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

const createSchema = z.object({
  channel: z.enum(DISCUSSION_CHANNELS),
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(20000),
})

const createReplySchema = z.object({
  body: z.string().min(2).max(5000),
})

router.get('/', sessionGuard, async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid query: ' + parsed.error.message)
  }

  const { channel, page, limit } = parsed.data
  const query: Record<string, unknown> = {}
  if (channel) query.channel = channel

  const skip = (page - 1) * limit
  const [discussions, total] = await Promise.all([
    Discussion.find(query).sort({ isPinned: -1, createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
    Discussion.countDocuments(query).exec(),
  ])

  sendSuccess(res, {
    items: discussions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
})

router.get('/:id', sessionGuard, async (req: Request, res: Response) => {
  const id = req.params.id as string
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'Invalid discussion id')
  }

  const discussion = await Discussion.findById(id).lean().exec()
  if (!discussion) {
    throw new AppError(404, 'Discussion not found')
  }

  const replies = await DiscussionReply.find({ discussionId: discussion._id })
    .sort({ createdAt: 1 })
    .lean()
    .exec()

  sendSuccess(res, { discussion, replies })
})

router.post('/', sessionGuard, async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }

  const doc = new Discussion({
    channel: parsed.data.channel,
    authorId: req.userId,
    title: parsed.data.title,
    body: parsed.data.body,
  })
  const created = await doc.save()
  sendSuccess(res, created.toObject(), 201)
})

router.post('/:id/replies', sessionGuard, async (req: Request, res: Response) => {
  const id = req.params.id as string
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'Invalid discussion id')
  }

  const parsed = createReplySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }

  const discussion = await Discussion.findById(id).exec()
  if (!discussion) {
    throw new AppError(404, 'Discussion not found')
  }

  const reply = new DiscussionReply({
    discussionId: discussion._id,
    authorId: req.userId,
    body: parsed.data.body,
  })
  await reply.save()

  discussion.replyCount += 1
  await discussion.save()

  sendSuccess(res, reply.toObject(), 201)
})

export default router
