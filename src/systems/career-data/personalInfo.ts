import { Router, Request, Response } from 'express'
import { User } from '../../models/User'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import { updatePersonalSchema } from '../../utils/validation'

const router = Router()

router.use(sessionGuard)

router.get('/', async (req: Request, res: Response) => {
  const user = await User.findById(req.userId).select('name email title summary phone location portfolio linkedIn github')
  if (!user) throw new AppError(404, 'User not found')
  sendSuccess(res, user.toJSON())
})

router.put('/', validate(updatePersonalSchema), async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(req.userId, { $set: req.body }, { new: true }).select('name email title summary phone location portfolio linkedIn github')
  if (!user) throw new AppError(404, 'User not found')
  sendSuccess(res, user.toJSON())
})

export { router as personalInfoRouter }
