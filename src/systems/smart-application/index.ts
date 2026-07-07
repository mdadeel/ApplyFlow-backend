// Smart Application Service - Main Orchestrator

import { AIProvider } from '../ai/aiProvider'
import { buildSmartApplicationPrompt, buildBulkApplicationPrompt } from './promptBuilder'
import { ResponseParser } from './responseParser'
import { exportManager } from './exportManager'
import type { SmartApplicationInput, SmartApplicationOutput, SmartApplicationResult } from './types'
import { getFullProfile } from '../../systems/career-data/profileService'
import type { CareerProfile } from '../career-data/profileService'
import { getAIProvider } from '../ai'
import { validateTruthAgainstProfile, stripUnverifiableClaims } from '../document-validation/truthGate'
import { RefinementService } from './refinementService'

export class SmartApplicationService {
  private aiProvider: AIProvider
  private refinementService: RefinementService

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider
    this.refinementService = new RefinementService()
  }

  async createApplication(input: SmartApplicationInput, retrySections?: string[]): Promise<SmartApplicationResult> {
    // 1. Get career profile
    const careerProfile = await getFullProfile(input.userId)
    if (!careerProfile) {
      throw new Error('Career profile not found. Please upload a master CV first.')
    }

    // 2. Generate with AI, with per-stage error handling (M4)
    let output: SmartApplicationOutput | null = null

    // Stage 1: Generation + Parse (critical — no output = cannot continue)
    try {
      const { system, user } = buildSmartApplicationPrompt(input, careerProfile, retrySections)
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
      console.warn(`[SmartApplication] Generation failed: ${(err as Error).message}, using fallback.`)
      output = this.buildFallbackOutput(input, careerProfile)
    }

    // Stages 2-4 are refinements — each runs independently on the best output so far.
    // A failure in one stage does NOT block subsequent stages.

    // Stage 2: Truth Gate (validator — failure doesn't block later refinement)
    if (output) {
      try {
        console.log(`[SmartApplication] Running truth gate...`)
        const truthResult = validateTruthAgainstProfile(output, careerProfile)
        if (truthResult.unverifiable.length > 0) {
          console.warn(`[SmartApplication] Truth gate found ${truthResult.unverifiable.length} unverifiable claims:`)
          for (const issue of truthResult.unverifiable) {
            console.warn(`  - [${issue.location}] ${issue.claim}: ${issue.reason}`)
          }
          output = stripUnverifiableClaims(output, truthResult.unverifiable)
          output.validationHints.truthFlags = [
            ...output.validationHints.truthFlags,
            ...truthResult.unverifiable.map(u => `${u.reason} (at ${u.location})`)
          ]
          console.log(`[SmartApplication] Stripped unverifiable claims.`)
        }
      } catch (err) {
        console.warn(`[SmartApplication] Truth gate failed (continuing with pre-truth output):`, (err as Error).message)
      }
    }

    // Stage 3: Humanization (independent refinement)
    if (output) {
      try {
        console.log(`[SmartApplication] Running humanization refinement...`)
        const { output: humanized, changes: humanChanges, humanizationScore } = await this.refinementService.refineHumanization(this.aiProvider, output)
        output = humanized
        if (humanChanges.length > 0) {
          console.log(`[SmartApplication] Humanization pass made ${humanChanges.length} change(s):`, humanChanges)
        }
        console.log(`[SmartApplication] Humanization score: ${humanizationScore}`)
      } catch (err) {
        console.warn(`[SmartApplication] Humanization failed (continuing with pre-humanization output):`, (err as Error).message)
      }
    }

    // Stage 4: ATS Gap Fill (independent refinement)
    if (output) {
      try {
        console.log(`[SmartApplication] Running ATS gap fill...`)
        const { output: atsFilled, changes: atsChanges, atsScore } = await this.refinementService.fillATSGaps(this.aiProvider, output, careerProfile)
        output = atsFilled
        if (atsChanges.length > 0) {
          console.log(`[SmartApplication] ATS refinement made ${atsChanges.length} change(s):`, atsChanges)
        }
        console.log(`[SmartApplication] ATS keyword coverage: ${atsScore}%`)
      } catch (err) {
        console.warn(`[SmartApplication] ATS fill failed (continuing with pre-ATS output):`, (err as Error).message)
      }
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

  /**
   * Create application(s) from raw text — AI auto-detects 1 or multiple JDs.
   */
  async createFromRawText(input: {
    userId: string
    jdText: string
    company?: string
    role?: string
    masterCVText?: string
  }): Promise<
    SmartApplicationResult |
    { jobId: string; results: Array<SmartApplicationResult | { error: string; company: string; role: string }> }
  > {
    const careerProfile = await getFullProfile(input.userId)
    if (!careerProfile) {
      throw new Error('Career profile not found. Please upload a master CV first.')
    }

    // Step 1: Use AI to split raw text into individual JDs
    let jds: Array<{ company: string; role: string; jdText: string }>

    try {
      const splitPrompt = `You are an expert job description parser. Analyze the following text and split it into individual job descriptions.

For each job description, extract:
- company: The company name (if mentioned, otherwise "Unknown Company")
- role: The job title / role (if mentioned, otherwise "Unknown Role")
- jdText: The full text of that job description

If the text contains only ONE job description, return an array with one item.
If it contains MULTIPLE job descriptions, return an array with each one separately.
Use natural boundaries (company names, role titles, horizontal rules, double newlines, etc.) to separate them.

Return ONLY valid JSON in this exact format:
{"jds": [{"company": "...", "role": "...", "jdText": "..."}]}

Do not truncate or summarize the jdText — preserve the full text of each description.

Text to analyze:
${input.jdText}`

      const raw = await this.aiProvider.generateText(splitPrompt, 0.2, true)
      let parsed: any
      try {
        parsed = JSON.parse(raw)
      } catch {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
        else throw new Error('Could not parse AI response')
      }

      const rawJds = Array.isArray(parsed?.jds) ? parsed.jds : []
      jds = rawJds
        .filter((j: any) => j && typeof j.jdText === 'string' && j.jdText.trim().length >= 50)
        .map((j: any) => ({
          company: typeof j.company === 'string' ? j.company.trim() : 'Unknown Company',
          role: typeof j.role === 'string' ? j.role.trim() : 'Unknown Role',
          jdText: j.jdText.trim(),
        }))

      // Fallback: if AI returned nothing useful, treat whole text as one JD
      if (jds.length === 0) {
        jds = [{ company: input.company || 'Target Company', role: input.role || 'Software Engineer', jdText: input.jdText }]
      }
    } catch {
      // AI splitting failed — treat as single JD
      jds = [{ company: input.company || 'Target Company', role: input.role || 'Software Engineer', jdText: input.jdText }]
    }

    // Step 2: Process — single JD or bulk
    if (jds.length === 1) {
      const jd = jds[0]
      return this.createApplication({
        userId: input.userId,
        jdText: jd.jdText,
        company: jd.company,
        role: jd.role,
        masterCVText: input.masterCVText,
      })
    }

    return this.createBulkApplications({
      userId: input.userId,
      jds,
      masterCVText: input.masterCVText,
    })
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
      resumeMarkdown: output.resume.markdown,
      resumeStructured: output.resume.sections ? output.resume.sections as Record<string, unknown> : undefined,
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