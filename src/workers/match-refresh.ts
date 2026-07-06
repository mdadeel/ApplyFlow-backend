import { Opportunity } from '../models/Opportunity'
import { User } from '../models/User'
import { matchSingle } from '../systems/recommender/engine'

const POLL_INTERVAL_MS = 2 * 60 * 1000
const BATCH_SIZE = 5

let intervalHandle: ReturnType<typeof setInterval> | null = null

async function processBatch(): Promise<void> {
  const freshOpps = await Opportunity.find({
    pipelineStatus: 'completed',
    matchRefreshedAt: { $exists: false },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean()

  if (freshOpps.length === 0) return

  const activeUsers = await User.find({
    skills: { $exists: true, $not: { $size: 0 } },
  })
    .limit(20)
    .lean()

  if (activeUsers.length === 0) return

  for (const opp of freshOpps) {
    for (const user of activeUsers) {
      try {
        await matchSingle(user._id.toString(), opp._id.toString())
      } catch {
        continue
      }
    }

    await Opportunity.findByIdAndUpdate(opp._id, {
      $set: { matchRefreshedAt: new Date() },
    })
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
