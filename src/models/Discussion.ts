import mongoose, { Schema, Document } from 'mongoose'

export type DiscussionChannel =
  | 'resume-review'
  | 'interview-experience'
  | 'referral'
  | 'career-question'
  | 'success-story'
  | 'general'

export interface IDiscussion extends Document {
  channel: DiscussionChannel
  authorId: string
  authorName?: string
  title: string
  body: string
  replyCount: number
  helpfulCount: number
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
}

const discussionSchema = new Schema<IDiscussion>(
  {
    channel: {
      type: String,
      enum: ['resume-review', 'interview-experience', 'referral', 'career-question', 'success-story', 'general'],
      required: true,
      index: true,
    },
    authorId: { type: String, required: true, index: true },
    authorName: { type: String },
    title: { type: String, required: true, minlength: 3, maxlength: 200 },
    body: { type: String, required: true, minlength: 1, maxlength: 20000 },
    replyCount: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true },
)

discussionSchema.index({ channel: 1, createdAt: -1 })
discussionSchema.index({ createdAt: -1 })

export const Discussion = mongoose.model<IDiscussion>('Discussion', discussionSchema)
