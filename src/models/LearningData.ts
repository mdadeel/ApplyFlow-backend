import mongoose, { Schema, Document } from 'mongoose'

export interface ILearningData extends Document {
  userId: string
  preferredVerbs: Map<string, number>
  removedPhrases: string[]
  domainOrdering: Map<string, string[]>
  editHistory: { section: string; original: string; edited: string; timestamp: Date }[]
  shorterSummaries: boolean
}

const learningDataSchema = new Schema<ILearningData>({
  userId: { type: String, required: true, unique: true, index: true },
  preferredVerbs: { type: Map, of: Number, default: {} },
  removedPhrases: [{ type: String }],
  domainOrdering: { type: Map, of: [String], default: {} },
  editHistory: [{
    section: String,
    original: String,
    edited: String,
    timestamp: { type: Date, default: Date.now },
  }],
  shorterSummaries: { type: Boolean, default: false },
}, { timestamps: true })

export const LearningData = mongoose.model<ILearningData>('LearningData', learningDataSchema)
