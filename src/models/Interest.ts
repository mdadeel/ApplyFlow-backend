import mongoose, { Schema, Document } from 'mongoose'

export interface IInterest extends Document {
  userId: string
  name: string
  category?: string
}

const interestSchema = new Schema<IInterest>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  category: String,
}, { timestamps: true })

export const Interest = mongoose.model<IInterest>('Interest', interestSchema)
