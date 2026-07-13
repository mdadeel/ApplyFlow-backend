import { Router, Request, Response } from 'express'
import { Model } from 'mongoose'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'

const singular: Record<string, string> = {
  experiences: 'experience',
  projects: 'project',
  skills: 'skill',
  education: 'education',
  certificates: 'certificate',
  awards: 'award',
  publications: 'publication',
  volunteering: 'volunteering',
  languages: 'language',
  interests: 'interest',
}

export function createCrudRoutes<T>(path: string, model: Model<T>): Router {
  const key = singular[path] ?? path
  const router = Router()

  router.use(sessionGuard)

  router.get('/', async (req: Request, res: Response) => {
    const items = await model.find({ userId: req.userId }).sort({ createdAt: -1 })
    sendSuccess(res, items)
  })

  router.post('/', async (req: Request, res: Response) => {
    const item = await model.create({ ...req.body, userId: req.userId })
    sendSuccess(res, item, 201)
  })

  router.put('/:id', async (req: Request, res: Response) => {
    const item = await model.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body },
      { new: true, runValidators: true },
    )
    if (!item) throw new AppError(404, 'Not found')
    sendSuccess(res, item)
  })

  router.delete('/:id', async (req: Request, res: Response) => {
    const item = await model.findOneAndDelete({ _id: req.params.id, userId: req.userId })
    if (!item) throw new AppError(404, 'Not found')
    sendSuccess(res, { ok: true })
  })

  return router
}
