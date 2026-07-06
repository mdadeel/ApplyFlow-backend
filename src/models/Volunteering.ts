import mongoose, { Schema, Document } from 'mongoose'

export interface IVolunteering extends Document {
  userId: string
  organization: string
  role: string
  startDate?: string
  endDate?: string
  current: boolean
  description?: string
  technologies?: string[]
  url?: string
  order: number
}

const volunteeringSchema = new Schema<IVolunteering>({
  userId: { type: String, required: true, index: true },
  organization: { type: String, required: true },
  role: { type: String, required: true },
  startDate: String,
  endDate: String,
  current: { type: Boolean, default: false },
  description: String,
  technologies: [{ type: String }],
  url: String,
  order: { type: Number, default: 0 },
}, { timestamps: true })

export const Volunteering = mongoose.model<IVolunteering>('Volunteering', volunteeringSchema)
