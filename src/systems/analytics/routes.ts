import { Router, Request, Response } from 'express'
import { Application } from '../../models/Application'
import { sessionGuard } from '../identity/sessionGuard'
import { sendSuccess } from '../../utils/response'

const router = Router()
router.use(sessionGuard)

router.get('/summary', async (req: Request, res: Response) => {
  const [totalApps, byStatus, scoredApps] = await Promise.all([
    Application.countDocuments({ userId: req.userId }),
    Application.aggregate([
      { $match: { userId: req.userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Application.aggregate([
      { $match: { userId: req.userId, 'scores.match': { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$scores.match' } } },
    ]),
  ])
  const statusMap: Record<string, number> = {}
  for (const s of byStatus) statusMap[s._id] = s.count
  const applied = statusMap.applied || 0
  const interviews = statusMap.interview || 0
  const offers = statusMap.offer || 0
  const avgMatchScore = scoredApps.length > 0 ? Math.round(scoredApps[0].avg) : null
  sendSuccess(res, {
    totalApps,
    byStatus: statusMap,
    interviewRate: applied > 0 ? Math.round((interviews / applied) * 100) : 0,
    offerRate: interviews > 0 ? Math.round((offers / interviews) * 100) : 0,
    avgMatchScore,
  })
})

router.get('/chart-data', async (req: Request, res: Response) => {
  const apps = await Application.find({ userId: req.userId }).sort({ createdAt: 1 }).lean()
  const dateMap: Record<string, { applications: number; interviews: number; offers: number }> = {}
  for (const a of apps) {
    const d = new Date((a as any).createdAt).toISOString().slice(0, 10)
    if (!dateMap[d]) dateMap[d] = { applications: 0, interviews: 0, offers: 0 }
    dateMap[d].applications += 1
    if (a.status === 'interview' || a.status === 'assessment' || a.status === 'offer') dateMap[d].interviews += 1
    if (a.status === 'offer') dateMap[d].offers += 1
  }
  const appsOverTime = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))
  const statusDistribution = await Application.aggregate([
    { $match: { userId: req.userId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } },
  ])
  sendSuccess(res, { appsOverTime, statusDistribution })
})

router.get('/insights', async (req: Request, res: Response) => {
  const apps = await Application.find({ userId: req.userId }).lean()
  const total = apps.length
  if (total === 0) { sendSuccess(res, ['Start tracking applications to see insights']); return }
  const applied = apps.filter(a => a.status !== 'draft').length
  const interviews = apps.filter(a => a.status === 'interview' || a.status === 'offer').length
  const offers = apps.filter(a => a.status === 'offer').length
  const insights: string[] = []
  if (offers > 0) insights.push(`You received ${offers} offer${offers > 1 ? 's' : ''} — great progress!`)
  if (applied > 0 && interviews === 0) insights.push('Consider tailoring your resume more closely to job descriptions to improve interview rate')
  if (interviews > 0 && offers === 0) insights.push('You are getting interviews but no offers yet — consider practicing behavioral questions')
  insights.push(`Applied to ${applied} position${applied !== 1 ? 's' : ''} across ${new Set(apps.map(a => a.company)).size} companies`)
  sendSuccess(res, insights)
})

export default router
