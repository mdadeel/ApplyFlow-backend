import { z } from 'zod'
import { Contribution } from '../../models/Contribution'
import { Opportunity } from '../../models/Opportunity'

export const createContributionSchema = z.object({
  type: z.enum([
    'interview_experience',
    'salary_info',
    'recruiter_contact',
    'referral_offer',
    'hiring_status',
    'application_tip',
    'scam_report',
    'company_insight',
    'general',
  ]),
  title: z.string().min(10).max(200),
  body: z.string().min(10).max(10000),
  isAnonymous: z.boolean().optional(),
  structuredData: z.record(z.unknown()).optional(),
})

export const listContributionsQuerySchema = z.object({
  type: z
    .enum([
      'interview_experience',
      'salary_info',
      'recruiter_contact',
      'referral_offer',
      'hiring_status',
      'application_tip',
      'scam_report',
      'company_insight',
      'general',
    ])
    .optional(),
  sort: z.enum(['recent', 'helpful']).default('recent'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function listContributions(
  opportunityId: string,
  query: z.infer<typeof listContributionsQuerySchema>,
) {
  const filter: Record<string, unknown> = { opportunityId, isFlagged: false }
  if (query.type) filter.type = query.type

  let sort: Record<string, 1 | -1> = { createdAt: -1 }
  if (query.sort === 'helpful') sort = { helpfulCount: -1, createdAt: -1 }

  const results = await Contribution.find(filter)
    .sort(sort)
    .limit(query.limit)
    .populate('createdBy', 'name communityReputation')
    .lean()

  return results
}

export async function createContribution(
  opportunityId: string,
  input: z.infer<typeof createContributionSchema>,
  userId: string,
) {
  const opportunity = await Opportunity.findById(opportunityId)
  if (!opportunity) throw new Error('Opportunity not found')

  const contribution = new Contribution({
    opportunityId,
    ...input,
    createdBy: userId,
  })

  await contribution.save()

  await Opportunity.findByIdAndUpdate(opportunityId, { $inc: { totalContributions: 1 } })

  return contribution
}

export async function deleteContribution(id: string, userId: string) {
  const contribution = await Contribution.findOneAndDelete({ _id: id, createdBy: userId })
  if (!contribution) throw new Error('Contribution not found or not authorized')

  await Opportunity.findByIdAndUpdate(contribution.opportunityId, {
    $inc: { totalContributions: -1 },
  })

  return contribution
}

export async function toggleHelpful(id: string, userId: string) {
  const contribution = await Contribution.findById(id)
  if (!contribution) throw new Error('Contribution not found')

  const userIdStr = String(userId)
  const alreadyHelpful = contribution.helpfulBy.some((id) => String(id) === userIdStr)

  if (alreadyHelpful) {
    contribution.helpfulBy = contribution.helpfulBy.filter((id) => String(id) !== userIdStr)
    contribution.helpfulCount = Math.max(0, contribution.helpfulCount - 1)
  } else {
    contribution.helpfulBy.push(userIdStr)
    contribution.helpfulCount += 1
  }

  await contribution.save()
  return { contribution, helpful: !alreadyHelpful }
}
