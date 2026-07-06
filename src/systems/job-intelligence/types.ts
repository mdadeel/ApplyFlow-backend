export interface ParsedJD {
  company: string
  role: string
  location?: string
  experienceLevel?: string
  requiredSkills: string[]
  niceToHaveSkills: string[]
  keywords: string[]
  atsTerms: string[]
  redFlags: string[]
  responsibilities: string[]
  summary: string
}

export interface JDSection {
  heading: string
  body: string
  lines: string[]
  classification: 'requirements' | 'preferred' | 'responsibilities' | 'about' | 'benefits' | 'unknown'
}
