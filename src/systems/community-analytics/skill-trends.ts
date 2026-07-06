import { Opportunity } from '../../models/Opportunity'

export async function getSkillTrends(limit = 10) {
  const opportunities = await Opportunity.find({ pipelineStatus: 'completed' })
    .select('requiredSkills preferredSkills roleLevel company createdAt')
    .lean()

  const skillCounts: Record<string, { count: number; byLevel: Record<string, number>; byCompany: Record<string, number> }> = {}

  for (const opp of opportunities) {
    const allSkills = [...(opp.requiredSkills || []), ...(opp.preferredSkills || [])]

    for (const skill of allSkills) {
      if (!skillCounts[skill]) {
        skillCounts[skill] = { count: 0, byLevel: {}, byCompany: {} }
      }
      skillCounts[skill].count++

      if (opp.roleLevel) {
        skillCounts[skill].byLevel[opp.roleLevel] = (skillCounts[skill].byLevel[opp.roleLevel] || 0) + 1
      }
      if (opp.company) {
        skillCounts[skill].byCompany[opp.company] = (skillCounts[skill].byCompany[opp.company] || 0) + 1
      }
    }
  }

  const topSkills = Object.entries(skillCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, limit)
    .map(([skill, data]) => ({ skill, count: data.count, byLevel: data.byLevel, byCompany: data.byCompany }))

  return { topSkills, totalOpportunities: opportunities.length }
}
