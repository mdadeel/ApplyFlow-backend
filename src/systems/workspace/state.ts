import { WorkspaceStatus } from '../../models/ApplicationWorkspace'

export const VALID_TRANSITIONS: Record<WorkspaceStatus, WorkspaceStatus[]> = {
  idle: ['analyzing'],
  analyzing: ['tailoring', 'ready', 'idle'],
  tailoring: ['ready', 'idle'],
  ready: ['submitted', 'idle'],
  submitted: ['idle'],
}

export function canTransition(from: WorkspaceStatus, to: WorkspaceStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: WorkspaceStatus, to: WorkspaceStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`)
  }
}
