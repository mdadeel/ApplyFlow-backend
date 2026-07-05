import { ApplicationStatus } from '../../models/Application'

const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ['analyzing', 'applied'],
  analyzing: ['planning', 'draft'],
  planning: ['generating', 'draft'],
  generating: ['reviewing', 'draft'],
  reviewing: ['ready', 'draft'],
  ready: ['exported', 'draft'],
  exported: ['applied', 'ready'],
  applied: ['interview', 'assessment', 'rejected', 'ghosted'],
  interview: ['assessment', 'offer', 'rejected', 'ghosted'],
  assessment: ['interview', 'offer', 'rejected', 'ghosted'],
  offer: ['rejected', 'ghosted'],
  rejected: [],
  ghosted: [],
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  analyzing: 'Analyzing',
  planning: 'Planning',
  generating: 'Generating',
  reviewing: 'Reviewing',
  ready: 'Ready',
  exported: 'Exported',
  applied: 'Applied',
  interview: 'Interview',
  assessment: 'Assessment',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
}

export const STATUS_DEFINITIONS = (Object.keys(transitions) as ApplicationStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}))

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return transitions[from]?.includes(to) ?? false
}

export function validTransitions(from: ApplicationStatus): ApplicationStatus[] {
  return transitions[from] || []
}
