import mongoose, { Schema, Document } from 'mongoose'

export interface IInterviewPrep extends Document {
  userId: string
  applicationId: string
  questions: { question: string; type: string; answer?: string }[]
  answers?: { questionId: string; answer: string; practiced: boolean }[]
  companyResearch: string
  starAnswers: { question: string; star: { situation: string; task: string; action: string; result: string } }[]
  talkingPoints: string[]
  weakAreas: string[]
}

const interviewPrepSchema = new Schema<IInterviewPrep>({
  userId: { type: String, required: true, index: true },
  applicationId: { type: String, required: true, index: true },
  questions: [{
    question: String,
    type: { type: String },
    answer: String,
  }],
  answers: [{
    questionId: { type: String },
    answer: { type: String },
    practiced: { type: Boolean, default: false },
  }],
  companyResearch: String,
  starAnswers: [{
    question: String,
    star: {
      situation: String,
      task: String,
      action: String,
      result: String,
    },
  }],
  talkingPoints: [{ type: String }],
  weakAreas: [{ type: String }],
}, { timestamps: true })

export const InterviewPrep = mongoose.model<IInterviewPrep>('InterviewPrep', interviewPrepSchema)
