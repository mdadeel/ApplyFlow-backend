import { z } from 'zod'
import { Opportunity } from '../../models/Opportunity'

export const createOpportunitySchema = z.object({
  title: z.string().min(3).max(200),
  company: z.string().min(1).max(200),
  location: z.string().max(200).optional(),
  locationType: z.enum(['remote', 'hybrid', 'onsite', 'unspecified']).optional(),
  description: z.string().min(10).max(50000),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  salaryCurrency: z.string().max(3).optional(),
  salaryInterval: z.enum(['yearly', 'monthly', 'hourly', 'unspecified']).optional(),
  roleLevel: z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'executive']).optional(),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'temporary']).optional(),
  requiredSkills: z.array(z.string().min(1).max(50)).max(50).optional(),
  preferredSkills: z.array(z.string().min(1).max(50)).max(50).optional(),
  minExperience: z.number().min(0).optional(),
  education: z.string().max(200).optional(),
  source: z.enum(['url', 'manual', 'email', 'pdf', 'screenshot', 'linkedin', 'career_page']),
  sourceUrl: z.string().url().max(2000).optional(),
  rawText: z.string().max(50000).optional(),
  deadline: z.coerce.date().optional(),
})

export const updateOpportunitySchema = createOpportunitySchema.partial()

export const searchOpportunitiesQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  locationType: z.enum(['remote', 'hybrid', 'onsite', 'unspecified']).optional(),
  roleLevel: z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'executive']).optional(),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'temporary']).optional(),
  skill: z.string().optional(),
  company: z.string().optional(),
  sort: z.enum(['relevance', 'newest', 'deadline']).default('relevance'),
  deadlineSoon: z.coerce.boolean().optional(),
})

export async function searchOpportunities(query: z.infer<typeof searchOpportunitiesQuerySchema>) {
  const filter: Record<string, unknown> = {
    isArchived: false,
    pipelineStatus: 'completed',
  }

  filter.$text = { $search: query.q }

  if (query.locationType) filter.locationType = query.locationType
  if (query.roleLevel) filter.roleLevel = query.roleLevel
  if (query.employmentType) filter.employmentType = query.employmentType
  if (query.skill) filter.requiredSkills = { $in: [query.skill] }
  if (query.company) filter.company = { $regex: query.company, $options: 'i' }
  if (query.deadlineSoon) {
    filter.isExpired = false
    filter.deadline = { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), $gte: new Date() }
  }

  let sort: Record<string, 1 | -1 | { $meta: string }> = { score: { $meta: 'textScore' } }
  if (query.sort === 'newest') sort = { createdAt: -1 }
  if (query.sort === 'deadline') sort = { deadline: 1 }

  const skip = (query.page - 1) * query.limit
  const projection = { score: { $meta: 'textScore' } }

  const [results, total] = await Promise.all([
    Opportunity.find(filter, projection)
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Opportunity.countDocuments(filter),
  ])

  return { results, total, page: query.page, totalPages: Math.ceil(total / query.limit) }
}

export async function searchFilters() {
  const [companies, allSkills, locationTypes, roleLevels] = await Promise.all([
    Opportunity.distinct('company', { isArchived: false }),
    Opportunity.distinct('requiredSkills', { isArchived: false }),
    Opportunity.distinct('locationType', { isArchived: false }),
    Opportunity.distinct('roleLevel', { isArchived: false }),
  ])

  return { companies, skills: allSkills, locationTypes, roleLevels }
}

export async function searchSuggestions(q: string) {
  const suggestions = await Opportunity.find(
    {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } },
        { requiredSkills: { $regex: q, $options: 'i' } },
      ],
      isArchived: false,
    },
    { score: { $meta: 'textScore' } },
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(10)
    .lean()

  const seen = new Set<string>()
  const tokens: string[] = []
  for (const s of suggestions) {
    for (const field of [s.title, s.company, ...s.requiredSkills]) {
      if (field && !seen.has(field)) {
        seen.add(field)
        tokens.push(field)
      }
    }
  }

  return tokens.slice(0, 10)
}

export const listOpportunitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  locationType: z.enum(['remote', 'hybrid', 'onsite', 'unspecified']).optional(),
  roleLevel: z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'executive']).optional(),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'temporary']).optional(),
  skill: z.string().optional(),
  company: z.string().optional(),
  minMatchScore: z.coerce.number().min(0).max(1).optional(),
  sort: z.enum(['newest', 'match', 'deadline']).default('newest'),
  deadlineSoon: z.coerce.boolean().optional(),
})

export async function listOpportunities(query: z.infer<typeof listOpportunitiesQuerySchema>) {
  const filter: Record<string, unknown> = {
    isArchived: false,
    pipelineStatus: 'completed',
  }

  if (query.locationType) filter.locationType = query.locationType
  if (query.roleLevel) filter.roleLevel = query.roleLevel
  if (query.employmentType) filter.employmentType = query.employmentType
  if (query.skill) filter.requiredSkills = { $in: [query.skill] }
  if (query.company) filter.company = { $regex: query.company, $options: 'i' }
  if (query.deadlineSoon) {
    filter.isExpired = false
    filter.deadline = { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), $gte: new Date() }
  }

  let sort: Record<string, 1 | -1> = { createdAt: -1 }
  if (query.sort === 'deadline') sort = { deadline: 1 }
  if (query.sort === 'match') sort = { averageMatchScore: -1, createdAt: -1 }

  const skip = (query.page - 1) * query.limit
  const [results, total] = await Promise.all([
    Opportunity.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
    Opportunity.countDocuments(filter),
  ])

  return { results, total, page: query.page, totalPages: Math.ceil(total / query.limit) }
}

export async function getOpportunity(id: string) {
  const opportunity = await Opportunity.findById(id)
  if (!opportunity) throw new Error('Opportunity not found')
  return opportunity
}

export async function createOpportunity(input: z.infer<typeof createOpportunitySchema>, userId: string) {
  const opportunity = new Opportunity({
    ...input,
    createdBy: userId,
  })
  return opportunity.save()
}

export async function updateOpportunity(id: string, input: Record<string, unknown>, userId: string) {
  const opportunity = await Opportunity.findOne({ _id: id, createdBy: userId })
  if (!opportunity) throw new Error('Opportunity not found or not authorized')
  Object.assign(opportunity, input)
  return opportunity.save()
}

export async function archiveOpportunity(id: string, userId: string) {
  const opportunity = await Opportunity.findOne({ _id: id, createdBy: userId })
  if (!opportunity) throw new Error('Opportunity not found or not authorized')
  opportunity.isArchived = true
  return opportunity.save()
}

export async function listReviewQueue() {
  return Opportunity.find({ pipelineStatus: 'review_needed' })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
}
