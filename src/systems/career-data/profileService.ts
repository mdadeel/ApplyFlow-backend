// Profile Service - Aggregates all career profile data

import { Experience } from '../../models/Experience'
import { Project } from '../../models/Project'
import { Skill } from '../../models/Skill'
import { Education } from '../../models/Education'
import { Certificate } from '../../models/Certificate'
import { Award } from '../../models/Award'
import { Publication } from '../../models/Publication'
import { Volunteering } from '../../models/Volunteering'
import { Language } from '../../models/Language'
import { Interest } from '../../models/Interest'
import { User } from '../../models/User'
import type { ExtractedProfile } from './pdfExtractor'

const SKILL_CATEGORY_MAP: Record<string, string> = {
  frontend: 'Frontend',
  ui: 'Frontend',
  'user interface': 'Frontend',
  css: 'Frontend',
  backend: 'Backend',
  api: 'Backend',
  server: 'Backend',
  database: 'Database',
  db: 'Database',
  sql: 'Database',
  nosql: 'Database',
  cloud: 'Cloud',
  aws: 'Cloud',
  devops: 'DevOps',
  'ci/cd': 'DevOps',
  infrastructure: 'DevOps',
  deployment: 'DevOps',
  testing: 'Testing',
  test: 'Testing',
  qa: 'Testing',
  languages: 'Languages',
  'programming languages': 'Languages',
  language: 'Languages',
}

function mapSkillCategory(category: string): string {
  const key = category.trim().toLowerCase()
  return SKILL_CATEGORY_MAP[key] || 'Languages'
}

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const

function mapSkillLevel(level: string): 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' {
  if ((SKILL_LEVELS as readonly string[]).includes(level)) {
    return level as 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
  }
  return 'Intermediate'
}

export interface CareerProfile {
  personal: {
    name?: string
    email?: string
    title?: string
    summary?: string
  }
  experiences: Array<{
    _id: string
    company: string
    role: string
    startDate: string
    endDate?: string
    current: boolean
    responsibilities: string[]
    technologies: string[]
    achievements: string[]
    metrics: string[]
  }>
  projects: Array<{
    _id: string
    title: string
    description: string
    technologies: string[]
    features: string[]
    outcome?: string
    github?: string
    demo?: string
  }>
  skills: Array<{
    _id: string
    name: string
    category: string
    level: string
  }>
  education: Array<{
    _id: string
    degree: string
    institution: string
    startDate: string
    endDate: string
    result?: string
  }>
  certificates: Array<{
    _id: string
    name: string
    issuer: string
    date: string
    url?: string
  }>
  awards: Array<{
    _id: string
    title: string
    issuer: string
    date?: string
    description?: string
    url?: string
  }>
  publications: Array<{
    _id: string
    title: string
    publisher: string
    date?: string
    url?: string
    description?: string
    authors?: string[]
  }>
  volunteering: Array<{
    _id: string
    organization: string
    role: string
    startDate?: string
    endDate?: string
    current: boolean
    description?: string
    technologies?: string[]
  }>
  languages: Array<{
    _id: string
    name: string
    proficiency: string
  }>
  interests: Array<{
    _id: string
    name: string
    category?: string
  }>
}

export async function getFullProfile(userId: string): Promise<CareerProfile | null> {
  const user = await User.findById(userId).select('name email').lean()
  if (!user) return null

  const [experiences, projects, skills, education, certificates, awards, publications, volunteering, languages, interests] = await Promise.all([
    Experience.find({ userId }).lean(),
    Project.find({ userId }).lean(),
    Skill.find({ userId }).lean(),
    Education.find({ userId }).lean(),
    Certificate.find({ userId }).lean(),
    Award.find({ userId }).lean(),
    Publication.find({ userId }).lean(),
    Volunteering.find({ userId }).lean(),
    Language.find({ userId }).lean(),
    Interest.find({ userId }).lean(),
  ])

  return {
    personal: {
      name: user.name,
      email: user.email
    },
    experiences: experiences.map(e => ({
      _id: e._id.toString(),
      company: e.company,
      role: e.role,
      startDate: e.startDate,
      endDate: e.endDate,
      current: e.current,
      responsibilities: e.responsibilities || [],
      technologies: e.technologies || [],
      achievements: e.achievements || [],
      metrics: e.metrics || []
    })),
    projects: projects.map(p => ({
      _id: p._id.toString(),
      title: p.title,
      description: p.description,
      technologies: p.technologies || [],
      features: p.features || [],
      outcome: p.outcome,
      github: p.github,
      demo: p.demo
    })),
    skills: skills.map(s => ({
      _id: s._id.toString(),
      name: s.name,
      category: s.category,
      level: s.level
    })),
    education: education.map(e => ({
      _id: e._id.toString(),
      degree: e.degree,
      institution: e.institution,
      startDate: e.startDate,
      endDate: e.endDate,
      result: e.result
    })),
    certificates: certificates.map(c => ({
      _id: c._id.toString(),
      name: c.name,
      issuer: c.issuer,
      date: c.date,
      url: c.url
    })),
    awards: awards.map(a => ({
      _id: a._id.toString(),
      title: a.title,
      issuer: a.issuer,
      date: a.date,
      description: a.description,
      url: a.url,
    })),
    publications: publications.map(p => ({
      _id: p._id.toString(),
      title: p.title,
      publisher: p.publisher,
      date: p.date,
      url: p.url,
      description: p.description,
      authors: p.authors,
    })),
    volunteering: volunteering.map(v => ({
      _id: v._id.toString(),
      organization: v.organization,
      role: v.role,
      startDate: v.startDate,
      endDate: v.endDate,
      current: v.current,
      description: v.description,
      technologies: v.technologies,
    })),
    languages: languages.map(l => ({
      _id: l._id.toString(),
      name: l.name,
      proficiency: l.proficiency,
    })),
    interests: interests.map(i => ({
      _id: i._id.toString(),
      name: i.name,
      category: i.category,
    })),
  }
}

export async function saveExtractedProfile(userId: string, extracted: ExtractedProfile): Promise<void> {
  // Clear existing data for this user to avoid duplicates
  await Promise.all([
    Experience.deleteMany({ userId }),
    Project.deleteMany({ userId }),
    Skill.deleteMany({ userId }),
    Education.deleteMany({ userId }),
    Certificate.deleteMany({ userId }),
    Award.deleteMany({ userId }),
    Publication.deleteMany({ userId }),
    Volunteering.deleteMany({ userId }),
    Language.deleteMany({ userId }),
    Interest.deleteMany({ userId }),
  ])

  // Map experience technologies: merge responsibilities/technologies/achievements/metrics into arrays
  const experienceDocs = extracted.experiences.map(exp => ({
    userId,
    company: exp.company,
    role: exp.role,
    startDate: exp.startDate,
    endDate: exp.endDate || undefined,
    current: exp.current,
    responsibilities: exp.responsibilities || [],
    technologies: exp.technologies || [],
    achievements: exp.achievements || [],
    metrics: exp.metrics || [],
    projects: exp.projects || [],
    links: exp.links || undefined,
  }))

  // Map projects
  const projectDocs = extracted.projects.map(p => ({
    userId,
    title: p.title,
    description: p.description,
    technologies: p.technologies || [],
    features: p.features || [],
    outcome: p.outcome || '',
    github: p.github || '',
    demo: p.demo || '',
    tags: p.tags || [],
    links: p.links || undefined,
    problem: p.problem || '',
    solution: p.solution || '',
    challenges: p.challenges || [],
  }))

  // Map skills with category normalization
  const skillDocs = extracted.skills.map(s => ({
    userId,
    name: s.name,
    category: mapSkillCategory(s.category),
    level: mapSkillLevel(s.level),
  }))

  // Map education
  const educationDocs = extracted.education.map(e => ({
    userId,
    degree: e.degree,
    institution: e.institution,
    startDate: e.startDate,
    endDate: e.endDate,
    result: e.result || '',
  }))

  // Map certificates
  const certificateDocs = extracted.certificates.map(c => ({
    userId,
    name: c.name,
    issuer: c.issuer,
    date: c.date,
    url: c.url || undefined,
  }))

  // Map new sections
  const awardDocs = (extracted.awards || []).map(a => ({
    userId,
    title: a.title,
    issuer: a.issuer,
    date: a.date || undefined,
    description: a.description || undefined,
    url: a.url || undefined,
    order: 0,
  }))

  const publicationDocs = (extracted.publications || []).map(p => ({
    userId,
    title: p.title,
    publisher: p.publisher,
    date: p.date || undefined,
    url: p.url || undefined,
    description: p.description || undefined,
    authors: p.authors || [],
    order: 0,
  }))

  const volunteeringDocs = (extracted.volunteering || []).map(v => ({
    userId,
    organization: v.organization,
    role: v.role,
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    current: v.current,
    description: v.description || undefined,
    technologies: v.technologies || [],
    url: v.url || undefined,
    order: 0,
  }))

  const languageDocs = (extracted.languages || []).map(l => ({
    userId,
    name: l.name,
    proficiency: l.proficiency,
  }))

  const interestDocs = (extracted.interests || []).map(i => ({
    userId,
    name: i.name,
    category: i.category || undefined,
  }))

  // Bulk create all documents
  await Promise.all([
    ...(experienceDocs.length > 0 ? [Experience.insertMany(experienceDocs)] : []),
    ...(projectDocs.length > 0 ? [Project.insertMany(projectDocs)] : []),
    ...(skillDocs.length > 0 ? [Skill.insertMany(skillDocs)] : []),
    ...(educationDocs.length > 0 ? [Education.insertMany(educationDocs)] : []),
    ...(certificateDocs.length > 0 ? [Certificate.insertMany(certificateDocs)] : []),
    ...(awardDocs.length > 0 ? [Award.insertMany(awardDocs)] : []),
    ...(publicationDocs.length > 0 ? [Publication.insertMany(publicationDocs)] : []),
    ...(volunteeringDocs.length > 0 ? [Volunteering.insertMany(volunteeringDocs)] : []),
    ...(languageDocs.length > 0 ? [Language.insertMany(languageDocs)] : []),
    ...(interestDocs.length > 0 ? [Interest.insertMany(interestDocs)] : []),
  ])
}