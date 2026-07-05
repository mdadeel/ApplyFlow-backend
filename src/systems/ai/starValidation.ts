/**
 * STAR output validation helper.
 *
 * Validates that a STAR answer:
 * 1. Contains all 4 required fields with non-empty values
 * 2. Does not contain invented percentages, multipliers, or numbers
 * 3. Does not contain technologies/tools not present in the source experience
 * 4. References the company or role from the experience
 * 5. Avoids generic filler content when the experience lacks detail
 */

export interface StarResult {
  situation: string
  task: string
  action: string
  result: string
}

export interface StarValidationIssue {
  field: string
  severity: 'error' | 'warning'
  message: string
}

export interface StarValidationReport {
  valid: boolean
  issues: StarValidationIssue[]
}

const GENERIC_PLACEHOLDER = 'No specific detail provided'

/**
 * Collect all lowercase tokens from an experience object that represent
 * verifiable facts (company, role, technologies, responsibilities, etc.).
 */
function collectAllowedTerms(experience: Record<string, unknown>): Set<string> {
  const terms = new Set<string>()

  const add = (v: unknown) => {
    if (typeof v !== 'string') return
    const t = v.trim().toLowerCase()
    if (t.length > 1) terms.add(t)
  }

  add(experience['company'])
  add(experience['role'])

  // Individual technology/tool tokens
  const techField = experience['technologies']
  if (Array.isArray(techField)) {
    for (const item of techField) add(item)
  }

  // Split multi-word technologies into individual tokens
  if (Array.isArray(techField)) {
    for (const item of techField) {
      if (typeof item === 'string') {
        for (const token of item.split(/[\s/.-]+/)) {
          if (token.length > 1) terms.add(token.toLowerCase())
        }
      }
    }
  }

  // Responsibility/achievement snippets
  for (const field of ['responsibilities', 'achievements', 'metrics', 'projects'] as const) {
    const list = experience[field]
    if (Array.isArray(list)) {
      for (const item of list) {
        add(item)
        // Also extract key technology-like words from the text
        if (typeof item === 'string') {
          for (const word of item.split(/[\s,;]+/)) {
            const clean = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase()
            if (clean.length > 2) terms.add(clean)
          }
        }
      }
    }
  }

  return terms
}

/**
 * Check if a STAR field contains any content beyond the generic placeholder.
 */
function hasSubstance(text: string): boolean {
  const cleaned = text.replace(/^["'\s]+|["'\s]+$/g, '').trim()
  return cleaned.length > 0 && cleaned !== GENERIC_PLACEHOLDER
}

/**
 * Check for invented numeric claims — percentages, multipliers, team sizes.
 */
function hasInventedNumbers(text: string): boolean {
  // Flag percentage claims, multiplier claims (2x, 3x, etc.), and large round numbers
  const percentPattern = /\b\d+\s*%/ // "50%" anywhere
  const multiplierPattern = /\b\d+\s*(x|times?|fold)\b/i // "3x faster", "twofold"
  const teamSizePattern = /\b(team of|led|managed)\s+\d+/i // "team of 12"
  const largeRoundPattern = /\b(over|more than|less than|approximately|about)\s+(100|1000|5000|10000)\b/i // vague large numbers

  return (
    percentPattern.test(text) ||
    multiplierPattern.test(text) ||
    teamSizePattern.test(text) ||
    largeRoundPattern.test(text)
  )
}

/**
 * Check if the STAR text introduces nouns not present in the allowed terms set.
 * Returns the first suspicious invented noun, or null if everything looks OK.
 */
function hasInventedNouns(
  text: string,
  allowedTerms: Set<string>,
): string | null {
  // Extract noun-like words (longer than 3 chars, start with uppercase or are technology-like)
  const words = text.split(/[\s,;.()]+/)

  for (const raw of words) {
    const word = raw.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase()
    if (word.length <= 3) continue

    // Skip common English words that aren't suspicious
    const stopWords = new Set([
      'the', 'and', 'for', 'that', 'with', 'this', 'from', 'were', 'have',
      'been', 'was', 'had', 'after', 'before', 'during', 'while', 'which',
      'their', 'they', 'then', 'than', 'when', 'what', 'about', 'into',
      'could', 'would', 'should', 'over', 'also', 'very', 'just', 'team',
      'work', 'role', 'task', 'made', 'need', 'make', 'time', 'more',
      'some', 'such', 'each', 'well', 'even', 'back', 'much', 'still',
      'able', 'part', 'project', 'system', 'feature', 'result', 'code',
      'goal', 'area', 'key', 'way', 'process', 'support',
    ])
    if (stopWords.has(word)) continue

    // If the word looks like a technology name (PascalCase or acronym-like)
    // and it's not in the allowed terms set, flag it.
    // Only flag words longer than 4 chars to avoid sentence-starting words.
    const isTechWord = word.length > 4 && /^[A-Z][a-z]{2,}(?:\.[a-z]{2,})?$/.test(raw.trim())

    if (isTechWord && !allowedTerms.has(word)) {
      return raw.trim()
    }
  }

  return null
}

/**
 * Validate that a STAR result is truthful and grounded in the experience data.
 *
 * @param star - The STAR answer to validate
 * @param experience - The original experience object from the career profile
 * @returns A validation report with issues if any are found
 */
export function validateStarTruth(
  star: StarResult,
  experience: Record<string, unknown>,
): StarValidationReport {
  const issues: StarValidationIssue[] = []
  const allowedTerms = collectAllowedTerms(experience)

  // --- Structural validation ---

  const fields: (keyof StarResult)[] = ['situation', 'task', 'action', 'result']

  for (const field of fields) {
    const value = star[field]

    // Must be a string
    if (typeof value !== 'string') {
      issues.push({
        field,
        severity: 'error',
        message: `${field} must be a string`,
      })
      continue
    }

    const trimmed = value.trim()

    // Must not be empty
    if (!trimmed) {
      issues.push({
        field,
        severity: 'error',
        message: `${field} is empty`,
      })
      continue
    }

    // If it's the placeholder, that's OK — skip further checks
    if (trimmed === GENERIC_PLACEHOLDER) continue

    // --- Content-based validation ---

    // Check for invented numbers
    if (hasInventedNumbers(trimmed)) {
      issues.push({
        field,
        severity: 'error',
        message: `${field} contains invented numeric claims (percentages, multipliers, or team sizes) that are not in the source experience`,
      })
    }

    // Check for invented nouns
    const inventedNoun = hasInventedNouns(trimmed, allowedTerms)
    if (inventedNoun) {
      issues.push({
        field,
        severity: 'error',
        message: `${field} may contain invented detail: "${inventedNoun}" is not found in the source experience`,
      })
    }
  }

  // --- Cross-field validation ---

  const combined = fields.map((f) => star[f] || '').join(' ').toLowerCase()

  // Company OR role must be mentioned
  const company = typeof experience['company'] === 'string' ? (experience['company'] as string).trim().toLowerCase() : ''
  const role = typeof experience['role'] === 'string' ? (experience['role'] as string).trim().toLowerCase() : ''
  const companyOrRoleMentioned =
    (company.length > 0 && combined.includes(company)) ||
    (role.length > 0 && combined.includes(role))

  if (!companyOrRoleMentioned) {
    issues.push({
      field: 'overall',
      severity: 'warning',
      message: 'The STAR answer does not reference the company or role from the source experience',
    })
  }

  // Check if all fields are placeholders (no substance)
  const hasAnySubstance = fields.some((f) => hasSubstance(star[f] || ''))
  if (!hasAnySubstance) {
    issues.push({
      field: 'overall',
      severity: 'error',
      message: 'All STAR fields are empty or use the generic placeholder — experience object likely lacks detail for this question',
    })
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  }
}
