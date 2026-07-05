import mongoose, { Schema, Document } from 'mongoose'

export type NotificationType =
  | 'status_change'
  | 'interview_reminder'
  | 'feature'
  | 'system'

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId
  type: NotificationType
  title: string
  message: string
  read: boolean
  dismissed: boolean
  link?: string
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['status_change', 'interview_reminder', 'feature', 'system'],
      required: true,
      default: 'system',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    dismissed: { type: Boolean, default: false },
    link: { type: String },
  },
  { timestamps: true },
)

notificationSchema.index({ userId: 1, dismissed: 1, createdAt: -1 })

export const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema,
)
