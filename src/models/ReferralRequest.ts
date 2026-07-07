import mongoose, { Schema, Document } from 'mongoose'

export type ReferralStatus = 'open' | 'claimed' | 'matched' | 'accepted' | 'completed' | 'withdrawn' | 'closed' | 'expired'

export interface IReferralRequest extends Document {
  userId: string
  company: string
  role: string
  location?: string
  message: string
  jdUrl?: string
  tags: string[]
  status: ReferralStatus
  responderId?: string
  responseNote?: string
  matchedReferralId?: string
  expiresAt?: Date
  opportunityId?: string
  createdAt: Date
  updatedAt: Date
}

const referralRequestSchema = new Schema<IReferralRequest>(
  {
    userId: { type: String, required: true, index: true },
    company: { type: String, required: true, minlength: 1, maxlength: 200 },
    role: { type: String, required: true, minlength: 1, maxlength: 200 },
    location: { type: String, maxlength: 200 },
    message: { type: String, required: true, minlength: 10, maxlength: 5000 },
    jdUrl: { type: String, maxlength: 500 },
    tags: { type: [String], default: [], validate: (v: string[]) => v.length <= 10 },
    status: {
      type: String,
      enum: ['open', 'claimed', 'matched', 'accepted', 'completed', 'withdrawn', 'closed', 'expired'],
      default: 'open',
    },
    responderId: { type: String, default: undefined },
    responseNote: { type: String, maxlength: 5000 },
    matchedReferralId: { type: String, default: undefined },
    expiresAt: { type: Date, default: undefined },
    opportunityId: { type: String, index: true, default: undefined },
  },
  { timestamps: true },
)

referralRequestSchema.index({ company: 1, status: 1 })
referralRequestSchema.index({ status: 1, createdAt: -1 })

export const ReferralRequest = mongoose.model<IReferralRequest>(
  'ReferralRequest',
  referralRequestSchema,
)
