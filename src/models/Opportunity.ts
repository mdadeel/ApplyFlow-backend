import mongoose, { Schema, Document } from 'mongoose'

export type LocationType = 'remote' | 'hybrid' | 'onsite' | 'unspecified'
export type RoleLevel = 'intern' | 'entry' | 'mid' | 'senior' | 'lead' | 'executive'
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'temporary'
export type SalaryInterval = 'yearly' | 'monthly' | 'hourly' | 'unspecified'
export type OpportunitySource = 'url' | 'manual' | 'email' | 'pdf' | 'screenshot' | 'linkedin' | 'career_page'
export type PipelineStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'review_needed'

export interface IOpportunity extends Document {
  title: string
  company: string
  location?: string
  locationType: LocationType
  description: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryInterval: SalaryInterval
  roleLevel?: RoleLevel
  employmentType?: EmploymentType
  requiredSkills: string[]
  preferredSkills: string[]
  minExperience?: number
  education?: string
  embedding?: number[]
  matchRefreshedAt?: Date
  matchCount: number
  averageMatchScore: number
  source: OpportunitySource
  sourceUrl?: string
  rawText?: string
  aiConfidence: number
  pipelineStatus: PipelineStatus
  pipelineError?: string
  totalContributions: number
  totalWorkspaces: number
  deadline?: Date
  isExpired: boolean
  isArchived: boolean
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const opportunitySchema = new Schema<IOpportunity>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    company: { type: String, required: true, trim: true, maxlength: 200 },
    location: { type: String, trim: true, maxlength: 200 },
    locationType: {
      type: String,
      enum: ['remote', 'hybrid', 'onsite', 'unspecified'],
      default: 'unspecified',
    },
    description: { type: String, required: true, maxlength: 50000 },
    salaryMin: { type: Number, min: 0 },
    salaryMax: {
      type: Number,
      min: 0,
      validate: {
        validator: function (this: IOpportunity, v: number) {
          return this.salaryMin === undefined || v >= this.salaryMin
        },
        message: 'salaryMax must be >= salaryMin',
      },
    },
    salaryCurrency: { type: String, default: 'USD', maxlength: 3 },
    salaryInterval: {
      type: String,
      enum: ['yearly', 'monthly', 'hourly', 'unspecified'],
      default: 'unspecified',
    },
    roleLevel: {
      type: String,
      enum: ['intern', 'entry', 'mid', 'senior', 'lead', 'executive'],
    },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship', 'temporary'],
    },
    requiredSkills: { type: [String], default: [], validate: (v: string[]) => v.length <= 50 },
    preferredSkills: { type: [String], default: [], validate: (v: string[]) => v.length <= 50 },
    minExperience: { type: Number, min: 0 },
    education: { type: String, maxlength: 200 },
    embedding: { type: [Number], default: undefined },
    matchRefreshedAt: { type: Date },
    matchCount: { type: Number, default: 0 },
    averageMatchScore: { type: Number, default: 0, min: 0, max: 1 },
    source: {
      type: String,
      enum: ['url', 'manual', 'email', 'pdf', 'screenshot', 'linkedin', 'career_page'],
      required: true,
    },
    sourceUrl: { type: String, maxlength: 2000 },
    rawText: { type: String, maxlength: 50000 },
    aiConfidence: { type: Number, default: 0, min: 0, max: 1 },
    pipelineStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'review_needed'],
      default: 'pending',
    },
    pipelineError: { type: String },
    totalContributions: { type: Number, default: 0 },
    totalWorkspaces: { type: Number, default: 0 },
    deadline: { type: Date },
    isExpired: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
)

opportunitySchema.index({ title: 'text', company: 'text', description: 'text' })
opportunitySchema.index({ requiredSkills: 1 })
opportunitySchema.index({ locationType: 1 })
opportunitySchema.index({ roleLevel: 1 })
opportunitySchema.index({ aiConfidence: -1, createdAt: -1 })
opportunitySchema.index({ isExpired: 1, deadline: 1 })
opportunitySchema.index({ createdAt: -1 })
opportunitySchema.index({ company: 1, title: 1 })
opportunitySchema.index({ pipelineStatus: 1, createdAt: -1 })
opportunitySchema.index({ locationType: 1, roleLevel: 1, employmentType: 1 })
opportunitySchema.index({ isExpired: 1, locationType: 1, roleLevel: 1 })
opportunitySchema.index({ salaryMin: 1, salaryMax: 1 })

export const Opportunity = mongoose.model<IOpportunity>('Opportunity', opportunitySchema)
