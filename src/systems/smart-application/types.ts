// Smart Application Types

export interface SmartApplicationInput {
  jdText: string
  company?: string
  role?: string
  masterCVText?: string
  userId: string
}

export interface SmartApplicationBulkInput {
  jds: Array<{
    company: string
    role: string
    jdText: string
  }>
  masterCVText?: string
  userId: string
}

export interface JDAnalysisOutput {
  company: string
  role: string
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship'
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'principal'
  requiredSkills: string[]
  preferredSkills: string[]
  responsibilities: string[]
  keywords: string[]
  atsKeywords: string[]
  softSkills: string[]
  redFlags: string[]
  matchPercent: number
  salaryRange: string | null
  location: string | null
}

export interface ResumeSectionSummary {
  summary: string
}

export interface ResumeExperienceItem {
  company: string
  role: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface ResumeProjectItem {
  title: string
  description: string
  technologies: string[]
  bullets: string[]
}

export interface ResumeSkillCategory {
  category: string
  items: string[]
}

export interface ResumeEducationItem {
  degree: string
  institution: string
  year: string
}

export interface ResumeCertificationItem {
  name: string
  issuer: string
  year: string
}

export interface ResumeSectionsOutput {
  summary?: string
  experience?: ResumeExperienceItem[]
  projects?: ResumeProjectItem[]
  skills?: ResumeSkillCategory[]
  education?: ResumeEducationItem[]
  certifications?: ResumeCertificationItem[]
}

export interface ResumeOutput {
  markdown: string
  sections?: ResumeSectionsOutput
}

export interface EmailOutput {
  subject: string
  body: string
  tone: 'professional' | 'enthusiastic' | 'concise'
}

export interface ValidationHintsOutput {
  atsKeywordsToInclude: string[]
  truthFlags: string[]
  humanizationTips: string[]
}

export interface SmartApplicationOutput {
  analysis: JDAnalysisOutput
  resume: ResumeOutput
  email: EmailOutput
  coverLetter: string
  validationHints: ValidationHintsOutput
}

export interface SmartApplicationResult {
  applicationId: string
  output: SmartApplicationOutput
  exportPath?: string
  scores: {
    ats: number
    match: number
    overall: number
  }
}

export interface SmartApplicationBulkResult {
  jobId: string
  results: Array<SmartApplicationResult | { error: string; company: string; role: string }>
}