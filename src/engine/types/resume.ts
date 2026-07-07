export interface ResumeLink {
  displayText: string
  url: string
  platform: string
}

export interface ResumeExperience {
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
  links?: ResumeLink[]
}

export interface ResumeProject {
  title: string
  description: string
  problem?: string
  solution?: string
  technologies: string[]
  features: string[]
  outcome?: string
  github?: string
  demo?: string
  links?: ResumeLink[]
}

export interface ResumeSkill {
  name: string
  category: string
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
  aliases?: string[]
}

export interface ResumeEducation {
  degree: string
  institution: string
  startDate: string
  endDate: string
  result?: string
}

export interface ResumeCertificate {
  name: string
  issuer: string
  date: string
  url?: string
}

export interface ResumeAward {
  title: string
  issuer: string
  date?: string
  description?: string
  url?: string
}

export interface ResumePublication {
  title: string
  publisher: string
  date?: string
  url?: string
  description?: string
  authors?: string[]
}

export interface ResumeVolunteering {
  organization: string
  role: string
  startDate?: string
  endDate?: string
  current: boolean
  description?: string
  technologies?: string[]
}

export interface ResumeLanguage {
  name: string
  proficiency: 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Basic'
}

export interface ResumeInterest {
  name: string
  category?: string
}

export interface ResumePersonal {
  name?: string
  title?: string
  summary?: string
  email?: string
  phone?: string
  location?: string
  links?: ResumeLink[]
}

export interface ResumeDocument {
  extractedUrls: string[]
  originalText: string
  cleanedText: string
}

export interface Resume {
  personal?: ResumePersonal
  experiences: ResumeExperience[]
  projects: ResumeProject[]
  skills: ResumeSkill[]
  education: ResumeEducation[]
  certificates: ResumeCertificate[]
  awards: ResumeAward[]
  publications: ResumePublication[]
  volunteering: ResumeVolunteering[]
  languages: ResumeLanguage[]
  interests: ResumeInterest[]
  document?: ResumeDocument
}
