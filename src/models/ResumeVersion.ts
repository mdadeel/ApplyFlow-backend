import mongoose, { Schema, Document } from 'mongoose'

export interface IResumeVersion extends Document {
  userId: string
  applicationId: string
  version: number
  strategySnapshot: Record<string, any>
  content: {
    summary: string
    experiences: Record<string, any>[]
    projects: Record<string, any>[]
    skills: string[]
    education: Record<string, any>[]
    certificates: Record<string, any>[]
  }
  template: string
  scores?: { ats?: number; overall?: number }
}

const resumeVersionSchema = new Schema<IResumeVersion>({
  userId: { type: String, required: true, index: true },
  applicationId: { type: String, required: true, index: true },
  version: { type: Number, required: true },
  strategySnapshot: { type: Schema.Types.Mixed },
  content: {
    summary: String,
    experiences: [{ type: Schema.Types.Mixed }],
    projects: [{ type: Schema.Types.Mixed }],
    skills: [{ type: String }],
    education: [{ type: Schema.Types.Mixed }],
    certificates: [{ type: Schema.Types.Mixed }],
  },
  template: { type: String, default: 'modern' },
  scores: {
    ats: Number,
    overall: Number,
  },
}, { timestamps: true })

export const ResumeVersion = mongoose.model<IResumeVersion>('ResumeVersion', resumeVersionSchema)
