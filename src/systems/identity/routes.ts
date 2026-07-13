import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { User } from '../../models/User'
import { Notification } from '../../models/Notification'
import { Application } from '../../models/Application'
import { JDAnalysis } from '../../models/JDAnalysis'
import { ResumeVersion } from '../../models/ResumeVersion'
import { InterviewPrep } from '../../models/InterviewPrep'
import { UploadedResume } from '../../models/UploadedResume'
import { ValidationReport } from '../../models/ValidationReport'
import { ExportRecord } from '../../models/ExportRecord'
import { hashPassword, verifyPassword, generateToken, SESSION_COOKIE, sessionCookieOptions } from './credentialManager'
import { verifyGoogleToken, verifyGithubCode, verifyLinkedInCode } from './oauthGateway'
import { ensureCsrfToken, rotateCsrfToken } from '../../middleware/csrf'
import { sessionGuard } from './sessionGuard'
import { getPreferences, updatePreferences, redactApiKeys } from './preferenceStore'
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  githubAuthSchema,
  preferencesSchema,
  saveApiKeySchema,
  changePasswordSchema,
} from '../../utils/validation'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { config } from '../../config'
import { validate } from '../../middleware/validate'
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../../services/email'

const router = Router()

/**
 * Set the JWT as an httpOnly cookie on the response.
 */
function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions)
}

/**
 * Clear the session cookie (used on logout).
 */
function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
}

function backendBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get('host')}`
}

function addConnectedProvider(user: any, provider: string): void {
  const current: string[] = Array.isArray(user.connectedProviders) ? user.connectedProviders : []
  if (!current.includes(provider)) {
    user.connectedProviders = [...current, provider]
  }
}

function frontendRedirect(provider: 'github' | 'linkedin', status: 'connected' | 'error'): string {
  const params = new URLSearchParams({ tab: 'integrations', [provider]: status })
  return `${config.frontendUrl}/settings?${params.toString()}`
}

router.post('/register', ensureCsrfToken, async (req, res: Response) => {
  const data = registerSchema.parse(req.body)

  const existing = await User.findOne({ email: data.email })
  if (existing) throw new AppError(409, 'Email already registered')

  const hashedPassword = await hashPassword(data.password)
  const verificationToken = crypto.randomBytes(32).toString('hex')
  const user = await User.create({
    email: data.email,
    password: hashedPassword,
    name: data.name,
    authProvider: 'email',
    verificationToken,
    verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  })

  try {
    await Notification.create({
      userId: String(user._id),
      type: 'feature',
      title: 'Welcome to ApplyFlow AI',
      message: 'Get started by creating your first application or analyzing a job description.',
      link: '/applications',
    })
  } catch (err) {
    console.error('Failed to create welcome notification:', err)
  }

  // Send verification email (non-blocking — don't fail registration if email fails)
  sendVerificationEmail(user.email, verificationToken)

  // Rotate CSRF token on new session
  rotateCsrfToken(req, res)

  const token = generateToken(String(user._id))
  setSessionCookie(res, token)
  sendSuccess(res, { user: user.toJSON() }, 201)
})

router.post('/login', ensureCsrfToken, async (req, res: Response) => {
  const data = loginSchema.parse(req.body)

  const user = await User.findOne({ email: data.email })
  if (!user || !user.password) throw new AppError(401, 'Invalid email or password')

  const valid = await verifyPassword(data.password, user.password)
  if (!valid) throw new AppError(401, 'Invalid email or password')

  // Rotate CSRF token on new session
  rotateCsrfToken(req, res)

  const token = generateToken(String(user._id))
  setSessionCookie(res, token)
  sendSuccess(res, { user: user.toJSON() })
})

router.post('/google', ensureCsrfToken, async (req, res: Response) => {
  const data = googleAuthSchema.parse(req.body)
  let oauthUser
  try {
    oauthUser = await verifyGoogleToken(data.accessToken)
  } catch (err: any) {
    throw new AppError(401, err.message || 'Google authentication failed')
  }

  let user = await User.findOne({ authProviderId: oauthUser.providerId })
  if (!user) {
    user = await User.create({
      email: oauthUser.email,
      name: oauthUser.name,
      authProvider: 'google',
      authProviderId: oauthUser.providerId,
    })
  }

  rotateCsrfToken(req, res)
  const token = generateToken(String(user._id))
  setSessionCookie(res, token)
  sendSuccess(res, { user: user.toJSON() })
})

// Dev-login only available in development mode
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-login', ensureCsrfToken, async (req, res: Response) => {
    let user = await User.findOne({ email: 'dev@applyflow.ai' })
    if (!user) {
      const hashedPassword = await hashPassword('devpassword123')
      user = await User.create({
        email: 'dev@applyflow.ai',
        password: hashedPassword,
        name: 'Dev User',
        authProvider: 'email',
        onboardingComplete: true,
      })
    }
    rotateCsrfToken(req, res)
    const token = generateToken(String(user._id))
    setSessionCookie(res, token)
    sendSuccess(res, { user: user.toJSON() })
  })
}

router.post('/github', ensureCsrfToken, async (req, res: Response) => {
  const data = githubAuthSchema.parse(req.body)
  let oauthUser
  try {
    oauthUser = await verifyGithubCode(data.code)
  } catch (err: any) {
    throw new AppError(401, err.message || 'GitHub authentication failed')
  }

  let user = await User.findOne({ authProviderId: oauthUser.providerId })
  if (!user) {
    user = await User.create({
      email: oauthUser.email,
      name: oauthUser.name,
      authProvider: 'github',
      authProviderId: oauthUser.providerId,
    })
  }

  rotateCsrfToken(req, res)
  const token = generateToken(String(user._id))
  setSessionCookie(res, token)
  sendSuccess(res, { user: user.toJSON() })
})

router.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res)
  sendSuccess(res, { ok: true })
})

router.get('/me', sessionGuard, async (req: Request, res: Response) => {
  const user = await User.findById(req.userId)
  if (!user) throw new AppError(404, 'User not found')
  sendSuccess(res, user.toJSON())
})

router.get('/preferences', sessionGuard, async (req: Request, res: Response) => {
  const preferences = await getPreferences(req.userId)
  sendSuccess(res, redactApiKeys(preferences))
})

router.put('/preferences', sessionGuard, async (req: Request, res: Response) => {
  const data = preferencesSchema.parse(req.body)
  const preferences = await updatePreferences(req.userId, data)
  sendSuccess(res, redactApiKeys(preferences))
})

router.post('/api-key', sessionGuard, async (req: Request, res: Response) => {
  const data = saveApiKeySchema.parse(req.body)
  const existing = await getPreferences(req.userId)
  const mergedKeys: Record<string, string> = { ...existing.apiKeys, [data.provider]: data.key }
  const preferences = await updatePreferences(req.userId, { apiKeys: mergedKeys })
  sendSuccess(res, redactApiKeys(preferences))
})

router.get('/api-keys', sessionGuard, async (req: Request, res: Response) => {
  const preferences = await getPreferences(req.userId)
  const providers = preferences.apiKeys ? Object.keys(preferences.apiKeys) : []
  sendSuccess(res, { providers })
})

router.put('/password', sessionGuard, validate(changePasswordSchema), async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }

  if (newPassword === currentPassword) {
    throw new AppError(400, 'New password must be different from the current password')
  }

  const user = await User.findById(req.userId)
  if (!user) throw new AppError(404, 'User not found')
  if (!user.password) throw new AppError(400, 'Password login is not enabled for this account')

  const valid = await verifyPassword(currentPassword, user.password)
  if (!valid) throw new AppError(401, 'Current password is incorrect')

  user.password = await hashPassword(newPassword)
  await user.save()

  sendSuccess(res, { ok: true })
})

router.delete('/account', sessionGuard, async (req: Request, res: Response) => {
  const userId = req.userId

  // Cascade-delete all user-owned data so the account leaves no orphans.
  // All models below have a userId field (verified in their respective schemas).
  await Promise.all([
    Application.deleteMany({ userId }),
    JDAnalysis.deleteMany({ userId }),
    ResumeVersion.deleteMany({ userId }),
    InterviewPrep.deleteMany({ userId }),
    UploadedResume.deleteMany({ userId }),
    ValidationReport.deleteMany({ userId }),
    ExportRecord.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
  ])

  await User.findByIdAndDelete(userId)

  clearSessionCookie(res)
  sendSuccess(res, { ok: true })
})

router.delete('/api-key/:provider', sessionGuard, async (req: Request, res: Response) => {
  const provider = String(req.params.provider || '').trim()
  if (!provider) throw new AppError(400, 'Provider is required')

  const existing = await getPreferences(req.userId)
  if (!existing.apiKeys || !(provider in existing.apiKeys)) {
    throw new AppError(404, 'API key not found for provider')
  }

  const nextKeys: Record<string, string> = { ...existing.apiKeys }
  delete nextKeys[provider]
  const preferences = await updatePreferences(req.userId, { apiKeys: nextKeys })
  sendSuccess(res, redactApiKeys(preferences))
})

// ── Email verification ──────────────────────────────────────────────

router.post('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token || typeof token !== 'string') {
    throw new AppError(400, 'Verification token is required')
  }

  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: new Date() },
  })

  if (!user) {
    throw new AppError(400, 'Invalid or expired verification token')
  }

  user.isVerified = true
  user.verificationToken = undefined
  user.verificationTokenExpires = undefined
  await user.save()

  // Send a welcome email on successful verification
  sendWelcomeEmail(user.email, user.name)

  sendSuccess(res, { ok: true, message: 'Email verified successfully' })
})

router.post('/resend-verification', sessionGuard, async (req: Request, res: Response) => {
  const user = await User.findById(req.userId)
  if (!user) throw new AppError(404, 'User not found')
  if (user.isVerified) {
    throw new AppError(400, 'Email is already verified')
  }

  const verificationToken = crypto.randomBytes(32).toString('hex')
  user.verificationToken = verificationToken
  user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await user.save()

  await sendVerificationEmail(user.email, verificationToken)

  sendSuccess(res, { ok: true, message: 'Verification email sent' })
})

// ── Password reset ──────────────────────────────────────────────────

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email || typeof email !== 'string') {
    throw new AppError(400, 'Email is required')
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() })

  // Always return success to prevent email enumeration
  if (!user || !user.password) {
    sendSuccess(res, { message: 'If that email exists, a password reset link has been sent.' })
    return
  }

  const resetToken = crypto.randomBytes(32).toString('hex')
  user.passwordResetToken = resetToken
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  await user.save()

  await sendPasswordResetEmail(user.email, resetToken)

  sendSuccess(res, { message: 'If that email exists, a password reset link has been sent.' })
})

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body
  if (!token || typeof token !== 'string') {
    throw new AppError(400, 'Reset token is required')
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new AppError(400, 'Password must be at least 6 characters')
  }

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
  })

  if (!user) {
    throw new AppError(400, 'Invalid or expired reset token')
  }

  user.password = await hashPassword(newPassword)
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  await user.save()

  // Create a new session so the user is logged in after reset
  const jwtToken = generateToken(String(user._id))
  setSessionCookie(res, jwtToken)

  sendSuccess(res, { ok: true, message: 'Password reset successfully' })
})

// ── Integration OAuth (popup flow) ─────────────────────────────────────────

router.get('/integrations/status', (_req, res: Response) => {
  sendSuccess(res, {
    github: Boolean(config.githubClientId && config.githubClientSecret),
    linkedin: Boolean(config.linkedinClientId && config.linkedinClientSecret),
  })
})

// LinkedIn OAuth — entry point. Redirects the user to LinkedIn's authorize URL.
router.get('/linkedin', (req: Request, res: Response) => {
  if (!config.linkedinClientId || !config.linkedinClientSecret) {
    res.status(503).json({ error: 'LinkedIn OAuth not configured' })
    return
  }

  const redirectUri = `${backendBaseUrl(req)}/api/auth/linkedin/callback`
  const authorizeUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', config.linkedinClientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('scope', 'r_liteprofile r_emailaddress openid')
  authorizeUrl.searchParams.set('state', 'linkedin')

  res.redirect(authorizeUrl.toString())
})

// LinkedIn OAuth — callback. Exchanges code for profile, upserts user, redirects to frontend.
router.get('/linkedin/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : null
  if (!code) {
    res.redirect(frontendRedirect('linkedin', 'error'))
    return
  }

  try {
    const oauthUser = await verifyLinkedInCode(code)
    let user = await User.findOne({ authProviderId: oauthUser.providerId, authProvider: 'linkedin' })
    if (!user) {
      user = await User.findOne({ email: oauthUser.email })
      if (user) {
        // Link the OAuth identity to an existing account.
        user.authProviderId = oauthUser.providerId
        if (user.authProvider === 'email') user.authProvider = 'linkedin'
        addConnectedProvider(user, 'linkedin')
        await user.save()
      } else {
        user = await User.create({
          email: oauthUser.email,
          name: oauthUser.name,
          authProvider: 'linkedin',
          authProviderId: oauthUser.providerId,
          connectedProviders: ['linkedin'],
        })
      }
    } else {
      addConnectedProvider(user, 'linkedin')
      await user.save()
    }

    rotateCsrfToken(req, res)
    const token = generateToken(String(user._id))
    // Set the session cookie on the popup response so it's available
    // when the popup redirects back to the frontend.
    setSessionCookie(res, token)
    res.redirect(frontendRedirect('linkedin', 'connected'))
  } catch (err) {
    console.error('LinkedIn OAuth callback failed:', err)
    res.redirect(frontendRedirect('linkedin', 'error'))
  }
})

// GitHub OAuth — entry point. Redirects the user to GitHub's authorize URL.
router.get('/github', (req: Request, res: Response) => {
  if (!config.githubClientId || !config.githubClientSecret) {
    res.status(503).json({ error: 'GitHub OAuth not configured' })
    return
  }

  const redirectUri = `${backendBaseUrl(req)}/api/auth/github/callback`
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize')
  authorizeUrl.searchParams.set('client_id', config.githubClientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('scope', 'read:user user:email')
  authorizeUrl.searchParams.set('state', 'github')

  res.redirect(authorizeUrl.toString())
})

// GitHub OAuth — callback. Exchanges code for profile, upserts user, redirects to frontend.
router.get('/github/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : null
  if (!code) {
    res.redirect(frontendRedirect('github', 'error'))
    return
  }

  try {
    const oauthUser = await verifyGithubCode(code)
    let user = await User.findOne({ authProviderId: oauthUser.providerId, authProvider: 'github' })
    if (!user) {
      user = await User.findOne({ email: oauthUser.email })
      if (user) {
        user.authProviderId = oauthUser.providerId
        if (user.authProvider === 'email') user.authProvider = 'github'
        addConnectedProvider(user, 'github')
        await user.save()
      } else {
        user = await User.create({
          email: oauthUser.email,
          name: oauthUser.name,
          authProvider: 'github',
          authProviderId: oauthUser.providerId,
          connectedProviders: ['github'],
        })
      }
    } else {
      addConnectedProvider(user, 'github')
      await user.save()
    }

    rotateCsrfToken(req, res)
    const token = generateToken(String(user._id))
    // Set the session cookie on the popup response so it's available
    // when the popup redirects back to the frontend.
    setSessionCookie(res, token)
    res.redirect(frontendRedirect('github', 'connected'))
  } catch (err) {
    console.error('GitHub OAuth callback failed:', err)
    res.redirect(frontendRedirect('github', 'error'))
  }
})

export default router
