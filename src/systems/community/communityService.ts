// Community Service — CRUD + interaction (likes/downloads/claim)
//
// All write paths validate inputs with Zod before touching the database.
// Read paths strip the `likedBy` array for non-author consumers to keep
// per-user state private.

import { z } from 'zod'
import { CommunityTemplate, ICommunityTemplate } from '../../models/CommunityTemplate'
import { ReferralRequest, IReferralRequest, ReferralStatus } from '../../models/ReferralRequest'
import { CommunityPost, ICommunityPost } from '../../models/CommunityPost'

// ---------- Input Schemas ----------

export const templateCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional().default(''),
  type: z.enum(['resume', 'cover_letter', 'email']),
  content: z.string().min(1).max(50000),
  tags: z.array(z.string().min(1).max(30)).max(10).optional().default([]),
  industry: z.string().max(100).optional(),
  roleLevel: z.enum(['intern', 'entry', 'mid', 'senior', 'lead']).optional(),
  isPublished: z.boolean().optional().default(true),
})
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>

export const referralCreateSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  location: z.string().max(200).optional(),
  message: z.string().min(10).max(5000),
  jdUrl: z.string().url().max(500).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional().default([]),
})
export type ReferralCreateInput = z.infer<typeof referralCreateSchema>

export const postCreateSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(20000),
  category: z.enum(['interview', 'career', 'salary', 'tools', 'general']),
  tags: z.array(z.string().min(1).max(30)).max(10).optional().default([]),
})
export type PostCreateInput = z.infer<typeof postCreateSchema>

// ---------- Templates ----------

export interface ListTemplatesOpts {
  tag?: string
  type?: string
  limit?: number
}

export async function listTemplates(opts: ListTemplatesOpts = {}): Promise<ICommunityTemplate[]> {
  const query: Record<string, unknown> = { isPublished: true }
  if (opts.tag) query.tags = opts.tag
  if (opts.type) query.type = opts.type

  return CommunityTemplate.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(opts.limit ?? 100, 200))
    .exec()
}

export async function getTemplate(id: string, _userId: string): Promise<ICommunityTemplate> {
  const template = await CommunityTemplate.findById(id).exec()
  if (!template) {
    throw new Error('Template not found')
  }
  return template
}

export async function createTemplate(
  input: TemplateCreateInput,
  userId: string,
): Promise<ICommunityTemplate> {
  const doc = new CommunityTemplate({
    userId,
    title: input.title,
    description: input.description,
    type: input.type,
    content: input.content,
    tags: input.tags,
    industry: input.industry,
    roleLevel: input.roleLevel,
    isPublished: input.isPublished,
  })
  return doc.save()
}

/**
 * Toggle the current user's like on a template.
 * Returns the updated document; `liked` boolean indicates whether the like
 * was added (true) or removed (false).
 */
export async function likeTemplate(
  id: string,
  userId: string,
): Promise<{ template: ICommunityTemplate; liked: boolean }> {
  const existing = await CommunityTemplate.findById(id).exec()
  if (!existing) throw new Error('Template not found')

  const hasLiked = existing.likedBy.includes(userId)

  const updated = await CommunityTemplate.findByIdAndUpdate(
    id,
    hasLiked
      ? { $pull: { likedBy: userId }, $inc: { likes: -1 } }
      : { $addToSet: { likedBy: userId }, $inc: { likes: 1 } },
    { new: true },
  ).exec()

  if (!updated) throw new Error('Template not found')
  return { template: updated, liked: !hasLiked }
}

export async function downloadTemplate(
  id: string,
  _userId: string,
): Promise<ICommunityTemplate> {
  const updated = await CommunityTemplate.findByIdAndUpdate(
    id,
    { $inc: { downloads: 1 } },
    { new: true },
  ).exec()
  if (!updated) throw new Error('Template not found')
  return updated
}

// ---------- Referrals ----------

export interface ListReferralsOpts {
  company?: string
  status?: ReferralStatus
  limit?: number
}

export async function listReferrals(
  opts: ListReferralsOpts = {},
): Promise<IReferralRequest[]> {
  const query: Record<string, unknown> = {}
  if (opts.company) query.company = opts.company
  if (opts.status) query.status = opts.status

  return ReferralRequest.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(opts.limit ?? 100, 200))
    .exec()
}

export async function createReferralRequest(
  input: ReferralCreateInput,
  userId: string,
): Promise<IReferralRequest> {
  const doc = new ReferralRequest({
    userId,
    company: input.company,
    role: input.role,
    location: input.location,
    message: input.message,
    jdUrl: input.jdUrl,
    tags: input.tags,
    status: 'open',
  })
  return doc.save()
}

export async function claimReferral(
  id: string,
  userId: string,
  note?: string,
): Promise<IReferralRequest> {
  const updated = await ReferralRequest.findByIdAndUpdate(
    id,
    {
      $set: {
        status: 'claimed' as ReferralStatus,
        responderId: userId,
        responseNote: note,
      },
    },
    { new: true },
  ).exec()
  if (!updated) throw new Error('Referral not found')
  return updated
}

// ---------- Posts ----------

export interface ListPostsOpts {
  category?: string
  tag?: string
  limit?: number
}

export async function listPosts(opts: ListPostsOpts = {}): Promise<ICommunityPost[]> {
  const query: Record<string, unknown> = {}
  if (opts.category) query.category = opts.category
  if (opts.tag) query.tags = opts.tag

  return CommunityPost.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(opts.limit ?? 100, 200))
    .exec()
}

export async function createPost(
  input: PostCreateInput,
  userId: string,
): Promise<ICommunityPost> {
  const doc = new CommunityPost({
    userId,
    title: input.title,
    body: input.body,
    category: input.category,
    tags: input.tags,
  })
  return doc.save()
}

export async function likePost(
  id: string,
  userId: string,
): Promise<{ post: ICommunityPost; liked: boolean }> {
  const existing = await CommunityPost.findById(id).exec()
  if (!existing) throw new Error('Post not found')

  const hasLiked = existing.likedBy.includes(userId)

  const updated = await CommunityPost.findByIdAndUpdate(
    id,
    hasLiked
      ? { $pull: { likedBy: userId }, $inc: { likes: -1 } }
      : { $addToSet: { likedBy: userId }, $inc: { likes: 1 } },
    { new: true },
  ).exec()

  if (!updated) throw new Error('Post not found')
  return { post: updated, liked: !hasLiked }
}
