import { Opportunity } from '../../models/Opportunity'
import { Contribution } from '../../models/Contribution'
import { ApplicationWorkspace } from '../../models/ApplicationWorkspace'
import { MatchResult } from '../../models/MatchResult'
import { User } from '../../models/User'

let cache: CommunityDashboard | null = null
let cacheTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000

export interface CommunityDashboard {
  totalOpportunities: number
  totalContributions: number
  activeUsers: number
  averageMatchScore: number
  topCompanies: { company: string; count: number }[]
  trendingSkills: { skill: string; count: number }[]
  lastUpdated: string
}

export async function getDashboard(): Promise<CommunityDashboard> {
  const now = Date.now()
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache

  const [
    totalOpportunities,
    totalContributions,
    activeUsers,
    matchResults,
    opportunities,
  ] = await Promise.all([
    Opportunity.countDocuments({ pipelineStatus: 'completed' }),
    Contribution.countDocuments(),
    User.countDocuments({ lastActiveAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } }),
    MatchResult.aggregate([
      { $group: { _id: null, avg: { $avg: '$overallScore' } } },
    ]),
    Opportunity.find({ pipelineStatus: 'completed' })
      .select('company requiredSkills preferredSkills')
      .lean(),
  ])

  const averageMatchScore = matchResults[0]?.avg || 0

  const companyCounts: Record<string, number> = {}
  const skillCounts: Record<string, number> = {}

  for (const opp of opportunities) {
    if (opp.company) companyCounts[opp.company] = (companyCounts[opp.company] || 0) + 1
    for (const s of opp.requiredSkills || []) skillCounts[s] = (skillCounts[s] || 0) + 1
    for (const s of opp.preferredSkills || []) skillCounts[s] = (skillCounts[s] || 0) + 1
  }

  const topCompanies = Object.entries(companyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([company, count]) => ({ company, count }))

  const trendingSkills = Object.entries(skillCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, count }))

  cache = { totalOpportunities, totalContributions, activeUsers, averageMatchScore, topCompanies, trendingSkills, lastUpdated: new Date().toISOString() }
  cacheTime = now

  return cache
}
