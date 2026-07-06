import { Opportunity } from '../models/Opportunity'
import { MatchResult } from '../models/MatchResult'
import { ApplicationWorkspace } from '../models/ApplicationWorkspace'
import { Notification } from '../models/Notification'

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000
const DEADLINE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

let intervalHandle: ReturnType<typeof setInterval> | null = null

async function processBatch(): Promise<void> {
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + DEADLINE_WINDOW_MS)

  const opportunities = await Opportunity.find({
    deadline: { $gte: now, $lte: threeDaysFromNow },
    isExpired: false,
  }).lean()

  if (opportunities.length === 0) return

  for (const opp of opportunities) {
    const matches = await MatchResult.find({ opportunityId: opp._id })
      .select('userId')
      .lean()

    const workspaces = await ApplicationWorkspace.find({ opportunityId: opp._id })
      .select('userId')
      .lean()

    const userIds = new Set([
      ...matches.map(m => m.userId.toString()),
      ...workspaces.map(w => w.userId.toString()),
    ])

    const notifications = Array.from(userIds).map(userId => ({
      userId,
      type: 'status_change' as const,
      title: 'Deadline Approaching',
      message: `"${opp.title}" at ${opp.company} closes ${opp.deadline ? opp.deadline.toLocaleDateString() : 'soon'}. Submit your application!`,
      link: `/community/opportunities/${opp._id}`,
    }))

    if (notifications.length > 0) {
      await Notification.insertMany(notifications)
    }
  }
}

export function start(): void {
  if (intervalHandle) return
  intervalHandle = setInterval(processBatch, POLL_INTERVAL_MS)
  processBatch()
}

export function stop(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
