import mongoose, { Schema, Document } from 'mongoose'

export interface IUserPreferences {
  aiProvider: 'openai' | 'anthropic' | 'gemini' | 'ollama'
  model: string
  temperature: number
  writingTone: 'professional' | 'concise' | 'technical' | 'recruiter-focused'
  defaultTemplate: 'minimal' | 'modern' | 'ats' | 'academic' | 'creative'
  defaultExportFormat: 'pdf' | 'docx' | 'md'
  notifications?: Record<string, boolean>
  apiKeys?: Record<string, string>
  twoFactorEnabled?: boolean
}

export interface IUser extends Document {
  email: string
  password?: string
  name: string
  authProvider: 'email' | 'google' | 'github' | 'linkedin'
  authProviderId?: string
  onboardingComplete: boolean
  preferences: IUserPreferences
  title?: string
  summary?: string
  phone?: string
  location?: string
  portfolio?: string
  linkedIn?: string
  github?: string
  connectedProviders: string[]
  communityReputation: number
  totalContributions: number
  preferredLocations: string[]
  preferredRoles: string[]
  minSalary?: number
  salaryCurrency: string
  openToRemote: boolean
  openToRelocation: boolean
  skills: string[]
  yearsOfExperience?: number
  currentRole?: string
  currentCompany?: string
  createdAt: Date
  updatedAt: Date
}

const userPreferencesSchema = new Schema<IUserPreferences>({
  aiProvider: { type: String, enum: ['openai', 'anthropic', 'gemini', 'ollama'], default: 'openai' },
  model: { type: String, default: 'gpt-4' },
  temperature: { type: Number, default: 0.7 },
  writingTone: { type: String, enum: ['professional', 'concise', 'technical', 'recruiter-focused'], default: 'professional' },
  defaultTemplate: { type: String, enum: ['minimal', 'modern', 'ats', 'academic', 'creative'], default: 'modern' },
  defaultExportFormat: { type: String, enum: ['pdf', 'docx', 'md'], default: 'pdf' },
  notifications: { type: Schema.Types.Mixed, default: () => ({}) },
  apiKeys: { type: Schema.Types.Mixed, default: () => ({}) },
  twoFactorEnabled: { type: Boolean, default: false },
}, { _id: false })

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },
  name: { type: String, required: true, trim: true },
  authProvider: { type: String, enum: ['email', 'google', 'github', 'linkedin'], default: 'email' },
  authProviderId: { type: String },
  onboardingComplete: { type: Boolean, default: false },
  preferences: { type: userPreferencesSchema, default: () => ({}) },
  title: { type: String, trim: true },
  summary: { type: String, trim: true },
  phone: { type: String, trim: true },
  location: { type: String, trim: true },
  portfolio: { type: String, trim: true },
  linkedIn: { type: String, trim: true },
  github: { type: String, trim: true },
  connectedProviders: { type: [String], default: () => [] },
  communityReputation: { type: Number, default: 0 },
  totalContributions: { type: Number, default: 0 },
  preferredLocations: { type: [String], default: () => [] },
  preferredRoles: { type: [String], default: () => [] },
  minSalary: { type: Number, min: 0 },
  salaryCurrency: { type: String, default: 'USD', maxlength: 3 },
  openToRemote: { type: Boolean, default: true },
  openToRelocation: { type: Boolean, default: false },
  skills: { type: [String], default: () => [] },
  yearsOfExperience: { type: Number, min: 0 },
  currentRole: { type: String, trim: true, maxlength: 200 },
  currentCompany: { type: String, trim: true, maxlength: 200 },
}, { timestamps: true })

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password
    // Never leak encrypted user API keys to the client.
    if (ret.preferences && typeof ret.preferences === 'object') {
      const prefs = ret.preferences as unknown as Record<string, unknown>
      delete prefs.apiKeys
    }
    return ret
  },
})

export const User = mongoose.model<IUser>('User', userSchema)
