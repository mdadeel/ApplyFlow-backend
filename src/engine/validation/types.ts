/**
 * Unified Validator Interface — Phase 6
 *
 * All validators (deterministic, AI-based, hybrid) implement this interface
 * so the pipeline and routes can treat them polymorphically.
 */

import type { Resume } from '../types/resume'
import type { JobAnalysis } from '../types/job-analysis'
import type { CareerProfile } from '../../systems/career-data/profileService'

/** Context passed to every validator at runtime. */
export interface ValidationContext {
  /** The user's career profile (source of truth) */
  profile: CareerProfile

  /** The target job analysis, if available */
  jobAnalysis?: JobAnalysis

  /** The AI-generated output being validated, as markdown */
  outputMarkdown?: string

  /** Additional hints the pipeline wants to pass through */
  hints?: Record<string, unknown>
}

export interface IValidatorResult {
  /** 0–1 score, where 1 = perfect */
  score: number
  /** Whether score >= threshold */
  passed: boolean
  /** Supporting evidence or references */
  evidence: string[]
  /** Human-readable explanation */
  details: string
  /** Severity classification */
  severity: 'error' | 'warning' | 'info'
}

export interface IValidator {
  /** Human-readable validator name (e.g. "TruthGate", "ATS") */
  name: string
  /** Default pass/fail threshold (0–1) */
  threshold: number
  /** Run validation against content + context */
  validate(content: Resume, context: ValidationContext): Promise<IValidatorResult>
}

/** Runtime metadata attached to each registered validator */
export interface ValidatorEntry {
  validator: IValidator
  /** Order in the pipeline (lower = earlier) */
  priority: number
  /** Whether this is a fast deterministic check (skips AI if high score) */
  isDeterministic: boolean
  /** Tags for grouping / filtering */
  tags: string[]
}
