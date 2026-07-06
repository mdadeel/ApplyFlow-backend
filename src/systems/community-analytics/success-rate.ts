import { ApplicationWorkspace } from '../../models/ApplicationWorkspace'
import { Opportunity } from '../../models/Opportunity'

export async function getSuccessRateAnalytics(
  filters?: { roleLevel?: string; company?: string; days?: number },
) {
  const match: Record<string, any> = { status: 'submitted' }
  if (filters?.days) {
    match.updatedAt = { $gte: new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000) }
  }

  const workspaces = await ApplicationWorkspace.find(match)
    .populate('opportunityId', 'roleLevel company title')
    .lean()

  const opps = workspaces.filter(w => w.opportunityId && typeof w.opportunityId === 'object')
  const total = opps.length

  const byRoleLevel: Record<string, { count: number }> = {}
  const byCompany: Record<string, { count: number }> = {}

  for (const w of opps) {
    const opp: any = w.opportunityId
    if (opp.roleLevel) {
      byRoleLevel[opp.roleLevel] = byRoleLevel[opp.roleLevel] || { count: 0 }
      byRoleLevel[opp.roleLevel].count++
    }
    if (opp.company) {
      byCompany[opp.company] = byCompany[opp.company] || { count: 0 }
      byCompany[opp.company].count++
    }
  }

  return { totalApplications: total, byRoleLevel, byCompany }
}
