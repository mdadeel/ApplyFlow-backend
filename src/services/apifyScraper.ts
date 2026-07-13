import { ApifyClient } from 'apify-client'
import mongoose from 'mongoose'
import { config } from '../config'
import { Opportunity } from '../models/Opportunity'
import { IUser } from '../models/User'
import { logger } from '../utils/logger'

// Raw shape returned by worldunboxer/rapid-linkedin-scraper
interface LinkedInJobItem {
  job_title?: string
  company_name?: string
  location?: string
  job_description?: string
  job_description_raw_html?: string
  job_url?: string
  employment_type?: string
  time_posted?: string
}

/**
 * Build a set of search query strings from the user's profile fields.
 * Falls back gracefully if profile is sparse.
 */
export function buildSearchQueries(user: IUser): string[] {
  const queries: string[] = []

  // Use explicitly stored preferred roles first
  if (user.preferredRoles && user.preferredRoles.length > 0) {
    queries.push(...user.preferredRoles.slice(0, 3))
  }

  // Supplement with currentRole if not already covered
  if (user.currentRole && !queries.includes(user.currentRole)) {
    queries.push(user.currentRole)
  }

  // Fall back to top 2 skills as search terms if no roles at all
  if (queries.length === 0 && user.skills && user.skills.length > 0) {
    queries.push(...user.skills.slice(0, 2))
  }

  // Absolute last resort
  if (queries.length === 0) {
    queries.push('Software Engineer')
  }

  return queries
}

/**
 * Derive a location string for the Apify actor from user preferences.
 */
export function buildLocation(user: IUser): string {
  if (user.openToRemote) return 'Remote'
  if (user.preferredLocations && user.preferredLocations.length > 0) {
    return user.preferredLocations[0]
  }
  if (user.location) return user.location
  return 'United States'
}

/**
 * Map a raw LinkedIn job listing to the minimal Opportunity fields needed to
 * queue the record for the ingestion pipeline.
 *
 * Intentionally minimal: the pipeline (parse → validate → embed) will enrich
 * the record. Setting pipelineStatus = 'pending' ensures the worker processes it.
 */
function mapJobToOpportunity(
  job: LinkedInJobItem,
  userId: string,
): ConstructorParameters<typeof Opportunity>[0] | null {
  const title = (job.job_title || '').trim()
  const company = (job.company_name || '').trim()
  const rawText = (job.job_description || '').trim()
  const sourceUrl = (job.job_url || '').trim()

  if (!title || !company) return null           // Cannot save without required fields
  if (!rawText || rawText.length < 20) return null  // Nothing for the AI parser to work with

  return {
    title,
    company,
    location: (job.location || '').trim() || undefined,
    description: rawText.slice(0, 50000),
    rawText: rawText.slice(0, 50000),
    source: 'linkedin',
    sourceUrl: sourceUrl || undefined,
    pipelineStatus: 'pending',        // Handed to the ingestion worker
    createdBy: new mongoose.Types.ObjectId(userId),
    requiredSkills: [],
    preferredSkills: [],
  }
}

/**
 * Run the Apify LinkedIn jobs scraper actor and insert the results as pending
 * Opportunity records. Returns the number of new records created.
 *
 * Deduplication is handled downstream by the ingestion worker's dedup stage.
 */
export async function scrapeAndAddToFeed(userId: string, user: IUser): Promise<number> {
  if (!config.apifyApiToken) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  const queries = buildSearchQueries(user)
  const location = buildLocation(user)

  logger.info(`[ApifyScraper] user=${userId} queries=${JSON.stringify(queries)} location=${location}`)

  const client = new ApifyClient({ token: config.apifyApiToken })

  // Run the actor — call() waits for the run to finish (synchronous wait)
  // Using user's rapid-linkedin-scraper actor which is free/pay-per-event.
  const run = await client.actor('worldunboxer/rapid-linkedin-scraper').call({
    job_title: queries[0] || 'Software Engineer',
    location,
    jobs_entries: 10,     // keep low to conserve credits (minimum allowed is 10)
    work_arrangement: user.openToRemote ? 'Remote' : undefined,
  })

  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  const jobs = items as unknown as LinkedInJobItem[]

  logger.info(`[ApifyScraper] actor returned ${jobs.length} items`)

  let addedCount = 0

  for (const job of jobs) {
    const payload = mapJobToOpportunity(job, userId)
    if (!payload) continue

    try {
      const opp = new Opportunity(payload as any)
      await opp.save()
      addedCount++
    } catch (err: any) {
      // Unique-index violations (sourceUrl duplicate) are expected — log and skip
      if (err?.code === 11000) continue
      logger.warn(`[ApifyScraper] save failed for "${job.job_title}": ${err?.message}`)
    }
  }

  logger.info(`[ApifyScraper] inserted ${addedCount} new pending opportunities`)
  return addedCount
}
