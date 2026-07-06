import mongoose, { Schema, Document } from 'mongoose'

export interface IPublication extends Document {
  userId: string
  title: string
  publisher: string
  date?: string
  url?: string
  description?: string
  authors?: string[]
  order: number
}

const publicationSchema = new Schema<IPublication>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  publisher: { type: String, required: true },
  date: String,
  url: String,
  description: String,
  authors: [{ type: String }],
  order: { type: Number, default: 0 },
}, { timestamps: true })

export const Publication = mongoose.model<IPublication>('Publication', publicationSchema)
