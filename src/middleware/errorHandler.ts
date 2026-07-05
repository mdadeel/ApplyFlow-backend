import type { Request, Response, NextFunction } from 'express'

/**
 * Custom error with HTTP status code and optional metadata.
 * Throw from any async route handler — Express 5 + the error middleware handle the rest.
 */
export class AppError extends Error {
  statusCode: number
  data?: unknown

  constructor(statusCode: number, message: string, data?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.data = data
  }
}

/**
 * Centralized Express error-handling middleware.
 * Catches all errors thrown or passed via next(err) from route handlers.
 *
 * Must be registered AFTER all routes.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Determine status code
  let statusCode = 500
  let message = 'Internal server error'
  let data: unknown | undefined

  if (err instanceof AppError) {
    statusCode = err.statusCode
    message = err.message
    data = err.data
  } else if (err.name === 'ZodError') {
    // Catches Zod validation errors thrown from identity routes
    statusCode = 400
    message = 'Validation failed'
    data = (err as any).errors ?? (err as any).issues
  } else if (err.name === 'MongooseError' || err.name === 'CastError') {
    statusCode = 400
    message = err.message
  } else if (err.name === 'ValidationError') {
    statusCode = 400
    message = err.message
  }

  // Log in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${statusCode}] ${message}`)
    if (statusCode === 500) {
      console.error(err.stack)
    }
  }

  // Build response
  const body: Record<string, unknown> = { error: message }
  if (data) body.details = data

  res.status(statusCode).json(body)
}
