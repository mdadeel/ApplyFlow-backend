import mongoose, { Schema, Document } from 'mongoose'

export interface IJDAnalysis extends Document {
  userId: string
  jdHash: string
  rawText: string
  company: string
  role: string
  location?: string
  experienceLevel?: string
  requiredSkills: string[]
  niceToHaveSkills: string[]
  keywords: string[]
  atsTerms: string[]
  redFlags: string[]
  matchScore?: number
  summary?: string
}

const jdAnalysisSchema = new Schema<IJDAnalysis>({
  userId: { type: String, required: true, index: true },
  jdHash: { type: String, required: true, index: true },
  rawText: { type: String, required: true },
  company: { type: String, required: true },
  role: { type: String, required: true },
  location: String,
  experienceLevel: String,
  requiredSkills: [{ type: String }],
  niceToHaveSkills: [{ type: String }],
  keywords: [{ type: String }],
  atsTerms: [{ type: String }],
  redFlags: [{ type: String }],
  matchScore: Number,
  summary: String,
}, { timestamps: true })

jdAnalysisSchema.index({ userId: 1, jdHash: 1 }, { unique: true })

export const JDAnalysis = mongoose.model<IJDAnalysis>('JDAnalysis', jdAnalysisSchema)
