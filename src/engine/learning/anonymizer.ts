/**
 * Anonymizer — Phase 10.4
 *
 * Strips PII from learning data before storage.
 * Uses irreversible hashing for fields that need correlation without identity.
 */

import { createHash } from 'crypto'

/** Fields known to contain PII that must be removed or hashed. */
const PII_FIELDS = new Set([
  'userId', 'email', 'phone', 'fullName', 'name',
  'address', 'ssn', 'linkedin', 'github',
])

const HASHED_FIELDS = new Set(['userId'])

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

/** Known company names that might appear in section names. */
const COMPANY_INDICATORS = /\b(?:Inc|Corp|LLC|Ltd|Technologies|Tech|Software|Systems|Solutions|Group|Company)\b/i

function containsCompanyName(value: string): boolean {
  return COMPANY_INDICATORS.test(value) || /^[A-Z][a-z]+ (?:Inc|Corp|LLC)/.test(value)
}

export function anonymizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    if (PII_FIELDS.has(key)) {
      // Hash or remove based on field type
      if (HASHED_FIELDS.has(key) && typeof value === 'string') {
        result[`_${key}`] = hashValue(value)
      }
      // else: drop the field entirely
      continue
    }

    if (typeof value === 'string') {
      if (containsCompanyName(value)) {
        result[key] = '[COMPANY]'
      } else {
        result[key] = value
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = anonymizeRecord(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}

export function anonymizeText(text: string): string {
  return text
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[EMAIL]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    .replace(/\b[A-Z][a-z]+ (?:Inc|Corp|LLC|Ltd)\b/g, '[COMPANY]')
    .replace(/\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s]+\b/g, '[LINKEDIN]')
    .replace(/\b(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s]+\b/g, '[GITHUB]')
}
