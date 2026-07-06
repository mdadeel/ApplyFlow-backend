import mongoose, { Schema, Document } from 'mongoose'

export type WorkspaceStatus = 'idle' | 'analyzing' | 'tailoring' | 'ready' | 'submitted'

export interface IWorkspaceResume {
  versionId?: mongoose.Types.ObjectId
  content: string
  atsScore?: number
  lastGenerated: Date
}

export interface IWorkspaceCoverLetter {
  content: string
  version: number
  lastGenerated: Date
}

export interface IWorkspaceEmail {
  subject: string
  body: string
  version: number
  lastGenerated: Date
}

export interface IWorkspaceAtsAnalysis {
  score: number
  missingKeywords: string[]
  formattingIssues: string[]
  suggestions: string[]
  lastGenerated: Date
}

export interface IWorkspaceInterviewPrep {
  questions: Array<{ question: string; talkingPoints: string[] }>
  companyResearch: string
  lastGenerated: Date
}

export interface IWorkspaceSkillGap {
  missingSkills: string[]
  recommendations: string[]
  lastGenerated: Date
}

export interface IApplicationWorkspace extends Document {
  userId: mongoose.Types.ObjectId
  opportunityId: mongoose.Types.ObjectId
  status: WorkspaceStatus
  statusMessage?: string
  tailoredResume?: IWorkspaceResume
  coverLetter?: IWorkspaceCoverLetter
  recruiterEmail?: IWorkspaceEmail
  atsAnalysis?: IWorkspaceAtsAnalysis
  interviewPrep?: IWorkspaceInterviewPrep
  skillGap?: IWorkspaceSkillGap
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
}

const workspaceSchema = new Schema<IApplicationWorkspace>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    opportunityId: {
      type: Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: true,
    },
    status: {
      type: String,
      enum: ['idle', 'analyzing', 'tailoring', 'ready', 'submitted'],
      default: 'idle',
    },
    statusMessage: { type: String, maxlength: 200 },
    tailoredResume: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    coverLetter: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    recruiterEmail: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    atsAnalysis: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    interviewPrep: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    skillGap: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true },
)

workspaceSchema.index({ userId: 1, opportunityId: 1 }, { unique: true })
workspaceSchema.index({ userId: 1, status: 1 })
workspaceSchema.index({ opportunityId: 1 })

export const ApplicationWorkspace = mongoose.model<IApplicationWorkspace>(
  'ApplicationWorkspace',
  workspaceSchema,
)
