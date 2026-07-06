import mongoose, { Schema, Document } from 'mongoose'

export type ApplicationStatus =
  | 'draft' | 'analyzing' | 'planning' | 'generating'
  | 'reviewing' | 'ready' | 'exported' | 'applied'
  | 'interview' | 'assessment' | 'offer' | 'rejected' | 'ghosted'

export interface ITimelineEvent {
  event: string
  date: Date
  notes?: string
}

export interface ITask {
  id: string
  type: 'tailor_resume' | 'generate_email' | 'send_email' | 'apply' | 'follow_up' | 'interview' | 'custom'
  title: string
  completed: boolean
  dueDate?: Date
  completedAt?: Date
  notes?: string
}

export type TrackerTaskStatus = 'todo' | 'in_progress' | 'done'
export type TrackerTaskPriority = 'low' | 'medium' | 'high'

export interface ITrackerTask {
  _id: mongoose.Types.ObjectId
  title: string
  description?: string
  status: TrackerTaskStatus
  priority: TrackerTaskPriority
  dueDate?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IApplication extends Document {
  userId: string
  company: string
  role: string
  jdText?: string
  jdAnalysisId?: string
  strategyId?: string
  resumeVersionId?: string
  emailContent?: { subject: string; body: string; tone: string }
  coverLetterContent?: string
  status: ApplicationStatus
  timeline: ITimelineEvent[]
  notes: string
  tags: string[]
  exportHistory: { format: string; exportedAt: Date }[]
  scores?: { ats?: number; match?: number; overall?: number }

  // Smart workflow fields
  exportFolder?: string
  tasks?: ITask[]
  isBulkGenerated?: boolean
  bulkJobId?: string

  // S4 Task Tracker (free-form per-application tasks; distinct from workflow `tasks`)
  trackerTasks?: ITrackerTask[]

  // Truth audit trail
  truthProvenance?: Array<{
    claim: string
    sourceType: 'experience' | 'project' | 'skill' | 'education' | 'certificate'
    sourceId: string
    field: string
  }>
  refinementHistory?: Array<{
    pass: number
    changes: string[]
    timestamp: Date
  }>
}

const applicationSchema = new Schema<IApplication>({
  userId: { type: String, required: true, index: true },
  company: { type: String, required: true },
  role: { type: String, required: true },
  jdText: String,
  jdAnalysisId: String,
  strategyId: String,
  resumeVersionId: String,
  emailContent: {
    subject: String,
    body: String,
    tone: String,
  },
  coverLetterContent: String,
  status: {
    type: String,
    enum: ['draft', 'analyzing', 'planning', 'generating', 'reviewing', 'ready', 'exported', 'applied', 'interview', 'assessment', 'offer', 'rejected', 'ghosted'],
    default: 'draft',
  },
  timeline: [{
    event: String,
    date: { type: Date, default: Date.now },
    notes: String,
  }],
  notes: { type: String, default: '' },
  tags: [{ type: String }],
  exportHistory: [{
    format: String,
    exportedAt: { type: Date, default: Date.now },
  }],
  scores: {
    ats: Number,
    match: Number,
    overall: Number,
  },
  // Smart workflow fields
  exportFolder: String,
  tasks: [{
    id: String,
    type: { type: String, enum: ['tailor_resume', 'generate_email', 'send_email', 'apply', 'follow_up', 'interview', 'custom'] },
    title: String,
    completed: { type: Boolean, default: false },
    dueDate: Date,
    completedAt: Date,
    notes: String,
  }],
  isBulkGenerated: { type: Boolean, default: false },
  bulkJobId: String,
  // Truth audit trail
  truthProvenance: [{
    claim: String,
    sourceType: { type: String, enum: ['experience', 'project', 'skill', 'education', 'certificate'] },
    sourceId: Schema.Types.ObjectId,
    field: String,
  }],
  refinementHistory: [{
    pass: Number,
    changes: [{ type: String }],
    timestamp: { type: Date, default: Date.now },
  }],
  // S4 Task Tracker sub-document array
  trackerTasks: [{
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    dueDate: { type: Date },
    completedAt: { type: Date },
  }],
}, { timestamps: true })

// Compound index for folder queries
applicationSchema.index({ userId: 1, company: 1 })

export const Application = mongoose.model<IApplication>('Application', applicationSchema)