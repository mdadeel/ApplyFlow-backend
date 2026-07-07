/**
 * Validator Registry — Phase 6.1
 *
 * Holds an ordered list of validators with metadata.
 * Routes and the pipeline use this to run validation in priority order.
 */

import type { IValidator, IValidatorResult, ValidationContext, ValidatorEntry } from './types'

/**
 * Mutable registry of validators.
 * Validators are run in ascending priority order (lower = earlier).
 */
export class ValidatorRegistry {
  private entries: ValidatorEntry[] = []

  /** Register a validator at a given priority. */
  register(validator: IValidator, options?: {
    priority?: number
    isDeterministic?: boolean
    tags?: string[]
  }): void {
    this.entries.push({
      validator,
      priority: options?.priority ?? 100,
      isDeterministic: options?.isDeterministic ?? false,
      tags: options?.tags ?? [],
    })
    // Keep sorted by priority so callers can iterate in order
    this.entries.sort((a, b) => a.priority - b.priority)
  }

  /** Run all validators in priority order, collecting results. */
  async validateAll(
    content: import('../types/resume').Resume,
    context: ValidationContext,
  ): Promise<{ results: IValidatorResult[]; overallPassed: boolean }> {
    const results: IValidatorResult[] = []
    for (const entry of this.entries) {
      const result = await entry.validator.validate(content, context)
      results.push(result)
    }
    return {
      results,
      overallPassed: results.every(r => r.passed),
    }
  }

  /** Run only deterministic validators. Useful for fast pre-check. */
  async runDeterministic(
    content: import('../types/resume').Resume,
    context: ValidationContext,
  ): Promise<{ results: IValidatorResult[]; allPass: boolean; minScore: number }> {
    const results: IValidatorResult[] = []
    for (const entry of this.entries) {
      if (!entry.isDeterministic) continue
      const result = await entry.validator.validate(content, context)
      results.push(result)
    }
    return {
      results,
      allPass: results.every(r => r.passed),
      minScore: results.length > 0
        ? Math.min(...results.map(r => r.score))
        : 1,
    }
  }

  /** Get all registered entries (for inspection / debugging). */
  getEntries(): ValidatorEntry[] {
    return [...this.entries]
  }

  /** Get validator by name */
  get(name: string): IValidator | undefined {
    return this.entries.find(e => e.validator.name === name)?.validator
  }

  /** Remove a validator by name */
  unregister(name: string): void {
    this.entries = this.entries.filter(e => e.validator.name !== name)
  }

  /** Reset all entries */
  clear(): void {
    this.entries = []
  }
}

/** Application-wide singleton */
export const validatorRegistry = new ValidatorRegistry()
