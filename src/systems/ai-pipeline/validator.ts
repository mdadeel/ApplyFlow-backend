import { IOpportunity } from '../../models/Opportunity'

export interface ValidatedOutput {
  validated: Partial<IOpportunity>
  confidence: number
  needsReview: boolean
  missingFields: string[]
}

const EXPECTED_FIELDS: (keyof IOpportunity)[] = [
  'title',
  'company',
  'description',
  'requiredSkills',
  'employmentType',
]

const OPTIONAL_FIELDS: (keyof IOpportunity)[] = [
  'location',
  'locationType',
  'salaryMin',
  'salaryMax',
  'salaryCurrency',
  'salaryInterval',
  'roleLevel',
  'preferredSkills',
  'minExperience',
  'education',
  'deadline',
]

const SOURCE_RELIABILITY: Record<string, number> = {
  linkedin: 0.95,
  career_page: 0.9,
  url: 0.85,
  email: 0.7,
  pdf: 0.6,
  screenshot: 0.5,
  manual: 0.4,
}

export function validate(input: Partial<IOpportunity>): ValidatedOutput {
  const validated: Partial<IOpportunity> = { ...input }
  const missingFields: string[] = []

  for (const field of EXPECTED_FIELDS) {
    const val = input[field]
    if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
      missingFields.push(field)
    }
  }

  for (const field of OPTIONAL_FIELDS) {
    const val = input[field]
    if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
      missingFields.push(field)
    }
  }

  const expectedCount = EXPECTED_FIELDS.length + OPTIONAL_FIELDS.length
  const presentCount = expectedCount - missingFields.length
  const fieldFillRate = presentCount / expectedCount

  const aiConfidence = input.aiConfidence ?? 0
  const sourceReliability = SOURCE_RELIABILITY[input.source ?? 'manual'] ?? 0.4

  const confidence = fieldFillRate * 0.3 + aiConfidence * 0.5 + sourceReliability * 0.2

  validated.aiConfidence = confidence
  validated.pipelineStatus = 'completed'

  let needsReview = false
  if (confidence < 0.4) {
    validated.pipelineStatus = 'review_needed'
    needsReview = true
  } else if (confidence >= 0.4 && confidence < 0.7) {
    validated.pipelineStatus = 'completed'
  }

  return {
    validated,
    confidence,
    needsReview,
    missingFields,
  }
}
