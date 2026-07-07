import mongoose, { Schema, Document } from 'mongoose'

export type AuditAction = 'merge' | 'create' | 'update' | 'delete' | 'conflict_skipped' | 'conflict_resolved'

export interface IProfileAuditEntry extends Document {
  userId: string
  action: AuditAction
  section: string
  documentId?: string
  previousValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  confidence: number
  performedBy: 'ai_extraction' | 'user_edit' | 'system'
  createdAt: Date
}

const profileAuditSchema = new Schema<IProfileAuditEntry>({
  userId: { type: String, required: true, index: true },
  action: {
    type: String,
    required: true,
    enum: ['merge', 'create', 'update', 'delete', 'conflict_skipped', 'conflict_resolved'],
  },
  section: { type: String, required: true },
  documentId: String,
  previousValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  performedBy: {
    type: String,
    required: true,
    enum: ['ai_extraction', 'user_edit', 'system'],
    default: 'ai_extraction',
  },
  createdAt: { type: Date, default: Date.now },
})

profileAuditSchema.index({ userId: 1, createdAt: -1 })
profileAuditSchema.index({ userId: 1, section: 1, createdAt: -1 })

export const ProfileAudit = mongoose.model<IProfileAuditEntry>('ProfileAudit', profileAuditSchema)
