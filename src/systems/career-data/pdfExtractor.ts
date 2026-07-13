import { getAIProvider } from '../ai'

export interface ExtractedLink {
  displayText: string
  url: string
  platform: string
  confidence: 'High' | 'Medium' | 'Low'
}

export interface ExtractedExperience {
  company: string
  role: string
  employmentType?: string
  location?: string
  workMode?: string
  startDate: string
  endDate?: string
  current: boolean
  description?: string
  responsibilities: string[]
  technologies: string[]
  achievements: string[]
  metrics: string[]
  projects: string[]
  links?: ExtractedLink[]
  confidence?: 'High' | 'Medium' | 'Low'
}

export interface ExtractedProject {
  title: string
  description: string
  problem?: string
  solution?: string
  impact?: string
  technologies: string[]
  features: string[]
  challenges: string[]
  outcome?: string
  github?: string
  demo?: string
  documentation?: string
  duration?: string
  teamSize?: string
  role?: string
  tags: string[]
  links?: ExtractedLink[]
  confidence?: 'High' | 'Medium' | 'Low'
}

export interface ExtractedSkill {
  category: string
  name: string
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
  aliases?: string[]
  confidence?: 'High' | 'Medium' | 'Low'
}

export interface ExtractedEducation {
  degree: string
  institution: string
  startDate: string
  endDate: string
  result?: string
  coursework?: string[]
  activities?: string[]
  confidence?: 'High' | 'Medium' | 'Low'
}

export interface ExtractedCertificate {
  name: string
  issuer: string
  date: string
  expiryDate?: string
  credentialId?: string
  url?: string
  confidence?: 'High' | 'Medium' | 'Low'
}

export interface CustomSection {
  title: string
  type: string
  order: number
  items: Array<{
    originalText: string
    structuredFields: Record<string, any>
    links: ExtractedLink[]
    confidence: 'High' | 'Medium' | 'Low'
  }>
  confidence: 'High' | 'Medium' | 'Low'
}

export interface ExtractedAward {
  title: string
  issuer: string
  date?: string
  description?: string
  url?: string
}

export interface ExtractedPublication {
  title: string
  publisher: string
  date?: string
  url?: string
  description?: string
  authors?: string[]
}

export interface ExtractedVolunteering {
  organization: string
  role: string
  startDate?: string
  endDate?: string
  current: boolean
  description?: string
  technologies?: string[]
  url?: string
}

export interface ExtractedLanguage {
  name: string
  proficiency: 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Basic'
}

export interface ExtractedInterest {
  name: string
  category?: string
}

export interface ExtractedProfile {
  personal?: {
    name?: string
    title?: string
    summary?: string
    email?: string
    phone?: string
    location?: string
    links?: ExtractedLink[]
  }
  experiences: ExtractedExperience[]
  projects: ExtractedProject[]
  skills: ExtractedSkill[]
  education: ExtractedEducation[]
  certificates: ExtractedCertificate[]
  awards?: ExtractedAward[]
  publications?: ExtractedPublication[]
  volunteering?: ExtractedVolunteering[]
  languages?: ExtractedLanguage[]
  interests?: ExtractedInterest[]
  customSections?: CustomSection[]
  links?: ExtractedLink[]
  /** URLs extracted from the raw document text (parallel to cleanedText) */
  extractedUrls?: string[]
  documentStructure?: {
    detectedSections: string[]
    totalHeadings: number
    totalBullets: number
    totalLinks: number
    confidence: 'High' | 'Medium' | 'Low'
  }
}

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const

function asString(value: any, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : []
}

function asStringArray(value: any): string[] {
  return asArray(value)
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .map((v: string) => v.trim())
}

function normalizeSkill(value: any): ExtractedSkill | null {
  if (!value || typeof value !== 'object') return null
  const name = asString(value.name).trim()
  if (!name) return null
  const categoryRaw = asString(value.category)
  const category = categoryRaw || 'Languages'
  const levelRaw = asString(value.level)
  const level = (SKILL_LEVELS as readonly string[]).includes(levelRaw)
    ? (levelRaw as ExtractedSkill['level'])
    : 'Intermediate'
  return { 
    name, 
    category, 
    level,
    aliases: asStringArray(value.aliases),
    confidence: (['High', 'Medium', 'Low'].includes(value.confidence) ? value.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
  }
}

export async function extractProfileFromPDF(text: string): Promise<ExtractedProfile> {
  const rawText = text || ''
  const extractedUrls = extractUrls(rawText)
  const trimmed = cleanExtractedText(rawText)
  const empty: ExtractedProfile = {
    personal: undefined,
    experiences: [],
    projects: [],
    skills: [],
    education: [],
    certificates: [],
    customSections: [],
    links: [],
    documentStructure: { detectedSections: [], totalHeadings: 0, totalBullets: 0, totalLinks: 0, confidence: 'Low' }
  }
  if (!trimmed) return empty

  const provider = getAIProvider()

  const prompt = `You are a resume parser. Extract the following information from the text into a clean JSON format.
Ensure you return ONLY valid JSON.
Do not wrap the JSON in markdown code fences and do not add any commentary before or after the JSON object.

REQUIRED JSON STRUCTURE:
{
  "personal": {
    "name": "string", "title": "string", "summary": "string", "email": "string", "phone": "string", "location": "string",
    "links": [{"displayText": "string", "url": "string", "platform": "string"}]
  },
  "experiences": [
    {
      "company": "string", "role": "string", "startDate": "string", "endDate": "string", "current": boolean,
      "responsibilities": ["string"], "technologies": ["string"],
      "links": [{"displayText": "string", "url": "string", "platform": "string"}]
    }
  ],
  "projects": [
    {
      "title": "string", "description": "string", "technologies": ["string"], "features": ["string"],
      "links": [{"displayText": "string", "url": "string", "platform": "string"}]
    }
  ],
  "skills": [
    { "category": "string", "name": "string", "level": "Beginner|Intermediate|Advanced|Expert" }
  ],
  "education": [
    { "degree": "string", "institution": "string", "startDate": "string", "endDate": "string" }
  ],
  "certificates": [
    { "name": "string", "issuer": "string", "date": "string", "url": "string" }
  ],
  "awards": [
    { "title": "string", "issuer": "string", "date": "string", "description": "string", "url": "string" }
  ],
  "publications": [
    { "title": "string", "publisher": "string", "date": "string", "url": "string", "description": "string", "authors": ["string"] }
  ],
  "volunteering": [
    { "organization": "string", "role": "string", "startDate": "string", "endDate": "string", "current": boolean, "description": "string", "technologies": ["string"] }
  ],
  "languages": [
    { "name": "string", "proficiency": "Native|Fluent|Advanced|Intermediate|Basic" }
  ],
  "interests": [
    { "name": "string", "category": "string" }
  ]
}

RULES:
- Do not invent data. If a section is missing, use an empty array or null.
- Include all bullet points verbatim in 'responsibilities' or 'features'.
- Extract URLs explicitly into the 'links' arrays if they are present in the text.
- Be concise. If the resume has many repetitive items (e.g., 20+ skills with similar levels), you may group them or abbreviate rather than listing every detail.

Resume text to parse:
${trimmed}`

  let raw = ''
  try {
    console.log(`[pdfExtractor] Calling Ollama for parsing...`)
    raw = await provider.generateText(prompt, 0.2, true)
    console.log(`[pdfExtractor] Ollama returned ${raw.length} chars.`)
  } catch (err) {
    console.error(`[pdfExtractor] Ollama call failed:`, err)
    raw = ''
  }

  const parsed = parseJsonLoose(raw)
  if (!parsed) {
    console.warn(`[pdfExtractor] Failed to parse JSON from Ollama output. Raw:`, raw.substring(0, 200) + '...')
    return empty
  }
  console.log(`[pdfExtractor] JSON parsed successfully.`)

  const personalObj = parsed.personal && typeof parsed.personal === 'object' ? parsed.personal : null
  const personal = personalObj
    ? {
        name: typeof personalObj.name === 'string' ? personalObj.name : undefined,
        title: typeof personalObj.title === 'string' ? personalObj.title : undefined,
        summary: typeof personalObj.summary === 'string' ? personalObj.summary : undefined,
        email: typeof personalObj.email === 'string' ? personalObj.email : undefined,
        phone: typeof personalObj.phone === 'string' ? personalObj.phone : undefined,
        location: typeof personalObj.location === 'string' ? personalObj.location : undefined,
        links: Array.isArray(personalObj.links) ? personalObj.links : undefined,
      }
    : undefined

  const experiences: ExtractedExperience[] = asArray(parsed.experiences)
    .map((e: any) => {
      const company = asString(e.company).trim()
      const role = asString(e.role).trim()
      if (!company && !role) return null
      return {
        company,
        role,
        employmentType: asString(e.employmentType) || undefined,
        location: asString(e.location) || undefined,
        workMode: asString(e.workMode) || undefined,
        startDate: asString(e.startDate),
        endDate: asString(e.endDate) || undefined,
        current: Boolean(e.current),
        description: asString(e.description) || undefined,
        responsibilities: asStringArray(e.responsibilities),
        technologies: asStringArray(e.technologies),
        achievements: asStringArray(e.achievements),
        metrics: asStringArray(e.metrics),
        projects: asStringArray(e.projects),
        links: Array.isArray(e.links) ? e.links : undefined,
        confidence: (['High', 'Medium', 'Low'].includes(e.confidence) ? e.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
      } as ExtractedExperience
    })
    .filter((x): x is ExtractedExperience => x !== null)

  const projects: ExtractedProject[] = asArray(parsed.projects)
    .map((p: any) => {
      const title = asString(p.title).trim()
      const description = asString(p.description).trim()
      if (!title && !description) return null
      return {
        title,
        description,
        problem: asString(p.problem) || undefined,
        solution: asString(p.solution) || undefined,
        impact: asString(p.impact) || undefined,
        technologies: asStringArray(p.technologies),
        features: asStringArray(p.features),
        challenges: asStringArray(p.challenges),
        outcome: asString(p.outcome) || undefined,
        github: asString(p.github) || undefined,
        demo: asString(p.demo) || undefined,
        documentation: asString(p.documentation) || undefined,
        duration: asString(p.duration) || undefined,
        teamSize: asString(p.teamSize) || undefined,
        role: asString(p.role) || undefined,
        tags: asStringArray(p.tags),
        links: Array.isArray(p.links) ? p.links : undefined,
        confidence: (['High', 'Medium', 'Low'].includes(p.confidence) ? p.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
      } as ExtractedProject
    })
    .filter((x): x is ExtractedProject => x !== null)

  const skills: ExtractedSkill[] = mergeAcronymSkills(
    asArray(parsed.skills)
      .map(normalizeSkill)
      .filter((x): x is ExtractedSkill => x !== null)
  )

  const education: ExtractedEducation[] = asArray(parsed.education)
    .map((e: any) => {
      const degree = asString(e.degree).trim()
      const institution = asString(e.institution).trim()
      const startDate = asString(e.startDate)
      const endDate = asString(e.endDate)
      if (!degree && !institution && !startDate && !endDate) return null
      return {
        degree,
        institution,
        startDate,
        endDate,
        result: asString(e.result) || undefined,
        coursework: asStringArray(e.coursework),
        activities: asStringArray(e.activities),
        confidence: (['High', 'Medium', 'Low'].includes(e.confidence) ? e.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
      } as ExtractedEducation
    })
    .filter((x): x is ExtractedEducation => x !== null)

  const certificates: ExtractedCertificate[] = asArray(parsed.certificates)
    .map((c: any) => {
      const name = asString(c.name).trim()
      const issuer = asString(c.issuer).trim()
      const date = asString(c.date)
      if (!name && !issuer && !date) return null
      return {
        name,
        issuer,
        date,
        expiryDate: asString(c.expiryDate) || undefined,
        credentialId: asString(c.credentialId) || undefined,
        url: asString(c.url) || undefined,
        confidence: (['High', 'Medium', 'Low'].includes(c.confidence) ? c.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
      } as ExtractedCertificate
    })
    .filter((x): x is ExtractedCertificate => x !== null)

  const awards: ExtractedAward[] = asArray(parsed.awards)
    .map((a: any) => {
      const title = asString(a.title).trim()
      if (!title) return null
      return {
        title,
        issuer: asString(a.issuer).trim() || 'Unknown',
        date: asString(a.date) || undefined,
        description: asString(a.description) || undefined,
        url: asString(a.url) || undefined,
      } as ExtractedAward
    })
    .filter((x): x is ExtractedAward => x !== null)

  const publications: ExtractedPublication[] = asArray(parsed.publications)
    .map((p: any) => {
      const title = asString(p.title).trim()
      if (!title) return null
      return {
        title,
        publisher: asString(p.publisher).trim() || 'Unknown',
        date: asString(p.date) || undefined,
        url: asString(p.url) || undefined,
        description: asString(p.description) || undefined,
        authors: asStringArray(p.authors),
      } as ExtractedPublication
    })
    .filter((x): x is ExtractedPublication => x !== null)

  const volunteering: ExtractedVolunteering[] = asArray(parsed.volunteering)
    .map((v: any) => {
      const org = asString(v.organization).trim()
      const role = asString(v.role).trim()
      if (!org && !role) return null
      return {
        organization: org,
        role,
        startDate: asString(v.startDate) || undefined,
        endDate: asString(v.endDate) || undefined,
        current: Boolean(v.current),
        description: asString(v.description) || undefined,
        technologies: asStringArray(v.technologies),
        url: asString(v.url) || undefined,
      } as ExtractedVolunteering
    })
    .filter((x): x is ExtractedVolunteering => x !== null)

  const languages: ExtractedLanguage[] = asArray(parsed.languages)
    .map((l: any) => {
      const name = asString(l.name).trim()
      if (!name) return null
      const validProfs = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic']
      return {
        name,
        proficiency: (validProfs.includes(l.proficiency) ? l.proficiency : 'Intermediate') as ExtractedLanguage['proficiency'],
      } as ExtractedLanguage
    })
    .filter((x): x is ExtractedLanguage => x !== null)

  const interests: ExtractedInterest[] = asArray(parsed.interests)
    .map((i: any) => {
      const name = asString(i.name).trim()
      if (!name) return null
      return {
        name,
        category: asString(i.category) || undefined,
      } as ExtractedInterest
    })
    .filter((x): x is ExtractedInterest => x !== null)

  const customSections: CustomSection[] = asArray(parsed.customSections)
    .map((s: any) => {
      const title = asString(s.title).trim()
      if (!title) return null
      return {
        title,
        type: asString(s.type) || 'Custom',
        order: typeof s.order === 'number' ? s.order : 99,
        items: asArray(s.items).map(i => ({
          originalText: asString(i.originalText),
          structuredFields: i.structuredFields && typeof i.structuredFields === 'object' ? i.structuredFields : {},
          links: Array.isArray(i.links) ? i.links : [],
          confidence: (['High', 'Medium', 'Low'].includes(i.confidence) ? i.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
        })),
        confidence: (['High', 'Medium', 'Low'].includes(s.confidence) ? s.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
      } as CustomSection
    })
    .filter((x): x is CustomSection => x !== null)

  const documentStructure = parsed.documentStructure && typeof parsed.documentStructure === 'object' 
    ? {
        detectedSections: asStringArray(parsed.documentStructure.detectedSections),
        totalHeadings: typeof parsed.documentStructure.totalHeadings === 'number' ? parsed.documentStructure.totalHeadings : 0,
        totalBullets: typeof parsed.documentStructure.totalBullets === 'number' ? parsed.documentStructure.totalBullets : 0,
        totalLinks: typeof parsed.documentStructure.totalLinks === 'number' ? parsed.documentStructure.totalLinks : 0,
        confidence: (['High', 'Medium', 'Low'].includes(parsed.documentStructure.confidence) ? parsed.documentStructure.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
      }
    : undefined

  return normalizeDates({ 
    personal, 
    experiences, 
    projects, 
    skills, 
    education, 
    certificates,
    awards,
    publications,
    volunteering,
    languages,
    interests,
    customSections,
    links: Array.isArray(parsed.links) ? parsed.links : undefined,
    extractedUrls,
    documentStructure
  })
}

/** Extract all URLs found in text into a deduplicated array */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"'()]+/gi
  const matches = text.match(urlRegex)
  if (!matches) return []
  return [...new Set(matches)]
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (/^Page \d+$/i.test(trimmed)) return false
      if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeDates(profile: ExtractedProfile): ExtractedProfile {
  const normalizeDate = (d: string): string => {
    if (!d) return ''
    const m = d.match(/(\d{4})[-/](\d{1,2})/)
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
    const word = d.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i)
    if (word) {
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      }
      return `${word[2]}-${months[word[1].toLowerCase().slice(0, 3)] || '01'}`
    }
    return d
  }

  return {
    ...profile,
    experiences: profile.experiences.map(e => ({
      ...e,
      startDate: normalizeDate(e.startDate),
      endDate: e.endDate ? normalizeDate(e.endDate) : undefined,
    })),
    education: profile.education.map(e => ({
      ...e,
      startDate: normalizeDate(e.startDate),
      endDate: normalizeDate(e.endDate),
    })),
  }
}

function mergeAcronymSkills(skills: ExtractedSkill[]): ExtractedSkill[] {
  const seen = new Map<string, ExtractedSkill>()
  for (const skill of skills) {
    const key = skill.name.toLowerCase()
    if (!seen.has(key)) {
      seen.set(key, skill)
    } else {
      const existing = seen.get(key)!
      // Upgrade level if applicable
      if (SKILL_LEVELS.indexOf(skill.level) > SKILL_LEVELS.indexOf(existing.level)) {
        existing.level = skill.level
      }
      // Merge aliases
      if (skill.aliases && skill.aliases.length > 0) {
        existing.aliases = Array.from(new Set([...(existing.aliases || []), ...skill.aliases]))
      }
    }
  }
  return Array.from(seen.values())
}

export function parseJsonLoose(text: string): any | null {
  if (!text) return null

  // Strip a leading UTF-8 BOM, then trim whitespace.
  let trimmed = text.replace(/^\uFEFF/, '').trim()

  // ---- Attempt 1: direct parse ----
  const direct = tryParse(trimmed)
  if (direct.ok) return direct.value

  // ---- Attempt 2: strip markdown code fences (```json ... ``` or ``` ... ```) ----
  const fenceRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i
  const fenced = trimmed.match(fenceRegex)
  if (fenced) {
    const inner = fenced[1].trim()
    const fenceParsed = tryParse(inner)
    if (fenceParsed.ok) return fenceParsed.value
  }

  // ---- Attempt 3: extract the first balanced {...} block ----
  const balanced = extractBalancedObject(trimmed)
  if (balanced !== null) {
    const balancedParsed = tryParse(balanced)
    if (balancedParsed.ok) return balancedParsed.value

    // ---- Attempt 4: apply repairs to the candidate ----
    // Repair A: remove trailing commas before } or ]
    const noTrailingCommas = balanced.replace(/,(\s*[}\]])/g, '$1')
    const noTrailingCommasParsed = tryParse(noTrailingCommas)
    if (noTrailingCommasParsed.ok) return noTrailingCommasParsed.value

    // Repair B: escape unescaped newlines/CR inside double-quoted strings,
    // and strip control characters except \t, \n, \r.
    const repairedStrings = escapeUnescapedStringChars(noTrailingCommas)
    const repairedStringsParsed = tryParse(repairedStrings)
    if (repairedStringsParsed.ok) return repairedStringsParsed.value

    // Repair C: strip control characters (excluding \t, \n, \r) and try again.
    const strippedControls = repairedStrings.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    const strippedControlsParsed = tryParse(strippedControls)
    if (strippedControlsParsed.ok) return strippedControlsParsed.value
  }

  // ---- Failure: log the full (or truncated) raw text for diagnosis ----
  const MAX_LOG_BYTES = 50 * 1024
  if (trimmed.length <= MAX_LOG_BYTES) {
    console.error(`[pdfExtractor] Full unparseable Ollama response:\n${trimmed}`)
  } else {
    console.error(
      `[pdfExtractor] Full unparseable Ollama response (first ${MAX_LOG_BYTES} of ${trimmed.length} chars):\n` +
        trimmed.slice(0, MAX_LOG_BYTES)
    )
  }
  return null
}

function tryParse(candidate: string): { ok: true; value: any } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(candidate) }
  } catch {
    return { ok: false }
  }
}

/**
 * Find the first '{' in `text` and walk forward, tracking brace depth while
 * ignoring braces that appear inside double-quoted strings (with `\"` escapes).
 * Returns the substring from the opening '{' to its matching closing '}', or
 * `null` if no balanced object is found.
 */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (inString) {
      if (ch === '\\') {
        escapeNext = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      depth++
      continue
    }

    if (ch === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

/**
 * Walk the input and, inside any double-quoted JSON string, escape raw newline
 * and carriage-return characters (LLMs sometimes embed literal line breaks in
 * string values). Control characters outside of strings are left untouched
 * here; the caller handles them with a separate pass.
 */
function escapeUnescapedStringChars(input: string): string {
  let out = ''
  let inString = false
  let escapeNext = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (escapeNext) {
      out += ch
      escapeNext = false
      continue
    }

    if (inString) {
      if (ch === '\\') {
        out += ch
        escapeNext = true
        continue
      }
      if (ch === '"') {
        inString = false
        out += ch
        continue
      }
      if (ch === '\n') {
        out += '\\n'
        continue
      }
      if (ch === '\r') {
        out += '\\r'
        continue
      }
      out += ch
      continue
    }

    if (ch === '"') {
      inString = true
    }
    out += ch
  }

  return out
}
