// Profile Service - Aggregates all career profile data

import { Experience } from '../../models/Experience'
import { Project } from '../../models/Project'
import { Skill } from '../../models/Skill'
import { Education } from '../../models/Education'
import { Certificate } from '../../models/Certificate'
import { User } from '../../models/User'
import type { ExtractedProfile } from './pdfExtractor'

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
}

export async function getFullProfile(userId: string): Promise<CareerProfile | null> {
  const user = await User.findById(userId).select('name email').lean()
  if (!user) return null

  const [experiences, projects, skills, education, certificates] = await Promise.all([
    Experience.find({ userId }).lean(),
    Project.find({ userId }).lean(),
    Skill.find({ userId }).lean(),
    Education.find({ userId }).lean(),
    Certificate.find({ userId }).lean()
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
    }))
  }
}

export async function saveExtractedProfile(userId: string, extracted: ExtractedProfile): Promise<void> {
  // This would save extracted profile data to the database
  // Implementation depends on the use case
  // For now, we just return the extracted data for user to review
}