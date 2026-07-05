import mongoose, { Schema, Document } from 'mongoose'

export interface ISkill extends Document {
  userId: string
  category: 'Frontend' | 'Backend' | 'Database' | 'Cloud' | 'Testing' | 'DevOps' | 'Languages' | 'Soft Skills'
  name: string
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
}

const skillSchema = new Schema<ISkill>({
  userId: { type: String, required: true, index: true },
  category: {
    type: String,
    required: true,
    enum: ['Frontend', 'Backend', 'Database', 'Cloud', 'Testing', 'DevOps', 'Languages', 'Soft Skills'],
  },
  name: { type: String, required: true },
  level: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
  },
}, { timestamps: true })

export const Skill = mongoose.model<ISkill>('Skill', skillSchema)
