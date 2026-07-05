import type { Response } from 'express'

/**
 * Send a successful API response wrapped in `{ data: T }`.
 *
 * This standard wrapper lets the frontend's `handleResponse` auto-unwrap
 * so callers receive the typed payload directly.
 */
export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data })
}
