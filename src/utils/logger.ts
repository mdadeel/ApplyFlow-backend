import winston from 'winston'
import path from 'path'
import fs from 'fs'

const logDir = path.resolve(process.cwd(), 'logs')

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

/**
 * Winston logger instance.
 *
 * Log levels (RFC 5424):
 *   error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
 *
 * In development:
 *   - Console transport with colorized simple format (info+)
 *   - Combined file transport (all levels)
 *   - Error file transport (error only)
 *
 * In production:
 *   - Combined file transport (info+)
 *   - Error file transport (error only)
 *   - No console output (use log aggregator instead)
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'applyflow-api' },
  transports: [
    // Error logs — always write to file regardless of environment
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 10,
    }),
    // Combined logs — always write to file regardless of environment
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 10,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
})

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 1
            ? ` ${JSON.stringify(meta)}`
            : ''
          return `${timestamp} ${level}: ${message}${metaStr}`
        }),
      ),
    }),
  )
}

/**
 * Create a child logger with a specific module context.
 * Usage: const log = logger.child({ module: 'identity/routes' })
 */
export function createModuleLogger(moduleName: string): winston.Logger {
  return logger.child({ module: moduleName })
}
