/**
 * engine/validation — Phase 6 entry point
 *
 * Re-exports from the unified validation layer.
 * Old import paths (e.g. systems/document-validation/*) continue to work
 * via direct file imports, but new code should use engine/validation/.
 */

export { ValidatorRegistry, validatorRegistry } from './registry'
export type { IValidator, IValidatorResult, ValidationContext, ValidatorEntry } from './types'
export {
  BANNED_WORDS,
  RECRUITER_CLICHES,
  AI_TRANSITIONS,
  AI_COVER_LETTER_PHRASES,
  WEAK_LANGUAGE_PATTERNS,
  ACTION_VERBS,
  METRIC_PATTERNS,
  LANGUAGE_REPLACEMENTS,
} from './constants'
