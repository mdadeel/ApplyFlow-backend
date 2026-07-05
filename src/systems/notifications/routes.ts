import { Router, Request, Response } from 'express'
import { Notification } from '../../models/Notification'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'

const router = Router()
router.use(sessionGuard)

// GET /api/notifications — list active (not dismissed) notifications for the user, newest first, with unread count
router.get('/', async (req: Request, res: Response) => {
  const baseFilter = { userId: req.userId, dismissed: false }
  const [items, unreadCount] = await Promise.all([
    Notification.find(baseFilter).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ ...baseFilter, read: false }),
  ])
  sendSuccess(res, { items, unreadCount })
})

// PUT /api/notifications/:id/read — mark a single notification as read
router.put('/:id/read', async (req: Request, res: Response) => {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { $set: { read: true } },
    { new: true },
  )
  if (!item) throw new AppError(404, 'Notification not found')
  sendSuccess(res, item)
})

// PUT /api/notifications/:id/dismiss — mark a notification as dismissed
router.put('/:id/dismiss', async (req: Request, res: Response) => {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { $set: { dismissed: true } },
    { new: true },
  )
  if (!item) throw new AppError(404, 'Notification not found')
  sendSuccess(res, item)
})

// PUT /api/notifications/read-all — mark every active notification as read
router.put('/read-all', async (req: Request, res: Response) => {
  await Notification.updateMany(
    { userId: req.userId, dismissed: false, read: false },
    { $set: { read: true } },
  )
  sendSuccess(res, { ok: true })
})

export default router
