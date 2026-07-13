import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY || ''
const fromAddress = process.env.RESEND_FROM || 'noreply@applyflow.ai'
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

let resend: Resend | null = null
if (resendApiKey) {
  resend = new Resend(resendApiKey)
}

export interface EmailResult {
  success: boolean
  error?: string
}

async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!resend) {
    console.warn('[email] Resend not configured — skipping email send')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email error'
    console.error('[email] Send error:', message)
    return { success: false, error: message }
  }
}

/**
 * Send a verification email after registration.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<EmailResult> {
  const verifyUrl = `${frontendUrl}/auth/verify-email?token=${encodeURIComponent(token)}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f8fc; padding: 40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <table style="max-width: 480px; width: 100%; background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <tr><td style="text-align: center; padding-bottom: 24px;">
              <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">ApplyFlow AI</h1>
              <p style="font-size: 14px; color: #64748b; margin: 4px 0 0;">Verify your email address</p>
            </td></tr>
            <tr><td style="padding-bottom: 24px;">
              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0;">
                Thanks for signing up! Please verify your email address to unlock all features.
              </p>
            </td></tr>
            <tr><td style="text-align: center; padding-bottom: 24px;">
              <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                Verify Email
              </a>
            </td></tr>
            <tr><td>
              <p style="font-size: 13px; color: #94a3b8; margin: 0; text-align: center;">
                Or copy this link: <br/>
                <span style="color: #2563eb;">${verifyUrl}</span>
              </p>
              <p style="font-size: 13px; color: #94a3b8; margin: 16px 0 0; text-align: center;">
                This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
  return sendEmail(email, 'Verify your ApplyFlow AI account', html)
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<EmailResult> {
  const resetUrl = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(token)}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f8fc; padding: 40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <table style="max-width: 480px; width: 100%; background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <tr><td style="text-align: center; padding-bottom: 24px;">
              <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">ApplyFlow AI</h1>
              <p style="font-size: 14px; color: #64748b; margin: 4px 0 0;">Reset your password</p>
            </td></tr>
            <tr><td style="padding-bottom: 24px;">
              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0;">
                We received a request to reset your password. Click the button below to set a new one.
              </p>
            </td></tr>
            <tr><td style="text-align: center; padding-bottom: 24px;">
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                Reset Password
              </a>
            </td></tr>
            <tr><td>
              <p style="font-size: 13px; color: #94a3b8; margin: 0; text-align: center;">
                Or copy this link: <br/>
                <span style="color: #2563eb;">${resetUrl}</span>
              </p>
              <p style="font-size: 13px; color: #94a3b8; margin: 16px 0 0; text-align: center;">
                This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
  return sendEmail(email, 'Reset your ApplyFlow AI password', html)
}

/**
 * Send a welcome email after successful verification.
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<EmailResult> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f8fc; padding: 40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <table style="max-width: 480px; width: 100%; background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <tr><td style="text-align: center; padding-bottom: 24px;">
              <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">Welcome, ${name}! 🎉</h1>
            </td></tr>
            <tr><td style="padding-bottom: 24px;">
              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0;">
                Your email has been verified. You're all set to start using ApplyFlow AI to supercharge your job search.
              </p>
            </td></tr>
            <tr><td style="padding-bottom: 8px;">
              <p style="font-size: 14px; color: #475569; margin: 0; font-weight: 600;">Quick start:</p>
              <ul style="font-size: 14px; color: #475569; line-height: 1.8; padding-left: 20px; margin: 8px 0 0;">
                <li>Upload your resume to get instant analysis</li>
                <li>Paste a job description to see your match score</li>
                <li>Generate tailored resumes with AI</li>
                <li>Track applications and interviews</li>
              </ul>
            </td></tr>
            <tr><td style="text-align: center; padding-top: 8px;">
              <a href="${frontendUrl}/dashboard" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                Go to Dashboard
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
  return sendEmail(email, 'Welcome to ApplyFlow AI!', html)
}
