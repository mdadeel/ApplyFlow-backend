import mongoose, { Schema, Document } from 'mongoose'

export interface IGraphSource {
  sourceType: string
  sourceId: string
  sourceLabel: string
  field: string
  text: string
  confidence: string
}

export interface IGraphEdge {
  source: string
  target: string
  type: string
  weight: number
  createdAt: Date
  metadata?: Record<string, unknown>
}

export interface IGraphNode {
  claim: string
  claimType: string
  sources: IGraphSource[]
  coverage: number
}

export interface IEvidenceGraphDocument extends Document {
  userId: string
  version: number
  nodes: IGraphNode[]
  edges: IGraphEdge[]
  metadata: {
    totalClaims: number
    totalSources: number
    coverage: number
  }
  createdAt: Date
  updatedAt: Date
}

const graphSourceSchema = new Schema<IGraphSource>({
  sourceType: { type: String, required: true },
  sourceId: { type: String, required: true },
  sourceLabel: { type: String, required: true },
  field: { type: String, required: true },
  text: { type: String, required: true },
  confidence: { type: String, required: true, enum: ['exact', 'partial', 'inferred'] },
}, { _id: false })

const graphEdgeSchema = new Schema<IGraphEdge>({
  source: { type: String, required: true },
  target: { type: String, required: true },
  type: { type: String, required: true },
  weight: { type: Number, required: true, min: 0, max: 1 },
  createdAt: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false })

const graphNodeSchema = new Schema<IGraphNode>({
  claim: { type: String, required: true },
  claimType: { type: String, required: true },
  sources: [graphSourceSchema],
  coverage: { type: Number, default: 0 },
}, { _id: false })

const evidenceGraphStoreSchema = new Schema<IEvidenceGraphDocument>({
  userId: { type: String, required: true, index: true },
  version: { type: Number, default: 1 },
  nodes: [graphNodeSchema],
  edges: [graphEdgeSchema],
  metadata: {
    totalClaims: { type: Number, default: 0 },
    totalSources: { type: Number, default: 0 },
    coverage: { type: Number, default: 0 },
  },
}, { timestamps: true })

evidenceGraphStoreSchema.index({ userId: 1, version: -1 })

export const EvidenceGraphStore = mongoose.model<IEvidenceGraphDocument>('EvidenceGraphStore', evidenceGraphStoreSchema)
