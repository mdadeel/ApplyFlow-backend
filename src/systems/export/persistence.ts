import { Router, Request, Response } from 'express'
import { ExportRecord } from '../../models/ExportRecord'
import { sessionGuard } from '../identity/sessionGuard'

const router = Router()
router.use(sessionGuard)

router.get('/', async (req: Request, res: Response) => {
  const { applicationId } = req.query
  const filter: Record<string, unknown> = { userId: req.userId }
  if (applicationId) filter.applicationId = applicationId
  const records = await ExportRecord.find(filter).sort({ createdAt: -1 }).lean()
  res.json({ data: records })
})

router.post('/', async (req: Request, res: Response) => {
  const { applicationId, type, content, subject, format, fileName } = req.body
  if (!applicationId || !type || !content || !format || !fileName) {
    res.status(400).json({ error: 'Missing required fields: applicationId, type, content, format, fileName' })
    return
  }
  const record = await ExportRecord.create({
    userId: req.userId,
    applicationId,
    type,
    content,
    subject,
    format,
    fileName,
  })
  res.status(201).json({ data: record })
})

router.delete('/:id', async (req: Request, res: Response) => {
  const record = await ExportRecord.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId,
  })
  if (!record) {
    res.status(404).json({ error: 'Export record not found' })
    return
  }
  res.json({ data: record })
})

export default router
