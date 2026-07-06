import { Router, Request, Response } from 'express'
import { ResumeVersion } from '../../models/ResumeVersion'
import { ValidationReport } from '../../models/ValidationReport'
import { sessionGuard } from '../identity/sessionGuard'
import { generateMarkdown } from './markdownGenerator'
import { generateDocx } from './docxGenerator'
import { generateResumePDF, generateDocumentPDF } from './pdfGenerator'
import { buildFileName } from './fileNamer'
import { AppError } from '../../middleware/errorHandler'
import { validate } from '../../middleware/validate'
import { exportResumeSchema, exportEmailSchema, exportCoverLetterSchema } from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

type ResumeFormat = 'pdf' | 'docx' | 'md'
type DocFormat = 'txt' | 'md' | 'pdf'

function extensionFor(format: string): string {
  if (format === 'markdown') return 'md'
  return format
}

router.post('/resume', validate(exportResumeSchema), async (req: Request, res: Response) => {
  const { resumeVersionId, applicationId, format = 'pdf', company = '', role = '' } = req.body
  let version
  if (resumeVersionId) {
    version = await ResumeVersion.findOne({ _id: resumeVersionId, userId: req.userId })
  } else if (applicationId) {
    version = await ResumeVersion.findOne({ applicationId, userId: req.userId }).sort({ createdAt: -1 })
  }
  if (!version) throw new AppError(404, 'Resume version not found')
  const report = await ValidationReport.findOne({ resumeVersionId, userId: req.userId }).sort({ createdAt: -1 })
  if (report?.blocked) throw new AppError(400, 'Export blocked: validation failed', { report })
  const user = req as any
  const name = user.user?.name || 'Applicant'
  const resumeFormat = format as ResumeFormat
  const ext = extensionFor(resumeFormat)
  const fileName = buildFileName(name, role, company, ext)

  if (resumeFormat === 'docx') {
    const buffer = await generateDocx(version.content)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(buffer)
  } else if (resumeFormat === 'pdf') {
    const buffer = await generateResumePDF(version.content, name)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(buffer)
  } else {
    const md = generateMarkdown(version.content)
    res.setHeader('Content-Type', 'text/markdown')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(md)
  }
})

router.post('/email', validate(exportEmailSchema), async (req: Request, res: Response) => {
  const { subject, body, company = '', role = '', format = 'pdf' } = req.body
  const docFormat = format as DocFormat
  const ext = extensionFor(docFormat)
  const name = 'Applicant'
  const fileName = buildFileName(name, role, company, ext)
  const plain = `Subject: ${subject || ''}\n\n${body || ''}`

  if (docFormat === 'pdf') {
    const buffer = await generateDocumentPDF(subject || 'Application Email', body || '')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(buffer)
  } else if (docFormat === 'md') {
    const md = `# ${subject || 'Application Email'}\n\n${body || ''}\n`
    res.setHeader('Content-Type', 'text/markdown')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(md)
  } else {
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(plain)
  }
})

router.post('/cover-letter', validate(exportCoverLetterSchema), async (req: Request, res: Response) => {
  const { content, company = '', role = '', format = 'pdf' } = req.body
  const docFormat = format as DocFormat
  const ext = extensionFor(docFormat)
  const name = 'Applicant'
  const fileName = buildFileName(name, `Cover-Letter-${role}`, company, ext)
  const body = content || ''

  if (docFormat === 'pdf') {
    const buffer = await generateDocumentPDF(`Cover Letter — ${role || 'Position'}${company ? ` @ ${company}` : ''}`, body)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(buffer)
  } else if (docFormat === 'md') {
    const md = `# Cover Letter — ${role || 'Position'}${company ? ` @ ${company}` : ''}\n\n${body}\n`
    res.setHeader('Content-Type', 'text/markdown')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(md)
  } else {
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(body)
  }
})

export default router
