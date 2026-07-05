import mongoose, { Schema, Document } from 'mongoose'

export interface IExperience extends Document {
  userId: string
  company: string
  role: string
  startDate: string
  endDate?: string
  current: boolean
  responsibilities: string[]
  technologies: string[]
  achievements: string[]
  metrics: string[]
  projects: string[]
  links?: Array<{ displayText: string, url: string, platform: string }>
}

const experienceSchema = new Schema<IExperience>({
  userId: { type: String, required: true, index: true },
  company: { type: String, required: true },
  role: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: String,
  current: { type: Boolean, default: false },
  responsibilities: [{ type: String }],
  technologies: [{ type: String }],
  achievements: [{ type: String }],
  metrics: [{ type: String }],
  projects: [{ type: String }],
  links: [{
    displayText: String,
    url: String,
    platform: String
  }],
}, { timestamps: true })

export const Experience = mongoose.model<IExperience>('Experience', experienceSchema)
