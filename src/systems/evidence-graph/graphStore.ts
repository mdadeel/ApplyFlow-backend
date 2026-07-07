import { EvidenceGraphStore } from '../../models/EvidenceGraphStore'
import type { EvidenceNode, EvidenceEdge, EvidenceGraph } from './types'
import type { IEvidenceGraphDocument } from '../../models/EvidenceGraphStore'

interface CacheEntry {
  graph: EvidenceGraph
  version: number
  lastAccess: number
}

/**
 * In-memory LRU cache for evidence graphs.
 * Uses write-through to MongoDB on mutations.
 */
export class GraphCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize: number
  private ttlMs: number

  constructor(maxSize: number = 100, ttlMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  get(userId: string): EvidenceGraph | null {
    const entry = this.cache.get(userId)
    if (!entry) return null

    // Check TTL
    if (Date.now() - entry.lastAccess > this.ttlMs) {
      this.cache.delete(userId)
      return null
    }

    entry.lastAccess = Date.now()
    return entry.graph
  }

  set(userId: string, graph: EvidenceGraph, version: number): void {
    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize) {
      let oldestKey = ''
      let oldestTime = Infinity
      for (const [key, entry] of this.cache) {
        if (entry.lastAccess < oldestTime) {
          oldestTime = entry.lastAccess
          oldestKey = key
        }
      }
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(userId, {
      graph,
      version,
      lastAccess: Date.now(),
    })
  }

  invalidate(userId: string): void {
    this.cache.delete(userId)
  }

  size(): number {
    return this.cache.size
  }
}

/** Singleton cache instance */
const globalCache = new GraphCache()

/**
 * Load a user's evidence graph, from cache or MongoDB.
 */
export async function loadGraph(userId: string): Promise<EvidenceGraph | null> {
  // Check cache first
  const cached = globalCache.get(userId)
  if (cached) return cached

  // Load from Mongo
  const doc = await EvidenceGraphStore.findOne({ userId })
    .sort({ version: -1 })
    .lean()

  if (!doc) return null

  const graph = documentToGraph(doc)
  globalCache.set(userId, graph, doc.version)
  return graph
}

/**
 * Save a user's evidence graph to MongoDB (write-through).
 * Increments version automatically.
 */
export async function saveGraph(
  userId: string,
  graph: EvidenceGraph,
): Promise<void> {
  const lastDoc = await EvidenceGraphStore.findOne({ userId })
    .sort({ version: -1 })
    .select('version')
    .lean()

  const nextVersion = (lastDoc?.version || 0) + 1

  await EvidenceGraphStore.create({
    userId,
    version: nextVersion,
    nodes: graph.nodes.map(nodeToDoc),
    edges: graph.edges.map(edgeToDoc),
    metadata: {
      totalClaims: graph.metadata.totalClaims,
      totalSources: graph.metadata.totalSources,
      coverage: graph.metadata.coverage,
    },
  })

  // Update cache
  globalCache.set(userId, graph, nextVersion)
}

/**
 * Delete all graph versions for a user (e.g., on profile reset).
 */
export async function deleteGraph(userId: string): Promise<void> {
  await EvidenceGraphStore.deleteMany({ userId })
  globalCache.invalidate(userId)
}

/** Convert a Mongo document to an EvidenceGraph. */
function documentToGraph(doc: IEvidenceGraphDocument | Record<string, any>): EvidenceGraph {
  const nodes: EvidenceNode[] = (doc.nodes || []).map((n: any) => ({
    claim: n.claim,
    claimType: n.claimType,
    sources: (n.sources || []).map((s: any) => ({
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      sourceLabel: s.sourceLabel,
      field: s.field,
      text: s.text,
      confidence: s.confidence,
    })),
    coverage: n.coverage,
  }))

  const edges: EvidenceEdge[] = (doc.edges || []).map((e: any) => ({
    source: e.source,
    target: e.target,
    type: e.type,
    weight: e.weight,
    createdAt: e.createdAt || new Date(),
    metadata: e.metadata,
  }))

  // uncoveredClaims is a runtime-computed field (only available at build time),
  // so we store the count but recompute the list on load.
  const coveredNodes = nodes.filter(n => n.sources.length > 0).length
  const uncoveredClaims = nodes.filter(n => n.sources.length === 0).map(n => n.claim)

  return {
    nodes,
    edges,
    metadata: doc.metadata
      ? {
          totalClaims: doc.metadata.totalClaims,
          totalSources: doc.metadata.totalSources,
          coverage: doc.metadata.coverage,
          uncoveredClaims,
        }
      : {
          totalClaims: nodes.length,
          totalSources: nodes.reduce((s: number, n: EvidenceNode) => s + n.sources.length, 0),
          coverage: nodes.length > 0 ? Math.round((coveredNodes / nodes.length) * 100) : 100,
          uncoveredClaims,
        },
  }
}

/** Convert an EvidenceNode to a plain object for Mongo storage. */
function nodeToDoc(node: EvidenceNode): Record<string, unknown> {
  return {
    claim: node.claim,
    claimType: node.claimType,
    sources: node.sources.map(s => ({
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      sourceLabel: s.sourceLabel,
      field: s.field,
      text: s.text,
      confidence: s.confidence,
    })),
    coverage: node.coverage,
  }
}

/** Convert an EvidenceEdge to a plain object for Mongo storage. */
function edgeToDoc(edge: EvidenceEdge): Record<string, unknown> {
  return {
    source: edge.source,
    target: edge.target,
    type: edge.type,
    weight: edge.weight,
    createdAt: edge.createdAt,
    metadata: edge.metadata,
  }
}
