import mongoose, { Schema, Document } from 'mongoose'

export type ContributionType =
  | 'interview_experience'
  | 'salary_info'
  | 'recruiter_contact'
  | 'referral_offer'
  | 'hiring_status'
  | 'application_tip'
  | 'scam_report'
  | 'company_insight'
  | 'general'

export interface IContributionStructuredData {
  interviewRounds?: number
  interviewDifficulty?: 'easy' | 'moderate' | 'hard'
  offerReceived?: boolean
  responseTime?: string
  salaryAmount?: number
  salaryInterval?: string
  referralAvailable?: boolean
  scamConfirmed?: boolean
}

export interface IContribution extends Document {
  opportunityId: mongoose.Types.ObjectId
  type: ContributionType
  title: string
  body: string
  isAnonymous: boolean
  structuredData?: IContributionStructuredData
  isVerified: boolean
  isFlagged: boolean
  flagReason?: string
  helpfulCount: number
  helpfulBy: string[]
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const contributionSchema = new Schema<IContribution>(
  {
    opportunityId: {
      type: Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'interview_experience',
        'salary_info',
        'recruiter_contact',
        'referral_offer',
        'hiring_status',
        'application_tip',
        'scam_report',
        'company_insight',
        'general',
      ],
      required: true,
    },
    title: { type: String, required: true, minlength: 10, maxlength: 200 },
    body: { type: String, required: true, minlength: 10, maxlength: 10000 },
    isAnonymous: { type: Boolean, default: false },
    structuredData: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    isVerified: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String, maxlength: 500 },
    helpfulCount: { type: Number, default: 0 },
    helpfulBy: { type: [String], default: [] },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
)

contributionSchema.index({ opportunityId: 1, type: 1, createdAt: -1 })
contributionSchema.index({ createdBy: 1, createdAt: -1 })
contributionSchema.index({ isVerified: 1, helpfulCount: -1 })
contributionSchema.index({ isFlagged: 1 })

export const Contribution = mongoose.model<IContribution>('Contribution', contributionSchema)
