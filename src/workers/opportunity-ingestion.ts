import { Opportunity } from '../models/Opportunity'
import { PipelineOrchestrator, PipelineInput } from '../systems/ai-pipeline/orchestrator'

const CONCURRENCY_LIMIT = 3
const POLL_INTERVAL_MS = 30_000
const PER_OP_TIMEOUT_MS = 15 * 60 * 1000

let intervalHandle: ReturnType<typeof setInterval> | null = null
let activeCount = 0

async function processBatch(): Promise<void> {
  if (activeCount >= CONCURRENCY_LIMIT) return

  const available = CONCURRENCY_LIMIT - activeCount
  const opportunities = await Opportunity.find({ pipelineStatus: 'pending' })
    .sort({ createdAt: 1 })
    .limit(available)
    .lean()

  for (const opp of opportunities) {
    activeCount++

    const input: PipelineInput = {
      rawText: opp.rawText || opp.description || '',
      source: opp.source as PipelineInput['source'],
      sourceUrl: opp.sourceUrl,
      createdBy: opp.createdBy.toString(),
    }

    const orchestrator = new PipelineOrchestrator(input)
    orchestrator.run().finally(() => {
      activeCount--
    })

    setTimeout(() => {
      activeCount--
    }, PER_OP_TIMEOUT_MS)
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
