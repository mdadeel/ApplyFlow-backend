import mongoose, { Schema, Document } from 'mongoose'

export interface ILanguage extends Document {
  userId: string
  name: string
  proficiency: 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Basic'
}

const languageSchema = new Schema<ILanguage>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  proficiency: {
    type: String,
    enum: ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'],
    default: 'Intermediate',
  },
}, { timestamps: true })

export const Language = mongoose.model<ILanguage>('Language', languageSchema)
