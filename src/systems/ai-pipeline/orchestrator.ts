import mongoose from 'mongoose'
import { Opportunity } from '../../models/Opportunity'
import { ocr, OcrResult } from './ocr'
import { clean, CleanResult } from './cleaner'
import { parse, ParserResult, ParsedFields } from './parser'
import { validate, ValidatedOutput } from './validator'
import { dedup, DedupResult, DedupInput } from './dedup'
import { embed } from './embedder'

export type PipelineStage = 'ocr' | 'clean' | 'parse' | 'validate' | 'dedup' | 'embed' | 'save'

const STAGE_ORDER: PipelineStage[] = ['ocr', 'clean', 'parse', 'validate', 'dedup', 'embed', 'save']

export interface PipelineInput {
  rawText?: string
  fileBuffer?: Buffer
  mimeType?: string
  sourceUrl?: string
  source: 'url' | 'manual' | 'email' | 'pdf' | 'screenshot' | 'linkedin' | 'career_page'
  createdBy: string
}

export interface PipelineContext {
  input: PipelineInput
  rawText: string
  ocrResult?: OcrResult
  cleanResult?: CleanResult
  parserResult?: ParserResult
  validateResult?: ValidatedOutput
  dedupResult?: DedupResult
  embedResult?: { embedding: number[]; model: string; dimensions: number }
  savedRecord?: Record<string, unknown>
  errors: Array<{ stage: string; error: string }>
  attemptedStages: PipelineStage[]
}

export class PipelineOrchestrator {
  private context: PipelineContext
  private maxRetries = 2

  constructor(input: PipelineInput) {
    if (!input.rawText && !input.fileBuffer) {
      throw new Error('Either rawText or fileBuffer must be provided')
    }

    this.context = {
      input,
      rawText: input.rawText || '',
      errors: [],
      attemptedStages: [],
    }
  }

  async run(): Promise<PipelineContext> {
    const startStage = this.determineResumeStage()

    for (const stage of STAGE_ORDER) {
      if (STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(startStage)) continue

      let success = false
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          await this.runStage(stage)
          success = true
          break
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          this.context.errors.push({ stage, error: message })
          if (attempt < this.maxRetries - 1) continue
          await this.handleFatal(stage, message)
          return this.context
        }
      }
    }

    return this.context
  }

  getContext(): PipelineContext {
    return this.context
  }

  private determineResumeStage(): PipelineStage {
    for (const stage of STAGE_ORDER) {
      if (!this.context.attemptedStages.includes(stage)) return stage
    }
    return 'save'
  }

  private async runStage(stage: PipelineStage): Promise<void> {
    this.context.attemptedStages.push(stage)

    switch (stage) {
      case 'ocr':
        await this.runOcr()
        break
      case 'clean':
        this.runClean()
        break
      case 'parse':
        await this.runParse()
        break
      case 'validate':
        this.runValidate()
        break
      case 'dedup':
        await this.runDedup()
        break
      case 'embed':
        await this.runEmbed()
        break
      case 'save':
        await this.runSave()
        break
    }
  }

  private async runOcr(): Promise<void> {
    if (this.context.rawText) return

    if (this.context.input.fileBuffer && this.context.input.mimeType) {
      this.context.ocrResult = await ocr(
        this.context.input.fileBuffer,
        this.context.input.mimeType,
      )
      this.context.rawText = this.context.ocrResult.text
    }
  }

  private runClean(): void {
    const text = this.context.rawText
    this.context.cleanResult = clean(text)
    this.context.rawText = this.context.cleanResult.cleaned
  }

  private async runParse(): Promise<void> {
    this.context.parserResult = await parse(this.context.rawText)
  }

  private runValidate(): void {
    const fields = this.context.parserResult?.fields || {}
    const opportunityInput: Record<string, unknown> = {
      ...fields,
      source: this.context.input.source,
      sourceUrl: this.context.input.sourceUrl,
      rawText: this.context.rawText,
      aiConfidence: this.context.parserResult?.confidence ?? 0,
      createdBy: this.context.input.createdBy,
    }

    this.context.validateResult = validate(opportunityInput as any)
  }

  private async runDedup(): Promise<void> {
    const fields = this.context.parserResult?.fields || {}
    if (!fields.title || !fields.company) {
      this.context.dedupResult = { isDuplicate: false, merged: false }
      return
    }

    const dedupInput: DedupInput = {
      title: fields.title,
      company: fields.company,
      description: fields.description,
      requiredSkills: fields.requiredSkills,
      preferredSkills: fields.preferredSkills,
      source: this.context.input.source,
      sourceUrl: this.context.input.sourceUrl,
    }

    this.context.dedupResult = await dedup(dedupInput)
  }

  private async runEmbed(): Promise<void> {
    const fields = this.context.parserResult?.fields || {}
    const embedText = [
      fields.title || '',
      fields.company || '',
      fields.description || '',
      ...(fields.requiredSkills || []),
      ...(fields.preferredSkills || []),
    ].join(' ')

    if (!embedText.trim()) {
      this.context.embedResult = { embedding: [], model: '', dimensions: 0 }
      return
    }

    const result = await embed(embedText)
    this.context.embedResult = result
  }

  private async runSave(): Promise<void> {
    if (this.context.dedupResult?.isDuplicate && this.context.dedupResult.merged) {
      return
    }

    if (this.context.dedupResult?.isDuplicate && !this.context.dedupResult.merged) {
      return
    }

    const fields = this.context.parserResult?.fields || {}
    const validated = this.context.validateResult?.validated || {}

    const doc = new Opportunity({
      ...fields,
      ...validated,
      source: this.context.input.source,
      sourceUrl: this.context.input.sourceUrl,
      rawText: this.context.rawText,
      createdBy: this.context.input.createdBy,
      requiredSkills: fields.requiredSkills || [],
      preferredSkills: fields.preferredSkills || [],
      ...(this.context.embedResult?.embedding ? { embedding: this.context.embedResult.embedding } : {}),
    })

    const saved = await doc.save()
    this.context.savedRecord = saved.toObject() as unknown as Record<string, unknown>
  }

  private async handleFatal(stage: string, error: string): Promise<void> {
    try {
      const fields = this.context.parserResult?.fields || {}
      const doc = new Opportunity({
        title: fields.title || 'Unknown Position',
        company: fields.company || 'Unknown Company',
        description: (fields.description || this.context.rawText || '').slice(0, 1000),
        source: this.context.input.source,
        sourceUrl: this.context.input.sourceUrl,
        createdBy: this.context.input.createdBy,
        pipelineStatus: 'failed',
        pipelineError: `Stage '${stage}' failed after ${this.maxRetries} retries: ${error}`,
        requiredSkills: [],
        preferredSkills: [],
      })
      const saved = await doc.save()
      this.context.savedRecord = saved.toObject() as unknown as Record<string, unknown>
    } catch {
      this.context.errors.push({ stage: 'fatal_handler', error: 'Could not save failed record' })
    }
  }
}
