import mongoose, { Schema, Document } from 'mongoose'

export type CommunityTemplateType = 'resume' | 'cover_letter' | 'email'
export type CommunityTemplateRoleLevel = 'intern' | 'entry' | 'mid' | 'senior' | 'lead'

export interface ICommunityTemplate extends Document {
  userId: string
  title: string
  description: string
  type: CommunityTemplateType
  content: string
  tags: string[]
  industry?: string
  roleLevel?: CommunityTemplateRoleLevel
  likes: number
  downloads: number
  likedBy: string[]
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const communityTemplateSchema = new Schema<ICommunityTemplate>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, minlength: 3, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    type: {
      type: String,
      enum: ['resume', 'cover_letter', 'email'],
      required: true,
    },
    content: { type: String, required: true, minlength: 1, maxlength: 50000 },
    tags: { type: [String], default: [], validate: (v: string[]) => v.length <= 10 },
    industry: { type: String, maxlength: 100 },
    roleLevel: {
      type: String,
      enum: ['intern', 'entry', 'mid', 'senior', 'lead'],
    },
    likes: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    likedBy: { type: [String], default: [] },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
)

communityTemplateSchema.index({ tags: 1 })
communityTemplateSchema.index({ type: 1, industry: 1 })
communityTemplateSchema.index({ createdAt: -1 })

export const CommunityTemplate = mongoose.model<ICommunityTemplate>(
  'CommunityTemplate',
  communityTemplateSchema,
)
