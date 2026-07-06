// Response Parser for Smart Application

import { z } from 'zod'
import type { SmartApplicationOutput, SmartApplicationBulkResult } from './types'

// Zod schemas for validation
const JDAnalysisSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship']),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'principal']),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  keywords: z.array(z.string()),
  atsKeywords: z.array(z.string()),
  softSkills: z.array(z.string()),
  redFlags: z.array(z.string()),
  matchPercent: z.number().min(0).max(100),
  salaryRange: z.string().nullable(),
  location: z.string().nullable()
})

const ResumeExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(z.string()).max(5)
})

const ResumeProjectSchema = z.object({
  title: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
  bullets: z.array(z.string()).max(3)
})

const ResumeSkillCategorySchema = z.object({
  category: z.string(),
  items: z.array(z.string())
})

const ResumeEducationSchema = z.object({
  degree: z.string(),
  institution: z.string(),
  year: z.string()
})

const ResumeCertificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  year: z.string()
})

const ResumeSectionsSchema = z.object({
  summary: z.string(),
  experience: z.array(ResumeExperienceSchema).max(3),
  projects: z.array(ResumeProjectSchema).max(3),
  skills: z.array(ResumeSkillCategorySchema),
  education: z.array(ResumeEducationSchema),
  certifications: z.array(ResumeCertificationSchema)
})

const ResumeSchema = z.object({
  markdown: z.string(),
  sections: ResumeSectionsSchema.optional().catch(undefined)
})

const EmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
  tone: z.enum(['professional', 'enthusiastic', 'concise'])
})

const ValidationHintsSchema = z.object({
  atsKeywordsToInclude: z.array(z.string()),
  truthFlags: z.array(z.string()),
  humanizationTips: z.array(z.string())
})

const SingleOutputSchema = z.object({
  analysis: JDAnalysisSchema,
  resume: ResumeSchema,
  email: EmailSchema,
  coverLetter: z.string(),
  validationHints: ValidationHintsSchema
})

const BulkOutputSchema = z.array(SingleOutputSchema)

export class ResponseParser {
  static parseSingle(raw: string): SmartApplicationOutput {
    let parsed: unknown

    try {
      // Try to extract JSON from markdown code blocks, even if missing closing ticks
      const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?)(?:```|$)/)
      let jsonString = jsonMatch ? jsonMatch[1] : raw.trim()
      // If it doesn't start with {, find the first {
      if (!jsonString.startsWith('{')) {
        const braceIndex = jsonString.indexOf('{')
        if (braceIndex >= 0) {
          jsonString = jsonString.substring(braceIndex)
        }
      }
      parsed = JSON.parse(jsonString)
    } catch (e) {
      throw new Error(`Failed to parse LLM response as JSON: ${e}`)
    }

    const result = SingleOutputSchema.safeParse(parsed)
    if (!result.success) {
      console.error('Validation errors:', result.error.flatten())
      throw new Error(`LLM response validation failed: ${result.error.message}`)
    }

    return result.data
  }

  static parseBulk(raw: string): SmartApplicationOutput[] {
    let parsed: unknown

    try {
      const jsonMatch = raw.match(/```(?:json)?\s*(\[[\s\S]*?)(?:```|$)/)
      let jsonString = jsonMatch ? jsonMatch[1] : raw.trim()
      if (!jsonString.startsWith('[')) {
        const bracketIndex = jsonString.indexOf('[')
        if (bracketIndex >= 0) {
          jsonString = jsonString.substring(bracketIndex)
        }
      }
      parsed = JSON.parse(jsonString)
    } catch (e) {
      throw new Error(`Failed to parse bulk LLM response as JSON: ${e}`)
    }

    const result = BulkOutputSchema.safeParse(parsed)
    if (!result.success) {
      console.error('Bulk validation errors:', result.error.flatten())
      throw new Error(`Bulk LLM response validation failed: ${result.error.message}`)
    }

    return result.data
  }

  static calculateScores(output: SmartApplicationOutput): { ats: number; match: number; overall: number } {
    const { analysis, resume } = output

    // ATS score: percentage of actual JD keywords found in resume markdown
    // Uses analysis.atsKeywords + requiredSkills (extracted from JD), NOT AI-suggested keywords
    const resumeText = resume.markdown.toLowerCase()
    const jdKeywords = [
      ...(analysis.atsKeywords || []),
      ...(analysis.requiredSkills || []),
    ]
    const uniqueKeywords = [...new Set(jdKeywords.map(k => k.toLowerCase()))]

    const atsFound = uniqueKeywords.filter(k => resumeText.includes(k)).length
    const atsScore = uniqueKeywords.length > 0
      ? Math.round((atsFound / uniqueKeywords.length) * 100)
      : 100

    // Match score: from analysis.matchPercent (AI's assessment of profile-vs-JD fit)
    const matchScore = analysis.matchPercent

    // Overall: weighted average — ATS and match equally weighted now
    const overall = Math.round(atsScore * 0.5 + matchScore * 0.5)

    return { ats: atsScore, match: matchScore, overall }
  }
}