import { Router, Request, Response } from 'express'
import { Application } from '../../models/Application'
import { ResumeVersion } from '../../models/ResumeVersion'
import { Notification } from '../../models/Notification'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { canTransition, validTransitions, STATUS_DEFINITIONS } from './statusManager'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import {
  createApplicationSchema,
  updateApplicationSchema,
  addTimelineEntrySchema,
  analyzeJdSchema,
} from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

router.get('/statuses', (_req: Request, res: Response) => {
  sendSuccess(res, {
    statuses: STATUS_DEFINITIONS,
    transitions: Object.fromEntries(
      STATUS_DEFINITIONS.map((s) => [s.value, validTransitions(s.value)]),
    ),
  })
})

router.post('/auto-fill', validate(analyzeJdSchema), async (req: Request, res: Response) => {
  const { jdText } = req.body as { jdText: string }
  if (typeof jdText !== 'string' || jdText.trim().length === 0) {
    res.status(400).json({ error: 'jdText must be a non-empty string' })
    return
  }
  try {
    const ai = getAIProvider()
    const result = await ai.analyzeJD(jdText)
    sendSuccess(res, {
      company: result.company,
      role: result.role,
      requiredSkills: result.requiredSkills,
      keywords: result.keywords,
      atsTerms: result.atsTerms,
      summary: result.summary,
    })
  } catch {
    res.status(500).json({ error: 'Failed to analyze job description' })
  }
})

router.get('/', async (req: Request, res: Response) => {
  const { status, q, sort = '-createdAt', page = '1', limit = '20' } = req.query as Record<string, string>
  const filter: any = { userId: req.userId }
  if (status) filter.status = status
  if (q) filter.$or = [
    { company: { $regex: q, $options: 'i' } },
    { role: { $regex: q, $options: 'i' } },
  ]
  const skip = (parseInt(page) - 1) * parseInt(limit)
  const [items, total] = await Promise.all([
    Application.find(filter).sort(sort).skip(skip).limit(parseInt(limit)),
    Application.countDocuments(filter),
  ])
  sendSuccess(res, { applications: items, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
})

router.post('/', validate(createApplicationSchema), async (req: Request, res: Response) => {
  const app = await Application.create({ ...req.body, userId: req.userId, timeline: [{ event: 'Application created' }] })
  sendSuccess(res, app, 201)
})

router.get('/:id', async (req: Request, res: Response) => {
  const app = await Application.findOne({ _id: req.params.id, userId: req.userId })
  if (!app) throw new AppError(404, 'Not found')
  sendSuccess(res, app)
})

router.put('/:id', validate(updateApplicationSchema), async (req: Request, res: Response) => {
  const app = await Application.findOne({ _id: req.params.id, userId: req.userId })
  if (!app) throw new AppError(404, 'Not found')
  if (req.body.status && req.body.status !== app.status) {
    if (!canTransition(app.status, req.body.status)) {
      throw new AppError(400, `Cannot transition from ${app.status} to ${req.body.status}`, { validTransitions: validTransitions(app.status) })
    }
    app.timeline.push({ event: `Status changed to ${req.body.status}`, date: new Date() })
  }
  Object.assign(app, req.body)
  await app.save()
  if (req.body.status && req.body.status !== app.status) {
    const newStatus = String(req.body.status)
    const statusLabel = STATUS_DEFINITIONS.find((s) => s.value === newStatus)?.label ?? newStatus
    try {
      await Notification.create({
        userId: req.userId,
        type: 'status_change',
        title: `Application moved to ${statusLabel} at ${app.company}`,
        message: `Your application for ${app.role} at ${app.company} is now in ${statusLabel}.`,
        link: `/applications/${String(app._id)}`,
      })
    } catch (err) {
      console.error('Failed to create status-change notification:', err)
    }
  }
  sendSuccess(res, app)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const app = await Application.findOneAndDelete({ _id: req.params.id, userId: req.userId })
  if (!app) throw new AppError(404, 'Not found')
  sendSuccess(res, { ok: true })
})

router.post('/:id/timeline', validate(addTimelineEntrySchema), async (req: Request, res: Response) => {
  const app = await Application.findOne({ _id: req.params.id, userId: req.userId })
  if (!app) throw new AppError(404, 'Not found')
  app.timeline.push({ event: req.body.event, date: new Date(), notes: req.body.notes })
  await app.save()
  sendSuccess(res, app, 201)
})

router.get('/:id/versions', async (req: Request, res: Response) => {
  const versions = await ResumeVersion.find({ applicationId: req.params.id, userId: req.userId }).sort({ version: -1 })
  sendSuccess(res, versions)
})

export default router
