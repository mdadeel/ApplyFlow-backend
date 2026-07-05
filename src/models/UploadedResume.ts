import mongoose, { Schema, Document } from 'mongoose'

export interface IUploadedResumeContent {
  summary: string
  experiences: Record<string, any>[]
  projects: Record<string, any>[]
  skills: Record<string, any>[]
  education: Record<string, any>[]
  certificates: Record<string, any>[]
}

export interface IUploadedResume extends Document {
  userId: string
  fileName: string
  fileType: 'docx' | 'doc' | 'pdf'
  rawText: string
  content: IUploadedResumeContent
  createdAt: Date
  updatedAt: Date
}

const uploadedResumeSchema = new Schema<IUploadedResume>({
  userId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  fileType: { type: String, enum: ['docx', 'doc', 'pdf'], required: true },
  rawText: { type: String, default: '' },
  content: {
    summary: { type: String, default: '' },
    experiences: [{ type: Schema.Types.Mixed }],
    projects: [{ type: Schema.Types.Mixed }],
    skills: [{ type: Schema.Types.Mixed }],
    education: [{ type: Schema.Types.Mixed }],
    certificates: [{ type: Schema.Types.Mixed }],
  },
}, { timestamps: true })

uploadedResumeSchema.index({ userId: 1, createdAt: -1 })

export const UploadedResume = mongoose.model<IUploadedResume>('UploadedResume', uploadedResumeSchema)
