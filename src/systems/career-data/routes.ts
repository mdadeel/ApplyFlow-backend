import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { Experience } from '../../models/Experience'
import { Project } from '../../models/Project'
import { Skill } from '../../models/Skill'
import { Education } from '../../models/Education'
import { Certificate } from '../../models/Certificate'
import { Award } from '../../models/Award'
import { Publication } from '../../models/Publication'
import { Volunteering } from '../../models/Volunteering'
import { Language } from '../../models/Language'
import { Interest } from '../../models/Interest'
import { createCrudRoutes } from './crudFactory'
import { personalInfoRouter } from './personalInfo'
import { getFullProfile } from './profileService'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { extractTextFromPDF } from './pdfParser'
import { extractProfileFromPDF } from './pdfExtractor'
import resumeRoutes from './resumeRoutes'

const router = Router()

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new AppError(400, 'Only .pdf files are allowed'))
    }
  },
})

router.use('/experiences', createCrudRoutes('experiences', Experience))
router.use('/projects', createCrudRoutes('projects', Project))
router.use('/skills', createCrudRoutes('skills', Skill))
router.use('/education', createCrudRoutes('education', Education))
router.use('/certificates', createCrudRoutes('certificates', Certificate))
router.use('/awards', createCrudRoutes('awards', Award))
router.use('/publications', createCrudRoutes('publications', Publication))
router.use('/volunteering', createCrudRoutes('volunteering', Volunteering))
router.use('/languages', createCrudRoutes('languages', Language))
router.use('/interests', createCrudRoutes('interests', Interest))
router.use('/personal', personalInfoRouter)
router.use('/resumes', resumeRoutes)

router.get('/all', sessionGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getFullProfile(req.userId)
    if (!profile) {
      throw new AppError(404, 'Profile not found')
    }
    sendSuccess(res, profile)
  } catch (error) {
    next(error)
  }
})

router.post('/upload-pdf', sessionGuard, pdfUpload.single('resume'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file
    if (!file || !file.buffer) {
      throw new AppError(400, 'No file uploaded. Use field name "resume".')
    }

    let rawText: string
    try {
      rawText = await extractTextFromPDF(file.buffer)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse document'
      throw new AppError(400, `Failed to parse document: ${message}`)
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new AppError(400, 'Could not extract any text from the document.')
    }

    let extracted
    try {
      extracted = await extractProfileFromPDF(rawText)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI extraction failed'
      throw new AppError(500, `AI extraction failed: ${message}`)
    }

    sendSuccess(res, { extracted })
  } catch (error) {
    next(error)
  }
})

export default router
