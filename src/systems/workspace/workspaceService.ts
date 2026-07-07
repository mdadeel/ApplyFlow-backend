import { z } from 'zod'
import { ApplicationWorkspace, WorkspaceStatus } from '../../models/ApplicationWorkspace'
import { Application } from '../../models/Application'
import { UploadedResume } from '../../models/UploadedResume'
import { Opportunity } from '../../models/Opportunity'
import { User } from '../../models/User'
import { getFullProfile } from '../career-data/profileService'
import { assertTransition } from './state'
import { tailorResume } from './tailoring'
import { generateCoverLetter } from './cover-letter'
import { generateEmail } from './email'
import { analyzeAts } from './ats-analysis'
import { generateInterviewPrep } from './interview-prep'
import { analyzeSkillGap } from './skill-gap'

export const createWorkspaceSchema = z.object({
  opportunityId: z.string().min(1),
})

export const generateContentSchema = z.object({
  type: z.enum(['resume', 'cover-letter', 'email', 'interview-prep']),
})

export const analyzeSchema = z.object({
  type: z.enum(['ats', 'skill-gap']),
})

export async function getWorkspace(id: string, userId: string) {
  const workspace = await ApplicationWorkspace.findOne({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')
  return workspace
}

export async function createWorkspace(opportunityId: string, userId: string) {
  const opportunity = await Opportunity.findById(opportunityId)
  if (!opportunity) throw new Error('Opportunity not found')

  const existing = await ApplicationWorkspace.findOne({ userId, opportunityId })
  if (existing) return existing

  const workspace = new ApplicationWorkspace({ userId, opportunityId })

  await workspace.save()
  await Opportunity.findByIdAndUpdate(opportunityId, { $inc: { totalWorkspaces: 1 } })

  return workspace
}

export async function updateWorkspace(
  id: string,
  userId: string,
  updates: { status?: WorkspaceStatus; isPinned?: boolean; statusMessage?: string },
) {
  const workspace = await ApplicationWorkspace.findOne({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')

  if (updates.status) assertTransition(workspace.status, updates.status)

  if (updates.status) workspace.status = updates.status
  if (updates.isPinned !== undefined) workspace.isPinned = updates.isPinned
  if (updates.statusMessage !== undefined) workspace.statusMessage = updates.statusMessage

  return workspace.save()
}

export async function deleteWorkspace(id: string, userId: string) {
  const workspace = await ApplicationWorkspace.findOneAndDelete({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')

  await Opportunity.findByIdAndUpdate(workspace.opportunityId, {
    $inc: { totalWorkspaces: -1 },
  })

  return workspace
}

export async function generateContent(
  id: string,
  userId: string,
  type: 'resume' | 'cover-letter' | 'email' | 'interview-prep',
) {
  const workspace = await ApplicationWorkspace.findOne({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')

  const opportunity = await Opportunity.findById(workspace.opportunityId)
  if (!opportunity) throw new Error('Opportunity not found')

  const [user, profile] = await Promise.all([
    User.findById(userId),
    getFullProfile(userId),
  ])
  if (!user) throw new Error('User not found')

  workspace.status = 'tailoring'
  workspace.statusMessage = `Generating ${type}...`
  await workspace.save()

  const now = new Date()

  try {
    switch (type) {
      case 'resume': {
        const resumeContent = profile?.experiences
          ? profile.experiences.map((e: any) => `${e.title} at ${e.company}\n${e.description || ''}`).join('\n\n')
          : user.summary || ''

        const content = await tailorResume({
          resumeContent,
          jobTitle: opportunity.title,
          company: opportunity.company,
          description: opportunity.description,
          requiredSkills: opportunity.requiredSkills,
          preferredSkills: opportunity.preferredSkills,
        })

        workspace.tailoredResume = { content, lastGenerated: now }

        const ats = analyzeAts(content, opportunity.requiredSkills, opportunity.preferredSkills)
        workspace.tailoredResume.atsScore = ats.score
        break
      }

      case 'cover-letter': {
        const content = await generateCoverLetter({
          userName: user.name,
          userSummary: user.summary || '',
          userSkills: user.skills,
          jobTitle: opportunity.title,
          company: opportunity.company,
          description: opportunity.description,
          tailoredResume: workspace.tailoredResume?.content,
        })

        workspace.coverLetter = { content, version: (workspace.coverLetter?.version ?? 0) + 1, lastGenerated: now }
        break
      }

      case 'email': {
        const { subject, body } = await generateEmail({
          userName: user.name,
          userTitle: user.title || '',
          userSkills: user.skills,
          jobTitle: opportunity.title,
          company: opportunity.company,
        })

        workspace.recruiterEmail = { subject, body, version: (workspace.recruiterEmail?.version ?? 0) + 1, lastGenerated: now }
        break
      }

      case 'interview-prep': {
        const userExperience = profile?.experiences
          ? profile.experiences.slice(0, 3).map((e: any) => `${e.title} at ${e.company}`).join(', ')
          : ''

        const result = await generateInterviewPrep(
          opportunity.title,
          opportunity.company,
          opportunity.description,
          user.skills,
          userExperience,
        )

        workspace.interviewPrep = { ...result, lastGenerated: now }
        break
      }
    }
  } catch (err) {
    workspace.status = 'idle'
    workspace.statusMessage = `Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    await workspace.save()
    throw err
  }

  workspace.status = 'ready'
  workspace.statusMessage = undefined
  await workspace.save()

  return workspace
}

export async function analyzeWorkspace(
  id: string,
  userId: string,
  type: 'ats' | 'skill-gap',
) {
  const workspace = await ApplicationWorkspace.findOne({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')

  const opportunity = await Opportunity.findById(workspace.opportunityId)
  if (!opportunity) throw new Error('Opportunity not found')

  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  workspace.status = 'analyzing'
  workspace.statusMessage = `Running ${type} analysis...`
  await workspace.save()

  const now = new Date()

  try {
    if (type === 'ats') {
      const resumeContent = workspace.tailoredResume?.content || user.summary || ''
      const analysis = analyzeAts(resumeContent, opportunity.requiredSkills, opportunity.preferredSkills)

      workspace.atsAnalysis = {
        score: analysis.score,
        missingKeywords: analysis.missingKeywords,
        formattingIssues: analysis.formattingIssues,
        suggestions: analysis.suggestions,
        lastGenerated: now,
      }
    } else {
      const analysis = analyzeSkillGap(user.skills, opportunity.requiredSkills, opportunity.preferredSkills)

      workspace.skillGap = {
        missingSkills: analysis.missingSkills,
        recommendations: analysis.recommendations,
        lastGenerated: now,
      }
    }
  } catch (err) {
    workspace.status = 'idle'
    workspace.statusMessage = `Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    await workspace.save()
    throw err
  }

  workspace.status = 'ready'
  workspace.statusMessage = undefined
  await workspace.save()

  return workspace
}

export async function submitWorkspace(id: string, userId: string) {
  const workspace = await ApplicationWorkspace.findOne({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')

  assertTransition(workspace.status, 'submitted')

  workspace.status = 'submitted'
  return workspace.save()
}

export async function sendToResumeLibrary(id: string, userId: string) {
  const workspace = await ApplicationWorkspace.findOne({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')
  if (!workspace.tailoredResume?.content) throw new Error('No tailored resume content to save')

  await UploadedResume.create({
    userId,
    fileName: `workspace-resume-${workspace.opportunityId}.md`,
    fileType: 'docx',
    rawText: workspace.tailoredResume.content,
    content: {
      summary: '',
      experiences: [],
      projects: [],
      skills: [],
      education: [],
      certificates: [],
    },
  })
}

export async function exportWorkspace(id: string, userId: string, format: string) {
  const workspace = await ApplicationWorkspace.findOne({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')

  // Return the content in the requested format — actual file generation
  // is handled by the export engine on the frontend side
  const content: Record<string, unknown> = {
    format,
    tailoredResume: workspace.tailoredResume?.content ?? null,
    coverLetter: workspace.coverLetter?.content ?? null,
    emailSubject: workspace.recruiterEmail?.subject ?? null,
    emailBody: workspace.recruiterEmail?.body ?? null,
  }
  return content
}

export async function createApplicationFromWorkspace(id: string, userId: string) {
  const workspace = await ApplicationWorkspace.findOne({ _id: id, userId })
  if (!workspace) throw new Error('Workspace not found')

  const opportunity = await Opportunity.findById(workspace.opportunityId)
  if (!opportunity) throw new Error('Opportunity not found')

  const app = await Application.create({
    userId,
    company: opportunity.company,
    role: opportunity.title,
    jdText: opportunity.description,
    status: 'draft',
    coverLetterContent: workspace.coverLetter?.content,
    emailContent: workspace.recruiterEmail
      ? { subject: workspace.recruiterEmail.subject, body: workspace.recruiterEmail.body, tone: 'professional' }
      : undefined,
    timeline: [{ event: 'Application created from workspace', date: new Date() }],
  })

  return app
}

export async function listUserWorkspaces(userId: string) {
  return ApplicationWorkspace.find({ userId })
    .sort({ updatedAt: -1 })
    .populate('opportunityId', 'title company location locationType')
    .lean()
}
