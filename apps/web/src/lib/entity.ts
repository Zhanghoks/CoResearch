// Node/relation contracts, ported from workspace design docs:
//   docs/design/canvas/huabu-reverse-engineering.md  §10.3 (crEntity kind union)
//   docs/design/canvas/huabu-node-presentation-and-links.md  §3, §9 (presentation + relation contracts)

export type ResearchEntityKind =
  | 'seed'
  | 'direction'
  | 'phase'
  | 'focus'
  | 'problem'
  | 'claim'
  | 'hypothesis'
  | 'prediction'
  | 'work'
  | 'fragment'
  | 'question'
  | 'probe'
  | 'requirement'
  | 'approach'
  | 'operation'
  | 'component'
  | 'evaluation'
  | 'baseline'
  | 'review'

export type ResearchNodeDisplayState =
  | 'compact'
  | 'preview'
  | 'detail'
  | 'editing'
  | 'stale'
  | 'blocked'

export type StalenessReason =
  | 'upstream_revision_changed'
  | 'upstream_assessment_changed'
  | 'landscape_refreshed'

export interface VersionedRef {
  refId: string
  refRevision: number
}

/**
 * Seed-only fields. Seed's product job is narrower than every other node:
 * "record what the user wants to explore right now, as a search anchor for
 * Literature Landscape" — not a Problem, not a Research Question, and never
 * a Method. See docs discussion 2026-09-18 ("Seed 节点定死") for the full
 * rationale behind each field.
 */
export interface SeedRevision {
  revision: number
  focus: string
  /** Pre-formatted display date (e.g. "Sep 18") — this is presentation data, not a timestamp to compute with. */
  date: string
}

export interface SeedDetail {
  /** The user's own words, preserved verbatim so later reframing never loses the original ask. */
  rawInput: string
  /** One-line current framing. */
  focus: string
  /** 1-3 sentences expanding `focus`. */
  description: string
  /** Chips: which system objects this Seed treats as in-scope (e.g. Skills, Tools, Memory). */
  objects: string[]
  scopeIncluded: string[]
  scopeExcluded: string[]
  directionCount: number
  currentDirectionTitle: string | null
  /** Most recent first; `revisions[0]` is the current revision. */
  revisions: SeedRevision[]
  confirmedAt: string | null
}

export interface ResearchNodePresentation extends Record<string, unknown> {
  nodeId: string
  entityRef: VersionedRef
  entityKind: ResearchEntityKind
  displayState: ResearchNodeDisplayState
  title: string
  typeLabel: string
  summary: string | null
  keywords: string[]
  status: string
  confirmed: boolean
  stale: false | StalenessReason
  evidenceState: 'planned' | 'partial' | 'grounded' | null
  relationCounts: {
    incoming: number
    outgoing: number
    unresolved: number
  }
  sourceCount: number
  userNote?: string
  pinned?: boolean
  /** Only present when `entityKind === 'seed'`. */
  seedDetail?: SeedDetail
}

export function createPresentation(
  id: string,
  entityKind: ResearchEntityKind,
  title: string,
  summary: string,
  overrides: Partial<ResearchNodePresentation> = {},
): ResearchNodePresentation {
  return {
    nodeId: id,
    entityRef: { refId: id, refRevision: 1 },
    entityKind,
    displayState: 'preview',
    title,
    typeLabel: entityKind.toUpperCase(),
    summary,
    keywords: [],
    status: 'draft',
    confirmed: false,
    stale: false,
    evidenceState: null,
    relationCounts: { incoming: 0, outgoing: 0, unresolved: 0 },
    sourceCount: 0,
    ...overrides,
  }
}

export type ResearchRelationType =
  | 'contains'
  | 'motivates'
  | 'explains'
  | 'tests'
  | 'operationalizes'
  | 'supports'
  | 'challenges'
  | 'reuses'
  | 'overlaps'
  | 'differentiates'
  | 'evaluated_by'
  | 'compares_against'
  | 'derived_from'
  | 'blocks'

export type RelationStatus = 'visual' | 'proposal' | 'confirmed' | 'rejected' | 'stale'

export interface ResearchRelationProposal {
  id: string
  from: string
  to: string
  type: ResearchRelationType
  status: RelationStatus
  rationale: string | null
  createdBy: 'user' | 'agent' | 'system'
}
