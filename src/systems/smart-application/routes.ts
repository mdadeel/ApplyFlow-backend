// Smart Application Routes

import { Router, Request, Response } from 'express'
import multer from 'multer'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { getSmartApplicationService } from './index'
import { UploadedResume } from '../../models/UploadedResume'
import { z } from 'zod'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimetype === 'text/csv') {
      cb(null, true)
    } else {
      cb(new AppError(400, 'Only PDF, DOCX, and CSV files are allowed'))
    }
  }
})

// Input validation schemas
const singleCreateSchema = z.object({
  jdText: z.string().min(50).max(50000),
  company: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  masterCVText: z.string().max(100000).optional(),
  resumeId: z.string().optional()
})

const bulkItemSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  jdText: z.string().min(50).max(50000)
})

const bulkCreateSchema = z.object({
  jds: z.array(bulkItemSchema).min(1).max(50),
  masterCVText: z.string().max(100000).optional(),
  resumeId: z.string().optional()
})

/**
 * Helper: resolve masterCVText from file upload, body text, or uploaded resume
 */
async function resolveMasterCVText(req: Request, userId: string): Promise<string | undefined> {
  if (req.file) {
    if (req.file.mimetype === 'application/pdf') {
      const { extractTextFromPDF } = await import('../../systems/career-data/pdfParser')
      return extractTextFromPDF(req.file.buffer)
    }
    if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const { extractTextFromDOCX } = await import('../../systems/career-data/docxParser')
      return extractTextFromDOCX(req.file.buffer)
    }
  }
  if (req.body.masterCVText) return req.body.masterCVText
  if (req.body.resumeId) {
    const resume = await UploadedResume.findOne({ _id: req.body.resumeId, userId })
    if (resume) return resume.rawText
  }
  return undefined
}

/**
 * POST /api/v1/applications/smart-create
 * Create a complete application package from a single JD
 */
router.post(
  '/smart-create',
  sessionGuard,
  upload.single('masterCV'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!

      // Parse form data
      const jdText = req.body.jdText
      const company = req.body.company
      const role = req.body.role
      const resumeId = req.body.resumeId

      if (!jdText || typeof jdText !== 'string') {
        throw new AppError(400, 'jdText is required')
      }

      // Validate input
      const validation = singleCreateSchema.safeParse({ jdText, company, role, resumeId })
      if (!validation.success) {
        throw new AppError(400, `Invalid input: ${validation.error.message}`)
      }

      // Get master CV text from file, body text, or uploaded resume
      const masterCVText = await resolveMasterCVText(req, userId)

      const service = getSmartApplicationService()

      const result = await service.createApplication({
        userId,
        jdText: validation.data.jdText,
        company: validation.data.company,
        role: validation.data.role,
        masterCVText
      })

      sendSuccess(res, result, 201)
    } catch (err) {
      if (err instanceof AppError) throw err
      console.error('Smart create error:', err)
      throw new AppError(500, 'Failed to create application')
    }
  }
)

/**
 * POST /api/v1/applications/bulk-create
 * Create multiple applications from multiple JDs
 */
router.post(
  '/bulk-create',
  sessionGuard,
  upload.single('masterCV'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!

      let jds: Array<{ company: string; role: string; jdText: string }>

      // Parse JDs from body or file
      if (req.body.jds) {
        if (Array.isArray(req.body.jds)) {
          jds = req.body.jds
        } else if (typeof req.body.jds === 'string') {
          try {
            jds = JSON.parse(req.body.jds)
          } catch {
            throw new AppError(400, 'jds must be valid JSON array')
          }
        } else {
          throw new AppError(400, 'jds must be an array or valid JSON array string')
        }
      } else if (req.file && req.file.mimetype === 'text/csv') {
        // Parse CSV
        const csvText = req.file.buffer.toString('utf-8')
        const lines = csvText.trim().split('\n')
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

        const companyIdx = headers.findIndex(h => h === 'company' || h === 'company name')
        const roleIdx = headers.findIndex(h => h === 'role' || h === 'position' || h === 'job title')
        const jdIdx = headers.findIndex(h => h === 'jd_text' || h === 'job description' || h === 'jd' || h === 'description')

        if (companyIdx === -1 || roleIdx === -1 || jdIdx === -1) {
          throw new AppError(400, 'CSV must have columns: company, role, jd_text (or job_description)')
        }

        jds = lines.slice(1).map(line => {
          const cols = line.split(',')
          return {
            company: cols[companyIdx]?.trim() || '',
            role: cols[roleIdx]?.trim() || '',
            jdText: cols[jdIdx]?.trim() || ''
          }
        }).filter(j => j.company && j.role && j.jdText)
      } else {
        throw new AppError(400, 'Provide jds array in body or upload CSV file')
      }

      if (jds.length === 0) {
        throw new AppError(400, 'No valid JDs provided')
      }

      // Validate
      const validation = bulkCreateSchema.safeParse({ jds })
      if (!validation.success) {
        throw new AppError(400, `Invalid JDs: ${validation.error.message}`)
      }

      // Get master CV text from file, body text, or uploaded resume
      const masterCVText = await resolveMasterCVText(req, userId)

      const service = getSmartApplicationService()

      const result = await service.createBulkApplications({
        userId,
        jds: validation.data.jds,
        masterCVText
      })

      sendSuccess(res, result, 201)
    } catch (err) {
      if (err instanceof AppError) throw err
      console.error('Bulk create error:', err)
      throw new AppError(500, 'Failed to create bulk applications')
    }
  }
)

/**
 * GET /api/v1/applications/:id/export-all
 * Export all formats for an application
 */
router.get(
  '/:id/export-all',
  sessionGuard,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!
      const { id } = req.params
      const formats = (req.query.formats as string)?.split(',') || ['pdf', 'docx', 'md']

      const { Application } = await import('../../models/Application')
      const app = await Application.findOne({ _id: id, userId })

      if (!app) {
        throw new AppError(404, 'Application not found')
      }

      // Get career profile for export
      const { getFullProfile } = await import('../../systems/career-data/profileService')
      const careerProfile = await getFullProfile(userId)

      if (!careerProfile) {
        throw new AppError(400, 'Career profile not found')
      }

      const { exportManager } = await import('./exportManager')
      const { ResponseParser } = await import('./responseParser')

      // Reconstruct output from stored data
      const output = {
        analysis: {
          company: app.company,
          role: app.role,
          // ... other fields would need to be stored or reconstructed
        },
        resume: {
          markdown: '', // Would need to be stored
        },
        email: app.emailContent || { subject: '', body: '', tone: 'professional' },
        coverLetter: app.coverLetterContent || '',
        validationHints: {
          atsKeywordsToInclude: [],
          truthFlags: [],
          humanizationTips: []
        }
      }

      const scores = {
        ats: app.scores?.ats ?? 0,
        match: app.scores?.match ?? 0,
        overall: app.scores?.overall ?? 0,
      }

      const files = await exportManager.exportApplication(
        { applicationId: app._id.toString(), output: output as any, scores },
        careerProfile,
        formats as ('pdf' | 'docx' | 'md')[]
      )

      // Update export history
      for (const format of formats) {
        app.exportHistory.push({ format, exportedAt: new Date() })
      }
      await app.save()

      sendSuccess(res, { files })
    } catch (err) {
      if (err instanceof AppError) throw err
      console.error('Export all error:', err)
      throw new AppError(500, 'Failed to export application')
    }
  }
)

export default router