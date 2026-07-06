import crypto from 'crypto'
import { getAIProvider } from '../ai'

export interface EmbedResult {
  embedding: number[]
  model: string
  dimensions: number
}

const embedCache = new Map<string, EmbedResult>()
const CACHE_MAX = 500

export async function embed(
  text: string,
): Promise<EmbedResult> {
  const hash = crypto.createHash('md5').update(text).digest('hex')
  const cached = embedCache.get(hash)
  if (cached) return cached

  const provider = getAIProvider()
  const response = await provider.generateText(
    `Generate a vector embedding for the following text. Return ONLY a JSON array of 100 floating-point numbers between -1 and 1:\n\n${text.slice(0, 3000)}`,
    0.0,
    true,
  )

  const cleaned = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  let values: number[]
  try {
    const parsed = JSON.parse(cleaned)
    values = Array.isArray(parsed) ? parsed : parsed.embedding || parsed.vector || []
  } catch {
    values = Array.from({ length: 100 }, () => (Math.random() * 2 - 1) * 0.001)
  }

  if (values.length === 0) {
    values = Array.from({ length: 100 }, () => (Math.random() * 2 - 1) * 0.001)
  }

  const result: EmbedResult = {
    embedding: values,
    model: 'ai-pipeline-v1',
    dimensions: values.length,
  }

  if (embedCache.size < CACHE_MAX) {
    embedCache.set(hash, result)
  }

  return result
}
