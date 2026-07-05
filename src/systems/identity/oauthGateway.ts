import { config } from '../../config'

interface OAuthUser {
  email: string
  name: string
  providerId: string
}

export async function verifyGoogleToken(accessToken: string): Promise<OAuthUser> {
  const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`)
  if (!res.ok) throw new Error('Invalid Google access token')

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) throw new Error('Failed to fetch Google profile')
  const profile = await profileRes.json()

  return {
    email: profile.email,
    name: profile.name,
    providerId: profile.id,
  }
}

export async function verifyGithubCode(code: string): Promise<OAuthUser> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
    }),
  })

  if (!tokenRes.ok) throw new Error('Failed to exchange GitHub code')
  const tokenData = await tokenRes.json()

  if (tokenData.error) throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`)

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  if (!userRes.ok) throw new Error('Failed to fetch GitHub profile')
  const user = await userRes.json()

  const emailRes = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const emails = await emailRes.json()
  const primaryEmail = Array.isArray(emails) ? emails.find((e: { primary: boolean }) => e.primary)?.email || emails[0]?.email : user.email

  return {
    email: primaryEmail || user.email || `${user.id}@github.user`,
    name: user.name || user.login,
    providerId: String(user.id),
  }
}

export async function verifyLinkedInCode(code: string): Promise<OAuthUser> {
  const redirectUri = `${config.frontendUrl}/api/auth/linkedin/callback`

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.linkedinClientId || '',
    client_secret: config.linkedinClientSecret || '',
  })

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '')
    throw new Error(`Failed to exchange LinkedIn code: ${errText || tokenRes.statusText}`)
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!tokenData.access_token) {
    throw new Error(`LinkedIn OAuth error: ${tokenData.error_description || tokenData.error || 'missing access_token'}`)
  }

  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  if (!profileRes.ok) throw new Error('Failed to fetch LinkedIn profile')

  const profile = (await profileRes.json()) as {
    sub?: string
    id?: string
    email?: string
    name?: string
    given_name?: string
    family_name?: string
  }

  const email = profile.email
  const name = profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ').trim() || 'LinkedIn User'
  const providerId = profile.sub || profile.id

  if (!email) throw new Error('LinkedIn account did not return an email address')
  if (!providerId) throw new Error('LinkedIn account did not return a provider ID')

  return {
    email,
    name,
    providerId: String(providerId),
  }
}
