import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { sessionGuard } from '../identity/sessionGuard'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import {
  createWorkspaceSchema,
  generateContentSchema,
  analyzeSchema,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  generateContent,
  analyzeWorkspace,
  submitWorkspace,
  sendToResumeLibrary,
  exportWorkspace,
  createApplicationFromWorkspace,
  listUserWorkspaces,
} from './workspaceService'

const router = Router()

router.get('/', sessionGuard, async (req: Request, res: Response) => {
  const workspaces = await listUserWorkspaces(req.userId!)
  sendSuccess(res, workspaces)
})

router.get('/:id', sessionGuard, async (req: Request, res: Response) => {
  try {
    const workspace = await getWorkspace(String(req.params.id), req.userId!)
    sendSuccess(res, workspace)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Workspace not found')
  }
})

router.post('/', sessionGuard, async (req: Request, res: Response) => {
  const parsed = createWorkspaceSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  try {
    const workspace = await createWorkspace(parsed.data.opportunityId, req.userId!)
    sendSuccess(res, workspace, 201)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Opportunity not found')
  }
})

router.put('/:id', sessionGuard, async (req: Request, res: Response) => {
  try {
    const workspace = await updateWorkspace(String(req.params.id), req.userId!, req.body)
    sendSuccess(res, workspace)
  } catch (err) {
    const status = err instanceof Error && err.message.startsWith('Invalid status') ? 400 : 404
    throw new AppError(status, err instanceof Error ? err.message : 'Operation failed')
  }
})

router.delete('/:id', sessionGuard, async (req: Request, res: Response) => {
  try {
    const workspace = await deleteWorkspace(String(req.params.id), req.userId!)
    sendSuccess(res, workspace)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Workspace not found')
  }
})

router.post('/:id/generate', sessionGuard, async (req: Request, res: Response) => {
  const parsed = generateContentSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  try {
    const workspace = await generateContent(String(req.params.id), req.userId!, parsed.data.type)
    sendSuccess(res, workspace)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Workspace not found')
  }
})

router.post('/:id/analyze', sessionGuard, async (req: Request, res: Response) => {
  const parsed = analyzeSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid input: ' + parsed.error.message)
  }
  try {
    const workspace = await analyzeWorkspace(String(req.params.id), req.userId!, parsed.data.type)
    sendSuccess(res, workspace)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Workspace not found')
  }
})

router.post('/:id/submit', sessionGuard, async (req: Request, res: Response) => {
  try {
    const workspace = await submitWorkspace(String(req.params.id), req.userId!)
    sendSuccess(res, workspace)
  } catch (err) {
    const status = err instanceof Error && err.message.includes('status transition') ? 400 : 404
    throw new AppError(status, err instanceof Error ? err.message : 'Operation failed')
  }
})

router.post('/:id/send-to-resume-library', sessionGuard, async (req: Request, res: Response) => {
  try {
    await sendToResumeLibrary(String(req.params.id), req.userId!)
    sendSuccess(res, { success: true }, 201)
  } catch (err) {
    const status = err instanceof Error && err.message.includes('No tailored resume') ? 400 : 404
    throw new AppError(status, err instanceof Error ? err.message : 'Operation failed')
  }
})

router.post('/:id/export', sessionGuard, async (req: Request, res: Response) => {
  const parsed = z.object({
    format: z.enum(['pdf', 'docx', 'markdown']).default('pdf'),
  }).safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Invalid format')
  }
  try {
    const content = await exportWorkspace(String(req.params.id), req.userId!, parsed.data.format)
    sendSuccess(res, content)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Workspace not found')
  }
})

router.post('/:id/create-application', sessionGuard, async (req: Request, res: Response) => {
  try {
    const app = await createApplicationFromWorkspace(String(req.params.id), req.userId!)
    sendSuccess(res, app, 201)
  } catch (err) {
    throw new AppError(404, err instanceof Error ? err.message : 'Workspace not found')
  }
})

export default router
