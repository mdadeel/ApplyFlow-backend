/**
 * Structured Logger — Phase 9.1
 *
 * JSON-line logger with PII redaction.
 * Compatible with log aggregators (Datadog, ELK, etc.)
 */

/** Fields that are safe to log (not PII). */
const ALLOWED_FIELDS = new Set([
  'stage', 'operation', 'latency', 'score', 'retryCount',
  'section', 'attempt', 'passed', 'durationMs', 'sectionsRetried',
  'totalDurationMs', 'exhausted', 'overall', 'perSection',
])

/** Patterns that match PII values. */
const PII_PATTERNS = [
  /\b[\w.-]+@[\w.-]+\.\w+\b/g,         // email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,   // phone
  /\b\d{3}-\d{2}-\d{4}\b/g,            // SSN
  /\b(?:\d{4}[- ]?){3}\d{4}\b/g,       // credit card
]

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let redacted = value
    for (const pattern of PII_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]')
    }
    return redacted
  }
  if (value && typeof value === 'object') {
    return redactObject(value as Record<string, unknown>)
  }
  return value
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (ALLOWED_FIELDS.has(key)) {
      // Known-safe fields — log as-is
      result[key] = value
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Nested object — recursively redact
      result[key] = redactObject(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      // Array — redact each element
      result[key] = value.map(v => redactValue(v))
    } else {
      // Unknown field — redact the value but keep the key name
      result[key] = redactValue(value)
    }
  }
  return result
}

export interface StageLogger {
  info(operation: string, data?: Record<string, unknown>): void
  warn(operation: string, data?: Record<string, unknown>): void
  error(operation: string, data?: Record<string, unknown>): void
}

export function createStageLogger(stageName: string): StageLogger {
  function emit(level: string, operation: string, data?: Record<string, unknown>): void {
    const entry = {
      stage: stageName,
      timestamp: new Date().toISOString(),
      level,
      operation,
      data: data ? redactObject(data) : {},
    }
    const line = JSON.stringify(entry)

    switch (level) {
      case 'error':
        console.error(line)
        break
      case 'warn':
        console.warn(line)
        break
      default:
        console.log(line)
    }
  }

  return {
    info: (operation, data) => emit('info', operation, data),
    warn: (operation, data) => emit('warn', operation, data),
    error: (operation, data) => emit('error', operation, data),
  }
}
