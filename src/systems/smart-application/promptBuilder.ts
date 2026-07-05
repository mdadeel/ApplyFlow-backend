// Prompt Builder for Smart Application

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { SmartApplicationInput } from './types'
import type { CareerProfile } from '../career-data/profileService'

function getPromptsDir(): string {
  // In production the compiled code is in dist/; in dev/tests it is in src/.
  const fromDist = join(process.cwd(), 'dist', 'systems', 'smart-application', 'prompts')
  if (existsSync(fromDist)) return fromDist
  return join(process.cwd(), 'src', 'systems', 'smart-application', 'prompts')
}

const PROMPTS_DIR = getPromptsDir()

function loadPrompt(name: string): string {
  return readFileSync(join(PROMPTS_DIR, name), 'utf-8')
}

const SYSTEM_PROMPT = loadPrompt('system.md')
const GENERATION_PROMPT_TEMPLATE = loadPrompt('combined-generation.md')

interface PromptVariables {
  careerProfile: string
  jobDescription: string
  masterCVText?: string
}

export function buildSmartApplicationPrompt(input: SmartApplicationInput, careerProfile: CareerProfile): { system: string; user: string } {
  const variables: PromptVariables = {
    careerProfile: JSON.stringify(careerProfile, null, 2),
    jobDescription: input.jdText,
    masterCVText: input.masterCVText
  }

  let prompt = GENERATION_PROMPT_TEMPLATE

  // Replace variables
  prompt = prompt.replace('{{careerProfile}}', variables.careerProfile)
  prompt = prompt.replace('{{jobDescription}}', variables.jobDescription)

  if (variables.masterCVText) {
    prompt = prompt.replace('{{masterCVText}}', variables.masterCVText)
    prompt = prompt.replace('{{#if masterCVText}}', '')
    prompt = prompt.replace('{{/if}}', '')
  } else {
    // Remove the conditional block
    prompt = prompt.replace(/\{\{#if masterCVText\}\}[\s\S]*?\{\{\/if\}\}/, '')
  }

  return {
    system: SYSTEM_PROMPT,
    user: prompt
  }
}

export function buildBulkApplicationPrompt(
  inputs: Array<{ company: string; role: string; jdText: string }>,
  careerProfile: CareerProfile,
  masterCVText?: string
): { system: string; user: string } {
  const jdsText = inputs.map((jd, i) =>
    `=== JD ${i + 1}: ${jd.company} - ${jd.role} ===\n${jd.jdText}`
  ).join('\n\n')

  const variables: PromptVariables = {
    careerProfile: JSON.stringify(careerProfile, null, 2),
    jobDescription: jdsText,
    masterCVText
  }

  let prompt = GENERATION_PROMPT_TEMPLATE
    .replace('{{careerProfile}}', variables.careerProfile)
    .replace('{{jobDescription}}', variables.jobDescription)

  if (variables.masterCVText) {
    prompt = prompt.replace('{{masterCVText}}', variables.masterCVText)
    prompt = prompt.replace('{{#if masterCVText}}', '')
    prompt = prompt.replace('{{/if}}', '')
  } else {
    prompt = prompt.replace(/\{\{#if masterCVText\}\}[\s\S]*?\{\{\/if\}\}/, '')
  }

  // Modify for bulk: expect array output
  prompt = prompt.replace(
    'Return ONLY valid JSON matching this exact schema:',
    'Return ONLY valid JSON matching this exact schema (ARRAY of results, one per JD):'
  )
  prompt = prompt.replace(
    '```json\n{\n  "analysis":',
    '```json\n[\n  {\n  "analysis":'
  )
  prompt = prompt.replace(
    '"humanizationTips": \["string"\]\n  }\n}',
    '"humanizationTips": ["string"]\n  }\n]'
  )

  return {
    system: SYSTEM_PROMPT + '\n\nIMPORTANT: Return an ARRAY of results, one for each JD provided.',
    user: prompt
  }
}