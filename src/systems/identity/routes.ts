import { Router, Request, Response } from 'express'
import { User } from '../../models/User'
import { Notification } from '../../models/Notification'
import { hashPassword, verifyPassword, generateToken, SESSION_COOKIE, sessionCookieOptions } from './credentialManager'
import { verifyGoogleToken, verifyGithubCode, verifyLinkedInCode } from './oauthGateway'
import { sessionGuard } from './sessionGuard'
import { getPreferences, updatePreferences, redactApiKeys } from './preferenceStore'
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  githubAuthSchema,
  preferencesSchema,
  saveApiKeySchema,
} from '../../utils/validation'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { config } from '../../config'

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

router.post('/register', async (req, res: Response) => {
  const data = registerSchema.parse(req.body)

  const existing = await User.findOne({ email: data.email })
  if (existing) throw new AppError(409, 'Email already registered')

  const hashedPassword = await hashPassword(data.password)
  const user = await User.create({
    email: data.email,
    password: hashedPassword,
    name: data.name,
    authProvider: 'email',
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

  const token = generateToken(String(user._id))
  setSessionCookie(res, token)
  sendSuccess(res, { user: user.toJSON() }, 201)
})

router.post('/login', async (req, res: Response) => {
  const data = loginSchema.parse(req.body)

  const user = await User.findOne({ email: data.email })
  if (!user || !user.password) throw new AppError(401, 'Invalid email or password')

  const valid = await verifyPassword(data.password, user.password)
  if (!valid) throw new AppError(401, 'Invalid email or password')

  const token = generateToken(String(user._id))
  setSessionCookie(res, token)
  sendSuccess(res, { user: user.toJSON() })
})

router.post('/google', async (req, res: Response) => {
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

  const token = generateToken(String(user._id))
  setSessionCookie(res, token)
  sendSuccess(res, { user: user.toJSON() })
})

router.post('/dev-login', async (_req, res: Response) => {
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
  const token = generateToken(String(user._id))
  setSessionCookie(res, token)
  sendSuccess(res, { user: user.toJSON() })
})

router.post('/github', async (req, res: Response) => {
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
  const mergedKeys: Record<string, string> = { ...(existing.apiKeys ?? {}), [data.provider]: data.key }
  const preferences = await updatePreferences(req.userId, { apiKeys: mergedKeys })
  sendSuccess(res, redactApiKeys(preferences))
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
