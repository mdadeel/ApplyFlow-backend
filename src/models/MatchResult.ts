import mongoose, { Schema, Document } from 'mongoose'

export interface IMatchResult extends Document {
  userId: mongoose.Types.ObjectId
  opportunityId: mongoose.Types.ObjectId
  overallScore: number
  breakdown: Array<{
    dimension: string
    score: number
    weight: number
    reason: string
  }>
  skillMatched: string[]
  skillMissing: string[]
  viewedAt?: Date
  appliedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const matchResultSchema = new Schema<IMatchResult>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true },
    overallScore: { type: Number, required: true, min: 0, max: 1 },
    breakdown: [
      {
        dimension: { type: String, required: true },
        score: { type: Number, required: true },
        weight: { type: Number, required: true },
        reason: { type: String, required: true },
        _id: false,
      },
    ],
    skillMatched: { type: [String], default: [] },
    skillMissing: { type: [String], default: [] },
    viewedAt: { type: Date },
    appliedAt: { type: Date },
  },
  { timestamps: true },
)

matchResultSchema.index({ userId: 1, overallScore: -1 })
matchResultSchema.index({ userId: 1, opportunityId: 1 }, { unique: true })

export const MatchResult = mongoose.model<IMatchResult>('MatchResult', matchResultSchema)
