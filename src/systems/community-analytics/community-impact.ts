import { Contribution } from '../../models/Contribution'
import { MatchResult } from '../../models/MatchResult'

export async function getCommunityImpact() {
  const contributions = await Contribution.find().populate('opportunityId', 'matchCount averageMatchScore').lean()

  const byType: Record<string, { count: number; total: number }> = {}

  for (const c of contributions) {
    byType[c.type] = byType[c.type] || { count: 0, total: 0 }
    byType[c.type].count++
    byType[c.type].total++
  }

  const totalContributions = contributions.length
  const mostValuable = Object.entries(byType)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([type, data]) => ({ type, count: data.count }))

  return {
    totalContributions,
    byType,
    mostValuable,
  }
}
