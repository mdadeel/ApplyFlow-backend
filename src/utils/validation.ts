import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const googleAuthSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
})

export const githubAuthSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
})

export const preferencesSchema = z.object({
  aiProvider: z.enum(['openai', 'anthropic', 'gemini']).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  writingTone: z.enum(['professional', 'concise', 'technical', 'recruiter-focused']).optional(),
  defaultTemplate: z.enum(['minimal', 'modern', 'ats', 'academic', 'creative']).optional(),
  defaultExportFormat: z.enum(['pdf', 'docx', 'md']).optional(),
  notifications: z.record(z.boolean()).optional(),
  apiKeys: z.record(z.string()).optional(),
})

export const saveApiKeySchema = z.object({
  provider: z.string().min(1, 'Provider is required').max(100),
  key: z.string().min(1, 'API key is required').max(2000),
})

// ── Application Management ──────────────────────────────────────────

export const createApplicationSchema = z.object({
  company: z.string().min(1, 'Company is required').max(200),
  role: z.string().min(1, 'Role is required').max(200),
  jdText: z.string().optional(),
  status: z.enum(['draft', 'analyzing', 'planning', 'generating', 'reviewing', 'ready', 'exported', 'applied', 'interview', 'assessment', 'offer', 'rejected', 'ghosted']).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const updateApplicationSchema = z.object({
  company: z.string().min(1).max(200).optional(),
  role: z.string().min(1).max(200).optional(),
  jdText: z.string().optional(),
  jdAnalysisId: z.string().optional(),
  status: z.enum(['draft', 'analyzing', 'planning', 'generating', 'reviewing', 'ready', 'exported', 'applied', 'interview', 'assessment', 'offer', 'rejected', 'ghosted']).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  scores: z.object({ ats: z.number().optional(), match: z.number().optional(), overall: z.number().optional() }).optional(),
})

export const addTimelineEntrySchema = z.object({
  event: z.string().min(1, 'Event description is required').max(500),
  notes: z.string().optional(),
})

// ── Job Intelligence ────────────────────────────────────────────────

export const analyzeJdSchema = z.object({
  jdText: z.string().min(1, 'Job description text is required').max(50000),
})

// ── Content Generation ──────────────────────────────────────────────

export const generateEmailSchema = z.object({
  jdAnalysis: z.record(z.unknown()).refine(v => Object.keys(v).length > 0, 'jdAnalysis is required'),
  profile: z.record(z.unknown()).optional(),
  tone: z.string().optional(),
})

export const generateCoverLetterSchema = z.object({
  jdAnalysis: z.record(z.unknown()).refine(v => Object.keys(v).length > 0, 'jdAnalysis is required'),
  profile: z.record(z.unknown()).optional(),
})

export const humanizeTextSchema = z.object({
  text: z.string().min(1, 'Text is required'),
})

// ── Document Validation ─────────────────────────────────────────────

export const validateResumeSchema = z.object({
  resumeVersionId: z.string().min(1, 'resumeVersionId is required'),
})

// ── Interview Intelligence ──────────────────────────────────────────

export const generateInterviewPrepSchema = z.object({
  applicationId: z.string().min(1, 'applicationId is required'),
  jdAnalysis: z.record(z.unknown()).optional(),
  profile: z.record(z.unknown()).optional(),
})

export const generateStarSchema = z.object({
  experience: z.string().min(1, 'Experience description is required'),
  question: z.string().min(1, 'Interview question is required'),
})

export const saveAnswerSchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
  answer: z.string(),
})

export const markPracticedSchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
  practiced: z.boolean(),
})

// ── Resume ──────────────────────────────────────────────────────────

export const generateResumeSchema = z.object({
  applicationId: z.string().optional(),
  strategy: z.record(z.unknown()).optional(),
  template: z.enum(['minimal', 'modern', 'ats', 'academic', 'creative']).optional(),
  profile: z.record(z.unknown()).optional(),
  jdAnalysis: z.record(z.unknown()).optional(),
  jdKeywords: z.array(z.string()).optional(),
})

export const generateStrategySchema = z.object({
  jdKeywords: z.array(z.string()).optional(),
  requiredSkills: z.array(z.string()).optional(),
})

// ── Export ──────────────────────────────────────────────────────────

export const exportResumeSchema = z.object({
  resumeVersionId: z.string().min(1, 'resumeVersionId is required'),
  format: z.enum(['pdf', 'docx', 'md']).optional(),
  company: z.string().optional(),
  role: z.string().optional(),
})

export const exportEmailSchema = z.object({
  subject: z.string().optional(),
  body: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  format: z.enum(['txt', 'md', 'pdf']).optional(),
})

export const exportCoverLetterSchema = z.object({
  content: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  format: z.enum(['txt', 'md', 'pdf']).optional(),
})

// ── Learning ────────────────────────────────────────────────────────

export const feedbackSchema = z.object({
  section: z.string().min(1, 'Section is required'),
  original: z.string().min(1, 'Original text is required'),
  edited: z.string().min(1, 'Edited text is required'),
})

// ── Personal Info ───────────────────────────────────────────────────

export const updatePersonalSchema = z.object({
  name: z.string().optional(),
  fullName: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  location: z.string().optional(),
  phone: z.string().optional(),
  portfolio: z.string().optional(),
  linkedIn: z.string().optional(),
  github: z.string().optional(),
})
