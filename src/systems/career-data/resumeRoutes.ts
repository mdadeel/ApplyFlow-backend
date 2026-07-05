import { Router, Request, Response } from 'express'
import multer from 'multer'
import { UploadedResume } from '../../models/UploadedResume'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { extractTextFromDOCX } from './docxParser'
import { extractTextFromPDF } from './pdfParser'
import { extractProfileFromPDF } from './pdfExtractor'

const router = Router()
router.use(sessionGuard)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf', // .pdf
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ]
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new AppError(400, 'Only .pdf, .docx and .doc files are allowed'))
    }
  },
})

// Upload a resume (DOCX or DOC) → extract text → AI parse → save
router.post(
  '/upload',
  upload.single('resume'),
  async (req: Request, res: Response) => {
    const file = (req as any).file
    if (!file || !file.buffer) {
      throw new AppError(400, 'No file uploaded. Use field name "resume".')
    }

    const fileName = file.originalname.replace(/\.[^/.]+$/, '') // strip extension for display
    let fileType: 'docx' | 'doc' | 'pdf' = 'docx'
    if (file.mimetype === 'application/msword') fileType = 'doc'
    if (file.mimetype === 'application/pdf') fileType = 'pdf'

    // Extract raw text from the document
    let rawText: string
    try {
      if (fileType === 'pdf') {
        rawText = await extractTextFromPDF(file.buffer)
      } else {
        rawText = await extractTextFromDOCX(file.buffer)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse document'
      throw new AppError(400, `Failed to parse document: ${message}`)
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new AppError(400, 'Could not extract any text from the document.')
    }

    // AI extraction
    let extracted
    try {
      extracted = await extractProfileFromPDF(rawText)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI extraction failed'
      throw new AppError(500, `AI extraction failed: ${message}`)
    }

    // Build content object matching UploadedResume schema
    const content = {
      summary: extracted.personal?.summary || '',
      experiences: extracted.experiences.map(e => ({
        company: e.company,
        role: e.role,
        startDate: e.startDate,
        endDate: e.endDate || '',
        current: e.current,
        responsibilities: e.responsibilities,
        technologies: e.technologies,
        achievements: e.achievements,
        metrics: e.metrics,
      })),
      projects: extracted.projects.map(p => ({
        title: p.title,
        description: p.description,
        technologies: p.technologies,
        features: p.features,
        outcome: p.outcome || '',
      })),
      skills: extracted.skills.map(s => ({
        name: s.name,
        category: s.category,
        level: s.level,
      })),
      education: extracted.education.map(e => ({
        degree: e.degree,
        institution: e.institution,
        startDate: e.startDate,
        endDate: e.endDate,
        result: e.result || '',
      })),
      certificates: extracted.certificates.map(c => ({
        name: c.name,
        issuer: c.issuer,
        date: c.date,
        url: c.url || '',
      })),
    }

    // Save to database
    const resume = await UploadedResume.create({
      userId: req.userId,
      fileName,
      fileType,
      rawText,
      content,
    })

    sendSuccess(res, { resume }, 201)
  },
)

// List all uploaded resumes (summary only)
router.get('/', async (req: Request, res: Response) => {
  const resumes = await UploadedResume.find({ userId: req.userId })
    .select('fileName fileType createdAt')
    .sort({ createdAt: -1 })
    .lean()

  sendSuccess(res, { resumes })
})

// Get full resume details with all sections
router.get('/:id', async (req: Request, res: Response) => {
  const resume = await UploadedResume.findOne({ _id: req.params.id, userId: req.userId })
  if (!resume) throw new AppError(404, 'Resume not found')
  sendSuccess(res, { resume })
})

// Delete a resume
router.delete('/:id', async (req: Request, res: Response) => {
  const result = await UploadedResume.deleteOne({ _id: req.params.id, userId: req.userId })
  if (result.deletedCount === 0) throw new AppError(404, 'Resume not found')
  sendSuccess(res, { deleted: true })
})

// Update upload route to also accept the multer error handler
router.use((err: any, _req: Request, res: Response, next: any) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'File size exceeds 10 MB limit.' })
    return
  }
  next(err)
})

export default router
