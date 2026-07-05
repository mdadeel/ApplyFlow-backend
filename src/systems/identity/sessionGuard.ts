import { Request, Response, NextFunction } from 'express'
import { verifyToken, SESSION_COOKIE } from './credentialManager'

export function sessionGuard(req: Request, res: Response, next: NextFunction): void {
  // Read the JWT from the httpOnly cookie (set on login/register).
  const token = req.cookies?.[SESSION_COOKIE]

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }

  req.userId = payload.userId
  next()
}
