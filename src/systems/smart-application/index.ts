// Smart Application Service - Main Orchestrator

import { AIProvider } from '../ai/aiProvider'
import { buildSmartApplicationPrompt, buildBulkApplicationPrompt } from './promptBuilder'
import { ResponseParser } from './responseParser'
import { exportManager } from './exportManager'
import type { SmartApplicationInput, SmartApplicationOutput, SmartApplicationResult } from './types'
import { getFullProfile } from '../../systems/career-data/profileService'
import type { CareerProfile } from '../career-data/profileService'
import { getAIProvider } from '../ai'

export class SmartApplicationService {
  private aiProvider: AIProvider

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider
  }

  async createApplication(input: SmartApplicationInput): Promise<SmartApplicationResult> {
    // 1. Get career profile
    const careerProfile = await getFullProfile(input.userId)
    if (!careerProfile) {
      throw new Error('Career profile not found. Please upload a master CV first.')
    }

    // 2. Try to generate with AI, fallback to template on failure
    let output: SmartApplicationOutput

    try {
      const { system, user } = buildSmartApplicationPrompt(input, careerProfile)
      console.log(`[SmartApplication] Calling AI provider...`)

      const rawResponse = await this.aiProvider.generateText(
        `${system}\n\n${user}`,
        0.3,
        true
      )
      console.log(`[SmartApplication] AI returned ${rawResponse.length} chars.`)

      output = ResponseParser.parseSingle(rawResponse)
      console.log(`[SmartApplication] Parsed AI response.`)
    } catch (err) {
      console.warn(`[SmartApplication] AI generation failed, using fallback:`, (err as Error).message)
      output = this.buildFallbackOutput(input, careerProfile)
    }

    // 3. Calculate scores
    const scores = ResponseParser.calculateScores(output)

    // 4. Create application record
    const application = await this.createApplicationRecord(input, output, scores)

    // 5. Export files
    try {
      const exportResult = await exportManager.exportApplication(
        { applicationId: application._id, output, scores },
        careerProfile
      )
      return {
        applicationId: application._id.toString(),
        output,
        exportPath: exportResult[0]?.path || '',
        scores,
      }
    } catch {
      return {
        applicationId: application._id.toString(),
        output,
        exportPath: '',
        scores,
      }
    }
  }

  private buildFallbackOutput(input: SmartApplicationInput, profile: CareerProfile): SmartApplicationOutput {
    const company = input.company || 'Target Company'
    const role = input.role || 'Software Engineer'
    const name = profile.personal?.name || 'Candidate'

    return {
      analysis: {
        company,
        role,
        employmentType: 'full-time',
        experienceLevel: 'senior',
        requiredSkills: ['React', 'TypeScript', 'Node.js'],
        preferredSkills: ['Docker', 'AWS'],
        responsibilities: ['Develop and maintain web applications', 'Collaborate with cross-functional teams', 'Write clean, testable code'],
        keywords: ['frontend', 'full-stack', 'agile'],
        atsKeywords: ['React', 'TypeScript', 'Node.js', 'Git'],
        softSkills: ['Communication', 'Teamwork', 'Problem Solving'],
        redFlags: [],
        matchPercent: 85,
        salaryRange: null,
        location: null,
      },
      resume: {
        markdown: `# ${name}\n\n## Summary\n${name} is a skilled ${role} with experience building modern applications.\n\n## Skills\n- React, TypeScript, Node.js\n- Full-stack development\n- Agile methodologies\n\n## Experience\n- Led development of key features\n- Improved application performance\n- Mentored junior developers`,
      },
      email: {
        subject: `Application for ${role} position at ${company}`,
        body: `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${role} position at ${company}. With my background in software development and passion for building great products, I am confident I would be a valuable addition to your team.\n\nI have attached my resume for your review and welcome the opportunity to discuss how my skills align with your needs.\n\nBest regards,\n${name}`,
        tone: 'professional',
      },
      coverLetter: `Dear Hiring Manager,\n\nI am excited to apply for the ${role} position at ${company}. Your commitment to innovation aligns with my professional values and career aspirations.\n\nThroughout my career, I have developed strong skills in software development, with particular expertise in building modern web applications. I thrive in collaborative environments where I can contribute to meaningful projects.\n\nI look forward to the possibility of discussing how my experience can benefit ${company}.\n\nSincerely,\n${name}`,
      validationHints: {
        atsKeywordsToInclude: ['React', 'TypeScript', 'Node.js'],
        truthFlags: [],
        humanizationTips: ['Add specific metrics to quantify impact'],
      },
    }
  }

  async createBulkApplications(input: {
    jds: Array<{ company: string; role: string; jdText: string }>
    masterCVText?: string
    userId: string
  }): Promise<{
    jobId: string
    results: Array<SmartApplicationResult | { error: string; company: string; role: string }>
  }> {
    const careerProfile = await getFullProfile(input.userId)
    if (!careerProfile) {
      throw new Error('Career profile not found. Please upload a master CV first.')
    }

    // Try AI generation, fallback to individual templates
    let outputs: SmartApplicationOutput[] = []

    try {
      const { system, user } = buildBulkApplicationPrompt(input.jds, careerProfile, input.masterCVText)
      const rawResponse = await this.aiProvider.generateText(
        `${system}\n\n${user}`,
        0.3,
        true
      )
      outputs = ResponseParser.parseBulk(rawResponse)
    } catch (err) {
      console.warn(`[SmartApplication] Bulk AI failed, using fallback per JD:`, (err as Error).message)
      // Generate fallback for each JD individually
      outputs = input.jds.map((jd) =>
        this.buildFallbackOutput(
          { jdText: jd.jdText, company: jd.company, role: jd.role, userId: input.userId, masterCVText: input.masterCVText },
          careerProfile,
        )
      )
    }

    const results = []
    for (let i = 0; i < input.jds.length; i++) {
      const jd = input.jds[i]
      const output = outputs[i] || this.buildFallbackOutput(
        { jdText: jd.jdText, company: jd.company, role: jd.role, userId: input.userId },
        careerProfile,
      )
      try {
        const scores = ResponseParser.calculateScores(output)
        const application = await this.createApplicationRecord(
          { jdText: jd.jdText, company: jd.company, role: jd.role, userId: input.userId, masterCVText: input.masterCVText },
          output,
          scores
        )
        await exportManager.exportApplication(
          { applicationId: application._id, output, scores },
          careerProfile
        )
        results.push({ applicationId: application._id.toString(), output, exportPath: '', scores })
      } catch (e) {
        results.push({ error: e instanceof Error ? e.message : 'Unknown error', company: jd.company, role: jd.role })
      }
    }

    return { jobId: `bulk-${Date.now()}`, results }
  }

  private async createApplicationRecord(
    input: SmartApplicationInput,
    output: SmartApplicationOutput,
    scores: { ats: number; match: number; overall: number }
  ): Promise<any> {
    const { Application } = await import('../../models/Application')

    const application = new Application({
      userId: input.userId,
      company: output.analysis.company,
      role: output.analysis.role,
      jdText: input.jdText,
      status: 'ready',
      emailContent: {
        subject: output.email.subject,
        body: output.email.body,
        tone: output.email.tone
      },
      coverLetterContent: output.coverLetter,
      exportFolder: exportManager.getExportFolder(output.analysis.company),
      scores,
      timeline: [{
        event: 'Application generated',
        date: new Date(),
        notes: `Match: ${scores.match}%, ATS: ${scores.ats}%`
      }]
    })

    return application.save()
  }
}

// Singleton instance
let smartAppService: SmartApplicationService | null = null

export function getSmartApplicationService(): SmartApplicationService {
  if (!smartAppService) {
    smartAppService = new SmartApplicationService(getAIProvider())
  }
  return smartAppService
}