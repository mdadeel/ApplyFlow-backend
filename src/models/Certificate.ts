import mongoose, { Schema, Document } from 'mongoose'

export interface ICertificate extends Document {
  userId: string
  name: string
  issuer: string
  date: string
  url?: string
}

const certificateSchema = new Schema<ICertificate>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  issuer: { type: String, required: true },
  date: { type: String, required: true },
  url: String,
}, { timestamps: true })

export const Certificate = mongoose.model<ICertificate>('Certificate', certificateSchema)
