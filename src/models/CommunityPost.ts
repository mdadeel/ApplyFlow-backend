import mongoose, { Schema, Document } from 'mongoose'

export type CommunityPostCategory = 'interview' | 'career' | 'salary' | 'tools' | 'general'

export interface ICommunityPost extends Document {
  userId: string
  title: string
  body: string
  tags: string[]
  category: CommunityPostCategory
  likes: number
  replies: number
  likedBy: string[]
  createdAt: Date
  updatedAt: Date
}

const communityPostSchema = new Schema<ICommunityPost>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, minlength: 3, maxlength: 200 },
    body: { type: String, required: true, minlength: 1, maxlength: 20000 },
    tags: { type: [String], default: [], validate: (v: string[]) => v.length <= 10 },
    category: {
      type: String,
      enum: ['interview', 'career', 'salary', 'tools', 'general'],
      required: true,
    },
    likes: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    likedBy: { type: [String], default: [] },
  },
  { timestamps: true },
)

communityPostSchema.index({ category: 1, createdAt: -1 })
communityPostSchema.index({ tags: 1 })
communityPostSchema.index({ createdAt: -1 })

export const CommunityPost = mongoose.model<ICommunityPost>(
  'CommunityPost',
  communityPostSchema,
)
