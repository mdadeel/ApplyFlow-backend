import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { CookieOptions } from 'express'
import { config } from '../../config'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: 604800 })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    return payload as { userId: string }
  } catch {
    return null
  }
}

/** httpOnly cookie options for the JWT session token. */
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT expiry)
}

/** Cookie name for the session token. */
export const SESSION_COOKIE = 'af_session'
