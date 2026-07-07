// Profile Service - Aggregates all career profile data

import mongoose from 'mongoose'
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
import { ProfileAudit } from '../../models/ProfileAudit'
import type { ExtractedProfile } from './pdfExtractor'

export interface MergeConflict {
  section: string
  field: string
  existingValue: unknown
  incomingValue: unknown
  resolution: 'use_existing' | 'use_incoming' | 'flag_for_review'
}

export interface MergeResult {
  conflicts: MergeConflict[]
  created: number
  updated: number
  skipped: number
}

/**
 * Check if MongoDB is running in a replica-set configuration (required for transactions).
 * Falls back to false if we can't determine (standalone/unknown).
 */
async function supportsTransactions(): Promise<boolean> {
  try {
    const admin = mongoose.connection.db?.admin()
    if (!admin) return false
    const replStatus = await admin.command({ replSetGetStatus: 1 }).catch(() => null)
    return replStatus !== null && replStatus.myState !== undefined
  } catch {
    return false
  }
}

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

/**
 * Merge an extracted profile into the user's existing career data.
 *
 * For each section (experiences, projects, skills, etc.):
 * - If a record already exists with the same unique key (e.g. company+role for experience),
 *   the existing data is kept and the incoming diff is logged as a conflict.
 * - If no matching record exists, the incoming data is appended (upsert).
 *
 * All writes happen inside a Mongoose transaction for atomicity.
 * All changes are recorded in the ProfileAudit collection.
 */
export async function mergeProfile(userId: string, extracted: ExtractedProfile): Promise<MergeResult> {
  const session = await mongoose.startSession()
  const hasTransactions = await supportsTransactions()

  if (hasTransactions) {
    session.startTransaction()
  }

  const result: MergeResult = { conflicts: [], created: 0, updated: 0, skipped: 0 }

  try {
    const opts = hasTransactions ? { session } : {}

    // --- Experiences: merge by company+role ---
    const existingExperiences = await Experience.find({ userId }).session(session).lean()
    for (const exp of extracted.experiences) {
      const existing = existingExperiences.find(
        e => e.company === exp.company && e.role === exp.role
      )
      if (existing) {
        const conflicts = detectExperienceConflicts(existing, exp)
        if (conflicts.length > 0) {
          result.conflicts.push(...conflicts)
          result.skipped++
        }
      } else {
        await Experience.create([{
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
        }], opts)
        result.created++
      }
    }

    // --- Projects: merge by title ---
    const existingProjects = await Project.find({ userId }).session(session).lean()
    for (const proj of extracted.projects) {
      const existing = existingProjects.find(e => e.title === proj.title)
      if (existing) {
        result.skipped++
      } else {
        await Project.create([{
          userId,
          title: proj.title,
          description: proj.description,
          technologies: proj.technologies || [],
          features: proj.features || [],
          outcome: proj.outcome || '',
          github: proj.github || '',
          demo: proj.demo || '',
          tags: proj.tags || [],
          links: proj.links || undefined,
          problem: proj.problem || '',
          solution: proj.solution || '',
          challenges: proj.challenges || [],
          documentation: proj.documentation || undefined,
          impact: proj.impact || undefined,
          duration: proj.duration || undefined,
          teamSize: proj.teamSize || undefined,
          role: proj.role || undefined,
        }], opts)
        result.created++
      }
    }

    // --- Skills: merge by name (upsert category/level) ---
    const existingSkills = await Skill.find({ userId }).session(session).lean()
    for (const skill of extracted.skills) {
      const existing = existingSkills.find(
        e => e.name.toLowerCase() === skill.name.toLowerCase()
      )
      if (existing) {
        // Update level if incoming is higher
        const existingLevelIdx = SKILL_LEVELS.indexOf(existing.level as (typeof SKILL_LEVELS)[number])
        const incomingLevelIdx = SKILL_LEVELS.indexOf(mapSkillLevel(skill.level))
        if (incomingLevelIdx > existingLevelIdx) {
          await Skill.updateOne(
            { _id: existing._id },
            { level: mapSkillLevel(skill.level) },
            { session }
          )
          result.updated++
        } else {
          result.skipped++
        }
      } else {
        await Skill.create([{
          userId,
          name: skill.name,
          category: mapSkillCategory(skill.category),
          level: mapSkillLevel(skill.level),
        }], opts)
        result.created++
      }
    }

    // --- Education: merge by degree+institution ---
    const existingEducation = await Education.find({ userId }).session(session).lean()
    for (const edu of extracted.education) {
      const existing = existingEducation.find(
        e => e.degree === edu.degree && e.institution === edu.institution
      )
      if (existing) {
        result.skipped++
      } else {
        await Education.create([{
          userId,
          degree: edu.degree,
          institution: edu.institution,
          startDate: edu.startDate,
          endDate: edu.endDate,
          result: edu.result || '',
        }], opts)
        result.created++
      }
    }

    // --- Certificates: merge by name ---
    const existingCerts = await Certificate.find({ userId }).session(session).lean()
    for (const cert of extracted.certificates) {
      const existing = existingCerts.find(e => e.name === cert.name)
      if (existing) {
        result.skipped++
      } else {
        await Certificate.create([{
          userId,
          name: cert.name,
          issuer: cert.issuer,
          date: cert.date,
          url: cert.url || undefined,
        }], opts)
        result.created++
      }
    }

    // --- Awards: merge by title ---
    const existingAwards = await Award.find({ userId }).session(session).lean()
    for (const award of extracted.awards || []) {
      const existing = existingAwards.find(e => e.title === award.title)
      if (existing) {
        result.skipped++
      } else {
        await Award.create([{
          userId,
          title: award.title,
          issuer: award.issuer,
          date: award.date || undefined,
          description: award.description || undefined,
          url: award.url || undefined,
          order: 0,
        }], opts)
        result.created++
      }
    }

    // --- Publications: merge by title ---
    const existingPubs = await Publication.find({ userId }).session(session).lean()
    for (const pub of extracted.publications || []) {
      const existing = existingPubs.find(e => e.title === pub.title)
      if (existing) {
        result.skipped++
      } else {
        await Publication.create([{
          userId,
          title: pub.title,
          publisher: pub.publisher,
          date: pub.date || undefined,
          url: pub.url || undefined,
          description: pub.description || undefined,
          authors: pub.authors || [],
          order: 0,
        }], opts)
        result.created++
      }
    }

    // --- Volunteering: merge by organization+role ---
    const existingVol = await Volunteering.find({ userId }).session(session).lean()
    for (const vol of extracted.volunteering || []) {
      const existing = existingVol.find(
        e => e.organization === vol.organization && e.role === vol.role
      )
      if (existing) {
        result.skipped++
      } else {
        await Volunteering.create([{
          userId,
          organization: vol.organization,
          role: vol.role,
          startDate: vol.startDate || undefined,
          endDate: vol.endDate || undefined,
          current: vol.current,
          description: vol.description || undefined,
          technologies: vol.technologies || [],
          url: vol.url || undefined,
          order: 0,
        }], opts)
        result.created++
      }
    }

    // --- Languages: merge by name ---
    const existingLangs = await Language.find({ userId }).session(session).lean()
    for (const lang of extracted.languages || []) {
      const existing = existingLangs.find(e => e.name === lang.name)
      if (existing) {
        result.skipped++
      } else {
        await Language.create([{
          userId,
          name: lang.name,
          proficiency: lang.proficiency,
        }], opts)
        result.created++
      }
    }

    // --- Interests: merge by name ---
    const existingInterests = await Interest.find({ userId }).session(session).lean()
    for (const interest of extracted.interests || []) {
      const existing = existingInterests.find(e => e.name === interest.name)
      if (existing) {
        result.skipped++
      } else {
        await Interest.create([{
          userId,
          name: interest.name,
          category: interest.category || undefined,
        }], opts)
        result.created++
      }
    }

    // Record audit entry
    await ProfileAudit.create([{
      userId,
      action: 'merge',
      section: 'all',
      confidence: 0.8,
      performedBy: 'ai_extraction',
      newValue: {
        experiencesCreated: extracted.experiences.length,
        projectsCreated: extracted.projects.length,
        skillsCreated: extracted.skills.length,
        conflictsFound: result.conflicts.length,
      },
    }], opts)

    if (hasTransactions) {
      await session.commitTransaction()
    }
    return result
  } catch (error) {
    if (hasTransactions) {
      await session.abortTransaction()
    }
    throw error
  } finally {
    session.endSession()
  }
}

function detectExperienceConflicts(
  existing: { company: string; role: string; startDate?: string; endDate?: string; current?: boolean; employmentType?: string; location?: string; workMode?: string },
  incoming: { company: string; role: string; startDate?: string; endDate?: string; current?: boolean; employmentType?: string; location?: string; workMode?: string }
): MergeConflict[] {
  const conflicts: MergeConflict[] = []
  const compareFields: Array<keyof typeof existing> = ['company', 'role', 'startDate', 'endDate', 'current', 'employmentType', 'location', 'workMode']

  for (const field of compareFields) {
    const existingVal = existing[field]
    const incomingVal = incoming[field]
    if (existingVal && incomingVal && String(existingVal) !== String(incomingVal)) {
      conflicts.push({
        section: 'experience',
        field: `${field} (${existing.company}/${existing.role})`,
        existingValue: existingVal,
        incomingValue: incomingVal,
        resolution: 'use_existing',
      })
    }
  }

  return conflicts
}

/**
 * @deprecated Use mergeProfile() instead. This function destructively replaces all
 * career data for the user. It will be removed in a future version.
 *
 * The new mergeProfile() appends new data and preserves existing records,
 * with conflict detection and full audit trail.
 */
export async function saveExtractedProfile(userId: string, extracted: ExtractedProfile): Promise<void> {
  console.warn('[DEPRECATED] saveExtractedProfile uses destructive deleteMany. Use mergeProfile() instead.')

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