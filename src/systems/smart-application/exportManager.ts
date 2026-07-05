// Export Manager - Handles file writing to company folders

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type { SmartApplicationOutput, SmartApplicationResult } from './types'
import { generateDocx } from '../export/docxGenerator'
import { generateResumePDF } from '../export/pdfGenerator'

const APPLICATIONS_BASE = process.env.APPLICATIONS_BASE || join(process.cwd(), '..', 'applications')

function sanitizeFolderName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/-+/g, '-')
}

function getUserName(careerProfile: any): string {
  const personal = careerProfile?.personal
  if (personal?.name) {
    return personal.name.split(' ').map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join('-')
  }
  return 'User'
}

function generateFileName(userName: string, role: string, company: string, ext: string): string {
  const safeRole = sanitizeFileName(role)
  const safeCompany = sanitizeFileName(company)
  return `${userName}-${safeRole}-${safeCompany}.${ext}`
}

interface ResumeContent {
  summary: string
  experiences: any[]
  projects: any[]
  skills: string[]
  education: any[]
  certificates: any[]
}

function mapResumeSections(output: SmartApplicationOutput): ResumeContent {
  const sections = output.resume?.sections || {} as any

  return {
    summary: sections.summary || '',
    experiences: (sections.experience || []).map((exp: any) => ({
      company: exp.company || '',
      role: exp.role || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      current: false,
      responsibilities: exp.bullets || [],
      technologies: [],
    })),
    projects: (sections.projects || []).map((proj: any) => ({
      title: proj.title || '',
      description: proj.description || '',
      technologies: proj.technologies || [],
      features: proj.bullets || [],
    })),
    skills: (sections.skills || []).flatMap((cat: any) => cat.items || []),
    education: (sections.education || []).map((edu: any) => ({
      degree: edu.degree || '',
      institution: edu.institution || '',
      startDate: edu.year || '',
      endDate: edu.year || '',
      result: '',
    })),
    certificates: (sections.certifications || []).map((cert: any) => ({
      name: cert.name || '',
      issuer: cert.issuer || '',
      date: cert.year || '',
    })),
  }
}

export class ExportManager {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir || APPLICATIONS_BASE
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true })
    }
  }

  async exportApplication(
    result: SmartApplicationResult,
    careerProfile: any,
    formats: ('pdf' | 'docx' | 'md')[] = ['pdf', 'docx', 'md']
  ): Promise<{ format: string; path: string; filename: string }[]> {
    const { output, applicationId } = result
    const { analysis, resume, email, coverLetter } = output

    const companyFolder = sanitizeFolderName(analysis.company)
    const userName = getUserName(careerProfile)
    const exportDir = join(this.baseDir, companyFolder)

    if (!existsSync(exportDir)) {
      mkdirSync(exportDir, { recursive: true })
    }

    const fileNameBase = generateFileName(userName, analysis.role, analysis.company, '')
    const files: { format: string; path: string; filename: string }[] = []

    const resumeMarkdown = resume.markdown
    const emailMarkdown = `# Application Email\n\n**Subject:** ${email.subject}\n\n${email.body}`
    const coverLetterMarkdown = `# Cover Letter\n\n${coverLetter}`
    const resumeContent = mapResumeSections(output)
    const applicantName = careerProfile?.personal?.name || 'Applicant'

    for (const format of formats) {
      if (format === 'md') {
        const mdPath = join(exportDir, `${fileNameBase}.md`)
        writeFileSync(mdPath, resumeMarkdown, 'utf-8')
        files.push({ format: 'md', path: mdPath, filename: `${fileNameBase}.md` })

        const emailMdPath = join(exportDir, `${fileNameBase}.email.md`)
        writeFileSync(emailMdPath, emailMarkdown, 'utf-8')
        files.push({ format: 'md', path: emailMdPath, filename: `${fileNameBase}.email.md` })

        const clMdPath = join(exportDir, `${fileNameBase}.cover-letter.md`)
        writeFileSync(clMdPath, coverLetterMarkdown, 'utf-8')
        files.push({ format: 'md', path: clMdPath, filename: `${fileNameBase}.cover-letter.md` })
      }

      if (format === 'pdf') {
        try {
          const pdfPath = join(exportDir, `${fileNameBase}.pdf`)
          const buffer = await generateResumePDF(resumeContent, applicantName)
          writeFileSync(pdfPath, buffer)
          files.push({ format: 'pdf', path: pdfPath, filename: `${fileNameBase}.pdf` })
        } catch (e) {
          console.error('PDF generation failed:', e)
        }
      }

      if (format === 'docx') {
        try {
          const docxPath = join(exportDir, `${fileNameBase}.docx`)
          const buffer = await generateDocx(resumeContent)
          writeFileSync(docxPath, buffer)
          files.push({ format: 'docx', path: docxPath, filename: `${fileNameBase}.docx` })
        } catch (e) {
          console.error('DOCX generation failed:', e)
        }
      }
    }

    const jdPath = join(exportDir, 'job-description.txt')
    writeFileSync(
      jdPath,
      `${analysis.company} - ${analysis.role}\n\n${resumeMarkdown}`,
      'utf-8'
    )

    const metadata = {
      applicationId,
      company: analysis.company,
      role: analysis.role,
      generatedAt: new Date().toISOString(),
      atsScore: result.scores.ats,
      matchScore: result.scores.match,
      overallScore: result.scores.overall,
      source: 'smart-create',
      cvVersion: 'v1',
      jdHash: createHash('sha256').update(resumeMarkdown).digest('hex').slice(0, 16),
      validation: {
        atsKeywordsFound: output.validationHints.atsKeywordsToInclude.length,
        truthIssues: output.validationHints.truthFlags.length,
        humanizationTips: output.validationHints.humanizationTips.length,
      },
    }
    const metaPath = join(exportDir, 'metadata.json')
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8')

    return files
  }

  getExportFolder(company: string): string {
    return join(this.baseDir, sanitizeFolderName(company))
  }

  listExports(company: string): string[] {
    const dir = this.getExportFolder(company)
    if (!existsSync(dir)) return []
    return require('fs').readdirSync(dir)
  }
}

export const exportManager = new ExportManager()
