import mongoose, { Schema, Document } from 'mongoose'

export interface IValidatorResult {
  name: string
  score: number
  passed: boolean
  issues: { severity: 'error' | 'warning'; message: string; location?: string }[]
}

export interface IValidationReport extends Document {
  userId: string
  applicationId: string
  resumeVersionId: string
  results: IValidatorResult[]
  overallPassed: boolean
  blocked: boolean
}

const validationReportSchema = new Schema<IValidationReport>({
  userId: { type: String, required: true, index: true },
  applicationId: { type: String, required: true },
  resumeVersionId: { type: String, required: true },
  results: [{
    name: String,
    score: Number,
    passed: Boolean,
    issues: [{
      severity: { type: String, enum: ['error', 'warning'] },
      message: String,
      location: String,
    }],
  }],
  overallPassed: Boolean,
  blocked: Boolean,
}, { timestamps: true })

export const ValidationReport = mongoose.model<IValidationReport>('ValidationReport', validationReportSchema)
