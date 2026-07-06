import mongoose, { Schema, Document } from 'mongoose'

export type ExportType = 'resume' | 'cover-letter' | 'email'

export interface IExportRecord extends Document {
  userId: string
  applicationId: string
  type: ExportType
  content: string
  subject?: string
  format: string
  fileName: string
  createdAt: string
  updatedAt: string
}

const exportRecordSchema = new Schema<IExportRecord>({
  userId: { type: String, required: true, index: true },
  applicationId: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['resume', 'cover-letter', 'email'] },
  content: { type: String, required: true },
  subject: String,
  format: { type: String, required: true },
  fileName: { type: String, required: true },
}, { timestamps: true })

exportRecordSchema.index({ userId: 1, applicationId: 1 })
exportRecordSchema.index({ userId: 1, createdAt: -1 })

export const ExportRecord = mongoose.model<IExportRecord>('ExportRecord', exportRecordSchema)
