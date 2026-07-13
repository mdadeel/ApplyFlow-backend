import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

/**
 * Cookie name for the CSRF token.
 * This cookie is NOT httpOnly so that the frontend JS can read it.
 */
export const CSRF_COOKIE = 'af_csrf'

/**
 * Name of the custom header the frontend must send with state-changing requests.
 */
const CSRF_HEADER = 'x-csrf-token'

/**
 * Path prefixes that are EXEMPT from CSRF protection.
 * These are routes the user hits before they have a CSRF token:
 * - Auth session creation (login, register, dev-login)
 * - OAuth authentication (google, github)
 * - Password reset / email verification (forgot-password, reset-password, verify-email)
 * The session cookie already has sameSite: 'strict' for these routes.
 */
const CSRF_EXEMPT_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/dev-login',
  '/api/auth/google',
  '/api/auth/github',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
]

function isExemptFromCsrf(req: Request): boolean {
  // Use originalUrl — req.path is relative to the mount point when middleware
  // is mounted with a path prefix (e.g., app.use('/api', ...) makes /api/auth/login → /auth/login)
  return CSRF_EXEMPT_PREFIXES.some(prefix => req.originalUrl.startsWith(prefix))
}

/**
 * Generate a cryptographically random CSRF token.
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// ── Cookie options (matching session cookie security level) ─────────

function csrfCookieOptions() {
  return {
    httpOnly: false,        // Must be readable by frontend JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches session)
  }
}

// ── Middleware: ensure a CSRF token cookie exists ───────────────────

/**
 * Ensures the response has a CSRF token cookie set.
 * Attaches `res.locals.csrfToken` for optional use in responses.
 *
 * Apply this to any response handler where the frontend should receive
 * a CSRF token (e.g., login, register).
 */
export function ensureCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = generateCsrfToken()
    res.cookie(CSRF_COOKIE, token, csrfCookieOptions())
    res.locals.csrfToken = token
  } else {
    res.locals.csrfToken = req.cookies[CSRF_COOKIE]
  }
  next()
}

// ── Middleware: validate CSRF token on state-changing requests ──────

/**
 * Rejects state-changing requests (POST, PUT, PATCH, DELETE) that don't
 * include a valid `X-CSRF-Token` header matching the `af_csrf` cookie.
 *
 * Safe methods (GET, HEAD, OPTIONS) are never checked.
 * Auth session-creating routes (login, register, etc.) are exempt since
 * the user doesn't yet have a CSRF token.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next()
    return
  }

  // Skip CSRF check for auth routes where user doesn't have a token yet
  if (isExemptFromCsrf(req)) {
    next()
    return
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE]
  const headerToken = req.headers[CSRF_HEADER] as string | undefined

  if (!cookieToken || !headerToken) {
    logger.warn('CSRF check failed — missing token', {
      method: req.method,
      path: req.path,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
    })
    res.status(403).json({ error: 'CSRF token missing' })
    return
  }

  // Use timing-safe comparison to prevent timing attacks
  const cookieBuf = Buffer.from(cookieToken, 'utf8')
  const headerBuf = Buffer.from(headerToken, 'utf8')

  // Constant-time comparison
  if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    logger.warn('CSRF check failed — token mismatch', {
      method: req.method,
      path: req.path,
    })
    res.status(403).json({ error: 'CSRF token mismatch' })
    return
  }

  next()
}

/**
 * Rotate the CSRF token (call after login/register to prevent
 * session fixation-style CSRF attacks).
 */
export function rotateCsrfToken(_req: Request, res: Response): string {
  const token = generateCsrfToken()
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions())
  res.locals.csrfToken = token
  return token
}
