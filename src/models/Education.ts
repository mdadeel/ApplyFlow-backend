import mongoose, { Schema, Document } from 'mongoose'

export interface IEducation extends Document {
  userId: string
  degree: string
  institution: string
  startDate: string
  endDate: string
  result: string
}

const educationSchema = new Schema<IEducation>({
  userId: { type: String, required: true, index: true },
  degree: { type: String, required: true },
  institution: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  result: String,
}, { timestamps: true })

export const Education = mongoose.model<IEducation>('Education', educationSchema)
