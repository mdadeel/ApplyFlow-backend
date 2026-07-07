import mongoose, { Schema, Document } from 'mongoose'

export interface IDiscussionReply extends Document {
  discussionId: mongoose.Types.ObjectId
  authorId: string
  authorName?: string
  body: string
  helpfulCount: number
  createdAt: Date
  updatedAt: Date
}

const discussionReplySchema = new Schema<IDiscussionReply>(
  {
    discussionId: {
      type: Schema.Types.ObjectId,
      ref: 'Discussion',
      required: true,
      index: true,
    },
    authorId: { type: String, required: true },
    authorName: { type: String },
    body: { type: String, required: true, minlength: 2, maxlength: 5000 },
    helpfulCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

discussionReplySchema.index({ discussionId: 1, createdAt: 1 })

export const DiscussionReply = mongoose.model<IDiscussionReply>(
  'DiscussionReply',
  discussionReplySchema,
)
