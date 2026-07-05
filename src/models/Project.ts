import mongoose, { Schema, Document } from 'mongoose'

export interface IProject extends Document {
  userId: string
  title: string
  description: string
  problem: string
  solution: string
  technologies: string[]
  features: string[]
  challenges: string[]
  outcome: string
  github: string
  demo: string
  tags: string[]
  links?: Array<{ displayText: string, url: string, platform: string }>
}

const projectSchema = new Schema<IProject>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  problem: String,
  solution: String,
  technologies: [{ type: String }],
  features: [{ type: String }],
  challenges: [{ type: String }],
  outcome: String,
  github: String,
  demo: String,
  tags: [{ type: String }],
  links: [{
    displayText: String,
    url: String,
    platform: String
  }],
}, { timestamps: true })

export const Project = mongoose.model<IProject>('Project', projectSchema)
