import { Opportunity } from '../../models/Opportunity'
import mongoose from 'mongoose'

export interface DedupResult {
  isDuplicate: boolean
  existingId?: mongoose.Types.ObjectId
  merged: boolean
}

export interface DedupInput {
  title: string
  company: string
  description?: string
  requiredSkills?: string[]
  preferredSkills?: string[]
  source?: string
  sourceUrl?: string
}

const EXACT_FIELDS = ['title', 'company'] as const

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an

  const matrix: number[] = []
  for (let i = 0; i <= bn; i++) matrix[i] = i

  for (let i = 1; i <= an; i++) {
    let prev = i
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const val = Math.min(
        matrix[j] + 1,
        prev + 1,
        matrix[j - 1] + cost,
      )
      matrix[j - 1] = prev
      prev = val
    }
    matrix[bn] = prev
  }

  return matrix[bn]
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const mag = Math.sqrt(na) * Math.sqrt(nb)
  return mag === 0 ? 0 : dot / mag
}

export async function dedup(input: DedupInput): Promise<DedupResult> {
  const normalizedCompany = normalize(input.company)
  const normalizedTitle = normalize(input.title)

  const existing = await Opportunity.find({
    isArchived: false,
  }).lean()

  for (const opp of existing) {
    const nCompany = normalize(opp.company)
    const nTitle = normalize(opp.title)

    const exactMatch = nCompany === normalizedCompany && nTitle === normalizedTitle
    const fuzzyMatch = levenshtein(nCompany, normalizedCompany) <= 3
      && levenshtein(nTitle, normalizedTitle) <= 3

    let vectorMatch = false
    if (input.description && opp.embedding && opp.embedding.length > 0) {
      vectorMatch = true
    }

    if (exactMatch) {
      return { isDuplicate: true, existingId: opp._id, merged: false }
    }

    if (fuzzyMatch) {
      await mergeDuplicate(opp._id, input)
      return { isDuplicate: true, existingId: opp._id, merged: true }
    }
  }

  return { isDuplicate: false, merged: false }
}

async function mergeDuplicate(existingId: mongoose.Types.ObjectId, input: DedupInput) {
  const update: Record<string, unknown> = {}
  if (input.description) update.description = input.description
  if (input.requiredSkills?.length) update.$addToSet = { requiredSkills: { $each: input.requiredSkills } }
  if (input.preferredSkills?.length) {
    if (!update.$addToSet) update.$addToSet = {}
    ;(update.$addToSet as Record<string, unknown>).preferredSkills = { $each: input.preferredSkills }
  }
  if (input.sourceUrl) update.sourceUrl = input.sourceUrl
  if (input.source) update.source = input.source

  await Opportunity.findByIdAndUpdate(existingId, update)
}
