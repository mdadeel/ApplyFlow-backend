import { Opportunity } from '../models/Opportunity'
import { embed } from '../systems/ai-pipeline/embedder'

const POLL_INTERVAL_MS = 5 * 60 * 1000
const BATCH_SIZE = 10

let intervalHandle: ReturnType<typeof setInterval> | null = null

async function processBatch(): Promise<void> {
  const opportunities = await Opportunity.find({
    $or: [
      { embedding: { $exists: false } },
      { embedding: null },
    ],
    pipelineStatus: 'completed',
  })
    .limit(BATCH_SIZE)
    .lean()

  if (opportunities.length === 0) return

  for (const opp of opportunities) {
    const text = [opp.title, opp.company, opp.description].filter(Boolean).join('\n')
    try {
      const result = await embed(text)
      await Opportunity.findByIdAndUpdate(opp._id, { $set: { embedding: result.embedding } })
    } catch {
      continue
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
