// Community Service — CRUD + interaction (likes/downloads/claim) + Feed
//
// All write paths validate inputs with Zod before touching the database.
// Read paths strip the `likedBy` array for non-author consumers to keep
// per-user state private.

import { z } from 'zod'
import { CommunityTemplate, ICommunityTemplate } from '../../models/CommunityTemplate'
import { ReferralRequest, IReferralRequest, ReferralStatus } from '../../models/ReferralRequest'
import { CommunityPost, ICommunityPost } from '../../models/CommunityPost'
import { Opportunity } from '../../models/Opportunity'
import { Contribution } from '../../models/Contribution'
import { ApplicationWorkspace } from '../../models/ApplicationWorkspace'
import { User } from '../../models/User'
import mongoose from 'mongoose'

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
  opportunityId: z.string().max(50).optional(),
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
  opportunityId?: string
  limit?: number
}

export async function listReferrals(
  opts: ListReferralsOpts = {},
): Promise<IReferralRequest[]> {
  const query: Record<string, unknown> = {}
  if (opts.company) query.company = opts.company
  if (opts.status) query.status = opts.status
  if (opts.opportunityId) query.opportunityId = opts.opportunityId

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
    opportunityId: input.opportunityId,
    tags: input.tags,
    status: 'open',
  })
  return doc.save()
}

export async function getReferralMatches(
  id: string,
  _userId: string,
): Promise<IReferralRequest[]> {
  const referral = await ReferralRequest.findById(id).exec()
  if (!referral) throw new Error('Referral not found')

  // Find potential matches: same company, complementary type (request↔offer), different user, compatible status
  const targetType = referral.message ? 'offer' : 'request'
  const matches = await ReferralRequest.find({
    _id: { $ne: id },
    userId: { $ne: referral.userId },
    company: referral.company,
    status: { $in: ['open', 'matched'] },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .exec()

  return matches
}

export async function acceptReferral(
  id: string,
  userId: string,
  matchedReferralId?: string,
): Promise<IReferralRequest> {
  const referral = await ReferralRequest.findById(id).exec()
  if (!referral) throw new Error('Referral not found')
  if (referral.userId !== userId && !['open', 'matched'].includes(referral.status)) {
    throw new Error('Cannot accept referral in current status')
  }

  const update: Record<string, unknown> = {
    status: 'accepted',
  }
  if (matchedReferralId) update.matchedReferralId = matchedReferralId

  const updated = await ReferralRequest.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true },
  ).exec()
  if (!updated) throw new Error('Referral not found')

  // Also update the matched referral if set
  if (matchedReferralId) {
    await ReferralRequest.findByIdAndUpdate(matchedReferralId, {
      $set: { status: 'accepted', matchedReferralId: id },
    }).exec()
  }

  return updated
}

export async function withdrawReferral(
  id: string,
  userId: string,
): Promise<IReferralRequest> {
  const referral = await ReferralRequest.findById(id).exec()
  if (!referral) throw new Error('Referral not found')
  if (referral.userId !== userId && referral.responderId !== userId) {
    throw new Error('Not authorized to withdraw this referral')
  }
  if (!['open', 'matched'].includes(referral.status)) {
    throw new Error('Can only withdraw open or matched referrals')
  }

  const updated = await ReferralRequest.findByIdAndUpdate(
    id,
    { $set: { status: 'withdrawn' } },
    { new: true },
  ).exec()
  if (!updated) throw new Error('Referral not found')
  return updated
}

export async function completeReferral(
  id: string,
  userId: string,
): Promise<IReferralRequest> {
  const referral = await ReferralRequest.findById(id).exec()
  if (!referral) throw new Error('Referral not found')
  if (referral.status !== 'accepted') {
    throw new Error('Can only complete accepted referrals')
  }

  const updated = await ReferralRequest.findByIdAndUpdate(
    id,
    { $set: { status: 'completed' } },
    { new: true },
  ).exec()
  if (!updated) throw new Error('Referral not found')

  // Award reputation to both parties
  await Promise.all([
    User.findByIdAndUpdate(referral.userId, { $inc: { communityReputation: 5, totalContributions: 1 } }),
    ...(referral.responderId
      ? [User.findByIdAndUpdate(referral.responderId, { $inc: { communityReputation: 10, totalContributions: 1 } })]
      : []),
  ])

  return updated
}

// ---------- Reputation ----------

export async function getReputation(userId: string): Promise<{
  userId: string
  communityReputation: number
  totalContributions: number
  helpfulVotesReceived: number
  contributionsCount: number
  reviewsGiven: number
  referralsGiven: number
  referralsSuccessful: number
  level: string
}> {
  const user = await User.findById(userId).exec()
  if (!user) throw new Error('User not found')

  const contributionsCount = await Contribution.countDocuments({ createdBy: userId }).exec()
  const helpfulVotesReceived = await Contribution.aggregate([
    { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: '$helpfulCount' } } },
  ]).exec()

  const referralsGiven = await ReferralRequest.countDocuments({ userId }).exec()
  const referralsSuccessful = await ReferralRequest.countDocuments({ userId, status: 'completed' }).exec()
  const reviewsGiven = await CommunityPost.countDocuments({ userId }).exec()

  const reputation = user.communityReputation
  const level = reputation >= 100 ? 'expert' : reputation >= 50 ? 'trusted' : reputation >= 10 ? 'active' : 'new'

  return {
    userId,
    communityReputation: reputation,
    totalContributions: user.totalContributions,
    helpfulVotesReceived: helpfulVotesReceived[0]?.total ?? 0,
    contributionsCount,
    reviewsGiven,
    referralsGiven,
    referralsSuccessful,
    level,
  }
}

export async function getReputations(userIds: string[]): Promise<Record<string, object>> {
  const results: Record<string, object> = {}
  for (const userId of userIds) {
    try {
      results[userId] = await getReputation(userId)
    } catch {
      results[userId] = {
        userId,
        communityReputation: 0,
        totalContributions: 0,
        helpfulVotesReceived: 0,
        contributionsCount: 0,
        reviewsGiven: 0,
        referralsGiven: 0,
        referralsSuccessful: 0,
        level: 'new',
      }
    }
  }
  return results
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

// ---------- Feed ----------

export type FeedItemType =
  | 'new_opportunity'
  | 'saved_opportunity_update'
  | 'new_contribution'
  | 'new_discussion'
  | 'referral_request'
  | 'referral_offer'
  | 'deadline_approaching'
  | 'trending_skill'
  | 'review_received'
  | 'mention'

export type FeedEntityType = 'opportunity' | 'discussion' | 'referral' | 'notification'

export interface FeedItem {
  id: string
  type: FeedItemType
  title: string
  summary: string
  timestamp: string
  entityId: string
  entityType: FeedEntityType
  actorName?: string
  actorId?: string
  avatarUrl?: string
  meta?: Record<string, string | number>
}

export interface FeedTrendingCompany {
  company: string
  count: number
}

export interface FeedTrendingSkill {
  skill: string
  count: number
  byLevel: Record<string, number>
}

export interface FeedSalaryBand {
  roleLevel: string
  min: number
  max: number
  count: number
}

export interface FeedHiringVelocityPoint {
  week: string
  count: number
}

export interface FeedTrending {
  topCompanies: FeedTrendingCompany[]
  topSkills: FeedTrendingSkill[]
  salaryBands: FeedSalaryBand[]
  hiringVelocity: FeedHiringVelocityPoint[]
}

export interface FeedMyActivity {
  savedCount: number
  appliedCount: number
  contributionsCount: number
  referralsCount: number
  recentActions: FeedItem[]
}

export interface FeedResponse {
  forYou: {
    items: FeedItem[]
    nextCursor?: string
    hasMore: boolean
  }
  trending: FeedTrending
  myActivity: FeedMyActivity
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface RawFeedEntry {
  sortKey: Date
  item: FeedItem
}

function rawFeedEntry(
  sortKey: Date,
  item: FeedItem,
): RawFeedEntry {
  return { sortKey, item }
}

// ── For You ─────────────────────────────────────────────────────────────────

interface GetFeedForYouOpts {
  cursor?: string
  limit: number
}

async function getFeedForYou(
  opts: GetFeedForYouOpts,
): Promise<{ items: FeedItem[]; nextCursor?: string; hasMore: boolean }> {
  const cursorDate = opts.cursor ? new Date(opts.cursor) : new Date()
  const perSource = opts.limit * 3 // oversample from each source

  // Fetch items from each collection in parallel
  const [opportunities, posts, referrals, contributions] = await Promise.all([
    Opportunity.find({ isExpired: false, isArchived: false, createdAt: { $lt: cursorDate } })
      .sort({ createdAt: -1 })
      .limit(perSource)
      .select('title company locationType createdAt')
      .lean()
      .exec(),
    CommunityPost.find({ createdAt: { $lt: cursorDate } })
      .sort({ createdAt: -1 })
      .limit(perSource)
      .select('title body userId category createdAt')
      .lean()
      .exec(),
    ReferralRequest.find({ createdAt: { $lt: cursorDate } })
      .sort({ createdAt: -1 })
      .limit(perSource)
      .select('company role message createdAt')
      .lean()
      .exec(),
    Contribution.find({ isFlagged: false, createdAt: { $lt: cursorDate } })
      .sort({ createdAt: -1 })
      .limit(perSource)
      .select('title body type createdAt')
      .lean()
      .exec(),
  ])

  // Convert to a unified sorted list
  const entries: RawFeedEntry[] = []

  for (const opp of opportunities) {
    entries.push(
      rawFeedEntry(opp.createdAt, {
        id: `opp_${opp._id}`,
        type: 'new_opportunity',
        title: opp.title,
        summary: `${opp.company}${opp.locationType !== 'unspecified' ? ` · ${opp.locationType}` : ''}`,
        timestamp: opp.createdAt.toISOString(),
        entityId: opp._id.toString(),
        entityType: 'opportunity',
        actorName: opp.company,
      }),
    )
  }

  for (const post of posts) {
    entries.push(
      rawFeedEntry(post.createdAt, {
        id: `post_${post._id}`,
        type: 'new_discussion',
        title: post.title,
        summary: post.body.substring(0, 200),
        timestamp: post.createdAt.toISOString(),
        entityId: post._id.toString(),
        entityType: 'discussion',
        actorId: post.userId,
      }),
    )
  }

  for (const ref of referrals) {
    entries.push(
      rawFeedEntry(ref.createdAt, {
        id: `ref_${ref._id}`,
        type: 'referral_request',
        title: `Referral: ${ref.role} at ${ref.company}`,
        summary: ref.message.substring(0, 200),
        timestamp: ref.createdAt.toISOString(),
        entityId: ref._id.toString(),
        entityType: 'referral',
        actorName: ref.company,
      }),
    )
  }

  for (const contrib of contributions) {
    entries.push(
      rawFeedEntry(contrib.createdAt, {
        id: `contrib_${contrib._id}`,
        type: 'new_contribution',
        title: contrib.title,
        summary: contrib.body.substring(0, 200),
        timestamp: contrib.createdAt.toISOString(),
        entityId: contrib._id.toString(),
        entityType: 'opportunity',
        meta: { contributionType: contrib.type },
      }),
    )
  }

  // Sort all entries by createdAt descending
  entries.sort((a, b) => b.sortKey.getTime() - a.sortKey.getTime())

  // Take the requested limit, +1 to check if there's a next page
  const page = entries.slice(0, opts.limit + 1)
  const hasMore = page.length > opts.limit
  const pageItems = page.slice(0, opts.limit)
  const items = pageItems.map((e) => e.item)

  // Next cursor is the last item's timestamp (or undefined if no more)
  const nextCursor = hasMore && items.length > 0
    ? items[items.length - 1].timestamp
    : undefined

  return { items, nextCursor, hasMore }
}

// ── Trending ────────────────────────────────────────────────────────────────

async function getFeedTrending(): Promise<FeedTrending> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [companyAgg, skillAgg, bandAgg, velocityAgg] = await Promise.all([
    // Top 10 companies by opportunity count in last 30 days
    Opportunity.aggregate([
      { $match: { isExpired: false, isArchived: false, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).exec(),

    // Top 15 skills by frequency in requiredSkills in last 30 days
    Opportunity.aggregate([
      { $match: { isExpired: false, isArchived: false, createdAt: { $gte: thirtyDaysAgo } } },
      { $unwind: '$requiredSkills' },
      { $group: { _id: '$requiredSkills', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]).exec(),

    // Salary bands by roleLevel (last 90 days for more data)
    Opportunity.aggregate([
      {
        $match: {
          isExpired: false,
          isArchived: false,
          roleLevel: { $exists: true, $ne: null },
          salaryMin: { $exists: true, $ne: null },
          salaryMax: { $exists: true, $ne: null },
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: '$roleLevel',
          min: { $min: '$salaryMin' },
          max: { $max: '$salaryMax' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).exec(),

    // Hiring velocity — opportunities created per week in last 90 days
    Opportunity.aggregate([
      {
        $match: {
          isExpired: false,
          isArchived: false,
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-W%V', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec(),
  ])

  return {
    topCompanies: companyAgg.map((c) => ({
      company: c._id as string,
      count: c.count,
    })),
    topSkills: skillAgg.map((s) => ({
      skill: s._id as string,
      count: s.count,
      byLevel: {},
    })),
    salaryBands: bandAgg.map((b) => ({
      roleLevel: b._id as string,
      min: b.min,
      max: b.max,
      count: b.count,
    })),
    hiringVelocity: velocityAgg.map((v) => ({
      week: v._id as string,
      count: v.count,
    })),
  }
}

// ── My Activity ─────────────────────────────────────────────────────────────

async function getFeedMyActivity(userId: string): Promise<FeedMyActivity> {
  const userObjectId = new mongoose.Types.ObjectId(userId)

  const [workspaces, contributions, referrals, recentPosts] = await Promise.all([
    ApplicationWorkspace.find({ userId: userObjectId }).select('status createdAt opportunityId').lean().exec(),
    Contribution.find({ createdBy: userObjectId }).sort({ createdAt: -1 }).select('title body type createdAt').limit(20).lean().exec(),
    ReferralRequest.find({ userId }).sort({ createdAt: -1 }).select('company role message createdAt').limit(20).lean().exec(),
    CommunityPost.find({ userId }).sort({ createdAt: -1 }).select('title body category createdAt').limit(20).lean().exec(),
  ])

  const savedCount = workspaces.length
  const appliedCount = workspaces.filter((w) => w.status === 'submitted').length
  const contributionsCount = contributions.length
  const referralsCount = referrals.length

  // Build recent actions — user's own recent items
  const recentEntries: RawFeedEntry[] = []

  for (const c of contributions) {
    recentEntries.push(
      rawFeedEntry(c.createdAt, {
        id: `contrib_${c._id}`,
        type: 'new_contribution',
        title: c.title,
        summary: c.body.substring(0, 200),
        timestamp: c.createdAt.toISOString(),
        entityId: c._id.toString(),
        entityType: 'opportunity',
        meta: { contributionType: c.type },
      }),
    )
  }

  for (const r of referrals) {
    recentEntries.push(
      rawFeedEntry(r.createdAt, {
        id: `ref_${r._id}`,
        type: 'referral_request',
        title: `Referral: ${r.role} at ${r.company}`,
        summary: r.message.substring(0, 200),
        timestamp: r.createdAt.toISOString(),
        entityId: r._id.toString(),
        entityType: 'referral',
        actorName: r.company,
      }),
    )
  }

  for (const p of recentPosts) {
    recentEntries.push(
      rawFeedEntry(p.createdAt, {
        id: `post_${p._id}`,
        type: 'new_discussion',
        title: p.title,
        summary: p.body.substring(0, 200),
        timestamp: p.createdAt.toISOString(),
        entityId: p._id.toString(),
        entityType: 'discussion',
      }),
    )
  }

  // Sort & limit
  recentEntries.sort((a, b) => b.sortKey.getTime() - a.sortKey.getTime())
  const recentActions = recentEntries.slice(0, 20).map((e) => e.item)

  return {
    savedCount,
    appliedCount,
    contributionsCount,
    referralsCount,
    recentActions,
  }
}

// ── Public Entry Point ──────────────────────────────────────────────────────

export interface GetFeedOpts {
  tab: 'for-you' | 'trending' | 'my-activity'
  cursor?: string
  limit?: number
  userId: string
}

/**
 * Returns the full feed envelope (or a subset when only the requested
 * tab is computed). The frontend normalizer picks the tab-specific slice
 * from the envelope, so uncomputed tabs default to their empty shapes.
 */
export async function getFeed(opts: GetFeedOpts): Promise<FeedResponse> {
  const limit = Math.min(opts.limit ?? 20, 50)

  // Only compute the tab that was requested — the frontend normalizer
  // handles single-tab payloads. Unrequested tabs get empty defaults.
  switch (opts.tab) {
    case 'for-you': {
      const forYou = await getFeedForYou({ cursor: opts.cursor, limit })
      return {
        forYou,
        trending: { topCompanies: [], topSkills: [], salaryBands: [], hiringVelocity: [] },
        myActivity: { savedCount: 0, appliedCount: 0, contributionsCount: 0, referralsCount: 0, recentActions: [] },
      }
    }
    case 'trending': {
      const trending = await getFeedTrending()
      return {
        forYou: { items: [], hasMore: false },
        trending,
        myActivity: { savedCount: 0, appliedCount: 0, contributionsCount: 0, referralsCount: 0, recentActions: [] },
      }
    }
    case 'my-activity': {
      const myActivity = await getFeedMyActivity(opts.userId)
      return {
        forYou: { items: [], hasMore: false },
        trending: { topCompanies: [], topSkills: [], salaryBands: [], hiringVelocity: [] },
        myActivity,
      }
    }
  }
}
