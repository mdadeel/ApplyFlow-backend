import { getAIProvider } from '../ai'

export interface ParsedFields {
  title?: string
  company?: string
  location?: string
  locationType?: string
  description?: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryInterval?: string
  roleLevel?: string
  employmentType?: string
  requiredSkills?: string[]
  preferredSkills?: string[]
  minExperience?: number
  education?: string
  deadline?: string
  benefits?: string[]
}

export interface ParserResult {
  fields: ParsedFields
  confidence: number
  fieldConfidence: Record<string, number>
}

const SYSTEM_PROMPT = `You are a precise job description parser. Extract structured data from job postings.
Return ONLY valid JSON matching the schema. Do not include markdown formatting or code blocks.
If a field is not present in the text, omit it entirely from the output.`

function buildPrompt(rawText: string): string {
  return `Extract structured job posting information from the following text.

Return ONLY valid JSON with this exact schema (no markdown, no code blocks):
{
  "title": "Job Title (required)",
  "company": "Company Name (required, use 'Unknown Company' if not found)",
  "location": "City, State or Remote (optional)",
  "locationType": "remote | hybrid | onsite | unspecified",
  "description": "Full job description (required)",
  "salaryMin": number (optional, annual USD minimum),
  "salaryMax": number (optional, annual USD maximum),
  "salaryCurrency": "USD" (optional),
  "salaryInterval": "yearly | monthly | hourly | unspecified",
  "roleLevel": "intern | entry | mid | senior | lead | executive",
  "employmentType": "full-time | part-time | contract | internship | temporary",
  "requiredSkills": ["Skill1", "Skill2"] (required - extract explicitly mentioned required skills),
  "preferredSkills": ["Skill3"] (optional - nice-to-have skills),
  "minExperience": number (optional, years),
  "education": "string (optional)",
  "deadline": "ISO date string (optional, only if explicit deadline mentioned)",
  "benefits": ["Benefit1", "Benefit2"] (optional)
}

Rules:
- Extract ONLY information explicitly present in the text. Do NOT invent or infer values.
- For requiredSkills: include ALL explicitly mentioned technical and soft skills.
- Set locationType based on explicit mentions of remote/hybrid/onsite.
- For salary ranges, use salaryMin and salaryMax. Single number → salaryMin only.
- If a value is truly not present, omit the field entirely.
- The description field is the cleaned job description.

Job posting text:
${rawText}`
}

export async function parse(rawText: string): Promise<ParserResult> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const provider = getAIProvider()
      const response = await provider.generateText(buildPrompt(rawText), 0.3, true)

      const cleaned = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      const fields: ParsedFields = JSON.parse(cleaned)

      const fieldConfidence = computeFieldConfidence(fields)
      const confidence = computeOverallConfidence(fields, fieldConfidence)

      return { fields, confidence, fieldConfidence }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  return {
    fields: {},
    confidence: 0,
    fieldConfidence: {},
  }
}

function computeFieldConfidence(fields: ParsedFields): Record<string, number> {
  const confidence: Record<string, number> = {}

  if (fields.title) confidence.title = fields.title.length > 3 ? 0.95 : 0.5
  if (fields.company) confidence.company = fields.company !== 'Unknown Company' ? 0.9 : 0.3
  if (fields.description) confidence.description = fields.description.length > 100 ? 0.95 : 0.4
  if (fields.requiredSkills && fields.requiredSkills.length > 0) {
    confidence.requiredSkills = fields.requiredSkills.length >= 3 ? 0.9 : 0.6
  }
  if (fields.employmentType) confidence.employmentType = 0.85
  if (fields.salaryMin !== undefined || fields.salaryMax !== undefined) confidence.salaryMin = 0.8
  if (fields.locationType) confidence.locationType = 0.8

  return confidence
}

function computeOverallConfidence(fields: ParsedFields, fieldConfidence: Record<string, number>): number {
  const fieldScores = Object.values(fieldConfidence)
  if (fieldScores.length === 0) return 0

  const avgField = fieldScores.reduce((a, b) => a + b, 0) / fieldScores.length

  const hasCore = fields.title && fields.company && fields.description && fields.requiredSkills
  const coreBonus = hasCore ? 0.15 : 0

  return Math.min(avgField + coreBonus, 1)
}
