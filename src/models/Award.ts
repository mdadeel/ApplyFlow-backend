import mongoose, { Schema, Document } from 'mongoose'

export interface IAward extends Document {
  userId: string
  title: string
  issuer: string
  date?: string
  description?: string
  url?: string
  order: number
}

const awardSchema = new Schema<IAward>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  issuer: { type: String, required: true },
  date: String,
  description: String,
  url: String,
  order: { type: Number, default: 0 },
}, { timestamps: true })

export const Award = mongoose.model<IAward>('Award', awardSchema)
